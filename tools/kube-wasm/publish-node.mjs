#!/usr/bin/env node
// Turns a node checkpoint (node.html?capture=1), its boot medium and the
// kube.wasm build into the files the site serves (see README, "Publishing a
// node"): one content-addressed object store plus small manifests.
//
//   node tools/kube-wasm/publish-node.mjs --checkpoint <dir> --media <json> --image <img> \
//     --kube-wasm <kube.wasm> --wasm-exec <wasm_exec.js> --core <rv64_core_bg.wasm> --out <dir>
//
// <out>/objects/<sha256>.gzip every object, gzip -9 (--encoding zstd: .zstd,
//                             zstd -19 with its checksum); the name is the SHA-256
//                             of the decoded bytes (checkpoint objects, 256 KiB
//                             medium chunks, kube.wasm); wasm_exec.js as
//                             <sha256>.js. Not .gz: some static servers send
//                             .gz files with Content-Encoding: gzip
// <out>/kube-node-<id>/       smp.json (+ "encoding", "objects"), kube-state.json;
//                             <id>: the first 16 hex digits of the SHA-256 of smp.json
// <out>/disk-<version>.json   the medium's identity, join placeholder and chunk index
// <out>/node.json             what node.html?node=<url> loads; the only mutable file
// <out>/SHA256SUMS            of every other file, for `sha256sum -c`
//
// Objects already in <out>/objects are kept, so publishing into the same
// directory again only adds what changed. Needs Node.js 20 or newer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const CHUNK_BYTES = 256 * 1024; // web/src/engine/rv64/block.ts
const gzip = promisify(zlib.gzip);
const zstd = zlib.zstdCompress && promisify(zlib.zstdCompress);
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  if (!['checkpoint', 'media', 'image', 'kube-wasm', 'wasm-exec', 'core', 'out', 'jobs', 'encoding'].includes(key) || process.argv[i + 1] === undefined) {
    console.error(`usage: ${path.basename(process.argv[1])} --checkpoint <dir> --media <json> --image <img> --kube-wasm <file> --wasm-exec <file> --core <file> --out <dir> [--encoding gzip|zstd] [--jobs N]`);
    process.exit(2);
  }
  args[key] = process.argv[i + 1];
}
for (const key of ['checkpoint', 'media', 'image', 'kube-wasm', 'wasm-exec', 'core', 'out']) if (!args[key]) { console.error(`--${key} is required`); process.exit(2); }
const jobs = Number(args.jobs ?? 4);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fail = (msg) => { console.error(`publish-node: ${msg}`); process.exit(1); };
const encoding = args.encoding ?? 'gzip';
if (!['gzip', 'zstd'].includes(encoding)) fail(`unknown encoding ${encoding}`);
if (encoding === 'zstd' && !zstd) fail('zstd needs Node.js 22.15 or newer');
/** gzip -9 or zstd -19; the extension is the encoding's name (see objects.ts). */
const encode = (data) => encoding === 'gzip' ? gzip(data, { level: 9 })
  : zstd(data, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19, [zlib.constants.ZSTD_c_checksumFlag]: 1 } });
const out = path.resolve(args.out);
const objects = path.join(out, 'objects');
fs.mkdirSync(objects, { recursive: true });

let added = 0, kept = 0, encodedBytes = 0, decodedBytes = 0;
/** Stores one object (encoded, unless ext is given) and returns its reference. */
async function put(data, ext = encoding) {
  const sha = sha256(data);
  const file = path.join(objects, `${sha}.${ext}`);
  decodedBytes += data.length;
  if (fs.existsSync(file)) { kept++; encodedBytes += fs.statSync(file).size; return { sha256: sha, bytes: data.length }; }
  const body = ext === encoding ? await encode(data) : data;
  // Written under a temporary name first: an interrupted run never leaves a
  // truncated object that a later run would keep.
  fs.writeFileSync(`${file}.tmp`, body);
  fs.renameSync(`${file}.tmp`, file);
  added++; encodedBytes += body.length;
  return { sha256: sha, bytes: data.length };
}
/** Runs fn over items with at most `jobs` in flight (zlib runs in the thread pool). */
async function pool(items, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}

// 1. The checkpoint must belong to this emulator core and this medium.
const cpDir = path.resolve(args.checkpoint);
const smpText = fs.readFileSync(path.join(cpDir, 'smp.json'), 'utf8');
const smp = JSON.parse(smpText);
const media = JSON.parse(fs.readFileSync(args.media, 'utf8'));
const coreSha = sha256(fs.readFileSync(args.core));
if (smp.format !== 'dt.rv64.smp/v1') fail(`unsupported checkpoint format ${smp.format}`);
if (smp.encoding || smp.objects) fail('the checkpoint is already published');
if (smp.wasmSha256 !== coreSha) fail(`checkpoint was taken with core ${smp.wasmSha256}, ${args.core} is ${coreSha}`);
if (smp.disk.version !== media.version || smp.disk.bytes !== media.bytes) fail('checkpoint and medium differ (version or size)');
const imageSize = fs.statSync(args.image).size;
if (imageSize !== media.bytes) fail(`${args.image} has ${imageSize} bytes, the medium ${media.bytes}`);

