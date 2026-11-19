#!/usr/bin/env node
// Downloads the binary assets of tier B (real Linux in the browser, design 09
// §1.4) into public/v86/: the BIOS images of v86 and a small prebuilt Linux
// kernel with a built-in BusyBox userland. The emulator itself (libv86.mjs and
// v86.wasm) comes from the `v86` npm package and is bundled by Vite.
//
// The files are not committed (see .gitignore): they are fetched at build time,
// verified by SHA-256 and described in public/v86/manifest.json, which the app
// reads to show the download size before the learner starts a machine.
//
// Usage: node scripts/fetch-v86.mjs [--force] [--optional]
//   --force     download again even when the files are present and verified
//   --optional  do not fail when offline (used by `prebuild`); the app then
//               says that the real machine is not available in this build

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'v86');
const args = new Set(process.argv.slice(2));

// v86 0.5.473 on npm is built from commit 315b2b0; the BIOS files are taken
// from the same commit so the emulator and its firmware match.
const V86_COMMIT = '315b2b0';

/** Every asset: where it comes from, what licence covers it, its checksum. */
const ASSETS = [
  {
    file: 'seabios.bin',
    url: `https://raw.githubusercontent.com/copy/v86/${V86_COMMIT}/bios/seabios.bin`,
    sha256: '73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98',
    license: 'LGPL-3.0-only (SeaBIOS)',
    source: 'https://www.seabios.org/ · https://github.com/copy/v86/tree/master/bios',
  },
  {
    file: 'vgabios.bin',
    url: `https://raw.githubusercontent.com/copy/v86/${V86_COMMIT}/bios/vgabios.bin`,
    sha256: 'a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880',
    license: 'LGPL-3.0-only (SeaVGABIOS)',
    source: 'https://www.seabios.org/ · https://github.com/copy/v86/tree/master/bios',
  },
  {
    // The image of the "Buildroot Linux" profile of the v86 demo
    // (src/browser/main.js, id "buildroot"): a Linux kernel with an embedded
    // initramfs (BusyBox), 5 MB. Served by the v86 author at i.copy.sh.
    file: 'buildroot-bzimage.bin',
    url: 'https://i.copy.sh/buildroot-bzimage.bin',
    sha256: '7befbaea31e249d9a518c4b95fa42b2a193d0e3de46250d617cbdeb866ee28b0',
    license: 'GPL-2.0 (Linux kernel, BusyBox); built with Buildroot',
    source: 'https://buildroot.org/ · https://github.com/copy/images · https://copy.sh/v86/?profile=buildroot',
  },
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function fetchOne(a) {
  const target = join(out, a.file);
  if (!args.has('--force') && existsSync(target)) {
    const buf = readFileSync(target);
    if (!a.sha256 || sha256(buf) === a.sha256) return { ...a, size: buf.length, sha256: sha256(buf), cached: true };
    console.warn(`v86: ${a.file} has a wrong checksum, downloading again`);
  }
  const res = await fetch(a.url);
  if (!res.ok) throw new Error(`${a.url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sum = sha256(buf);
  if (a.sha256 && sum !== a.sha256) throw new Error(`${a.file}: checksum ${sum} does not match the pinned ${a.sha256}`);
  writeFileSync(target, buf);
  return { ...a, size: buf.length, sha256: sum, cached: false };
}

async function main() {
  mkdirSync(out, { recursive: true });
  const done = [];
  for (const a of ASSETS) {
    const r = await fetchOne(a);
    done.push(r);
    console.log(`v86: ${r.file} ${(r.size / 1024).toFixed(0)} KiB ${r.cached ? '(cached)' : '(downloaded)'}`);
  }
  const manifest = {
    schema: 'dt.v86-assets/v1',
    v86: { npm: '0.5.473', commit: V86_COMMIT, license: 'BSD-2-Clause' },
    fetchedAt: new Date().toISOString(),
    files: Object.fromEntries(done.map((r) => [r.file, { size: r.size, sha256: r.sha256, url: r.url, license: r.license, source: r.source }])),
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

main().catch((e) => {
  if (args.has('--optional')) {
    console.warn(`v86: assets not fetched (${e.message}); the real-Linux machine will be unavailable in this build`);
    process.exit(0);
  }
  console.error(`v86: ${e.message}`);
  process.exit(1);
});
