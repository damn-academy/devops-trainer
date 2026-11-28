#!/usr/bin/env node
// Downloads the R0 inputs listed in manifest.json into web/public/rv64-r0/dl,
// verifies SHA-256 and unpacks the TinyEMU archives into web/public/rv64-r0/src.
// Then: build-tinyemu.sh (engine), build-disk.sh (guest disk), measure.mjs.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', 'public', 'rv64-r0');
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');

for (const s of manifest.sources) {
  const dest = join(root, 'dl', s.file);
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest) || sha(readFileSync(dest)) !== s.sha256) {
    const res = await fetch(s.url);
    if (!res.ok) throw new Error(`${s.url}: HTTP ${res.status}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  const got = sha(readFileSync(dest));
  if (got !== s.sha256) throw new Error(`${s.file}: sha256 ${got}, expected ${s.sha256}`);
  console.log('ok', s.file);
}
mkdirSync(join(root, 'src'), { recursive: true });
for (const f of ['tinyemu-2019-12-21.tar.gz', 'jslinux-2019-12-21.tar.gz', 'diskimage-linux-riscv-2018-09-23.tar.gz']) {
  execFileSync('tar', ['xzf', join(root, 'dl', f), '-C', join(root, 'src')]);
}
// splitimg cuts the disk image into the 256 KiB blocks TinyEMU loads on demand
mkdirSync(join(root, 'build', 'tools'), { recursive: true });
execFileSync('cc', ['-O2', '-DCONFIG_VERSION="2019-12-21"', '-o', join(root, 'build', 'tools', 'splitimg'),
  join(root, 'src', 'tinyemu-2019-12-21', 'splitimg.c')]);
console.log('unpacked into', join(root, 'src'));