// 2. Checkpoint objects, verified against their recorded checksums.
const refs = [...smp.cpus, smp.device, smp.control, smp.mail, ...smp.ram.map((c) => c.object)];
await pool(refs, async (ref) => {
  const data = fs.readFileSync(path.join(cpDir, `${ref.sha256}.bin`));
  if (data.length !== ref.bytes || sha256(data) !== ref.sha256) fail(`checkpoint object ${ref.sha256} is damaged`);
  await put(data);
});
const id = sha256(smpText).slice(0, 16);
const cpOut = path.join(out, `kube-node-${id}`);
fs.mkdirSync(cpOut, { recursive: true });
fs.writeFileSync(path.join(cpOut, 'smp.json'), JSON.stringify({ ...smp, encoding, objects: '../objects/' }));
fs.copyFileSync(path.join(cpDir, 'kube-state.json'), path.join(cpOut, 'kube-state.json'));
const cpStats = { encoded: encodedBytes, decoded: decodedBytes };

// 3. The medium, one object per 256 KiB chunk (read on demand by the guest).
const fd = fs.openSync(args.image, 'r');
const indices = Array.from({ length: Math.ceil(imageSize / CHUNK_BYTES) }, (_, i) => i);
let imageHash = crypto.createHash('sha256');
const chunks = await pool(indices, async (i) => {
  const data = Buffer.alloc(Math.min(CHUNK_BYTES, imageSize - i * CHUNK_BYTES));
  fs.readSync(fd, data, 0, data.length, i * CHUNK_BYTES);
  return (await put(data)).sha256;
});
fs.closeSync(fd);
// The medium's version is the SHA-256 of the whole image (node-media.py);
// check it against the bytes just published.
for (let i = 0, f = fs.openSync(args.image, 'r'), b = Buffer.alloc(1 << 24); ; i++) {
  const n = fs.readSync(f, b, 0, b.length, null);
  if (!n) { fs.closeSync(f); break; }
  imageHash.update(b.subarray(0, n));
}
imageHash = imageHash.digest('hex');
if (imageHash !== media.version) fail(`${args.image} hashes to ${imageHash}, the medium says ${media.version}`);
const mediaName = `disk-${media.version.slice(0, 16)}.json`;
fs.writeFileSync(path.join(out, mediaName), JSON.stringify({ url: 'objects/', bytes: media.bytes, version: media.version, join: media.join, source: media.source, encoding, chunks }));
const diskStats = { encoded: encodedBytes - cpStats.encoded, decoded: decodedBytes - cpStats.decoded };

// 4. kube.wasm and its wasm_exec.js (they belong to one Go build).
const kubeWasm = await put(fs.readFileSync(args['kube-wasm']));
const wasmExec = await put(fs.readFileSync(args['wasm-exec']), 'js');

// 5. The pointer and the checksums.
const bundle = { format: 'dt.kube-node/v1', objects: 'objects/', encoding, kubeWasm, wasmExec: { sha256: wasmExec.sha256 },
  checkpoint: `kube-node-${id}/`, media: mediaName, coreSha256: coreSha };
fs.writeFileSync(path.join(out, 'node.json'), JSON.stringify(bundle, null, 1) + '\n');
const sums = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) walk(p);
  else if (p !== path.join(out, 'node.json') && p !== path.join(out, 'SHA256SUMS') && !p.endsWith('.tmp')) sums.push(`${sha256(fs.readFileSync(p))}  ${path.relative(out, p)}`);
} };
walk(out);
fs.writeFileSync(path.join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
const MB = (b) => `${(b / 1e6).toFixed(1)} MB`;
console.log(JSON.stringify({
  node: path.join(out, 'node.json'), checkpoint: `kube-node-${id}/`, media: mediaName, core: coreSha,
  objects: { added, kept },
  checkpointObjects: `${MB(cpStats.decoded)} -> ${MB(cpStats.encoded)}`,
  mediumChunks: `${chunks.length}: ${MB(diskStats.decoded)} -> ${MB(diskStats.encoded)}`,
  kubeWasm: `${MB(kubeWasm.bytes)} -> ${MB(fs.statSync(path.join(objects, `${kubeWasm.sha256}.${encoding}`)).size)}`,
}, null, 1));
