#!/usr/bin/env node
// Fetches the official OpenTofu release binary (github.com/opentofu/opentofu
// releases) and verifies it: the release's SHA256SUMS file is pinned by
// SHA-256 below, and the archive must match its line in that file.
//
// Used by build-lab-image.mjs (linux_386 goes into the lab image) and by the
// provider test (tests/terraform-provider-lab.test.ts) for the host platform.
// Downloads are cached in web/.cache/tofu/ (git-ignored).
//
//   node scripts/fetch-tofu.mjs                 # host platform, prints the path of `tofu`
//   node scripts/fetch-tofu.mjs --platform linux_386

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { parseTar, sha256 } from './build-lab-image.lib.mjs';

export const TOFU = {
  version: '1.13.9',
  base: 'https://github.com/opentofu/opentofu/releases/download/v1.13.9',
  sums: { file: 'tofu_1.13.9_SHA256SUMS', sha256: 'f8a2925243a71078e84a911f1bb8eaf9c0974c3d5637475921a6af01082d080c' },
  license: 'MPL-2.0',
  source: 'https://github.com/opentofu/opentofu',
};

const here = dirname(fileURLToPath(import.meta.url));
const CACHE = join(here, '..', '.cache', 'tofu', TOFU.version);

export function hostPlatform() {
  const os = { darwin: 'darwin', linux: 'linux', win32: 'windows', freebsd: 'freebsd' }[process.platform];
  const arch = { x64: 'amd64', arm64: 'arm64', ia32: '386', arm: 'arm' }[process.arch];
  if (!os || !arch) throw new Error(`no OpenTofu release for ${process.platform}/${process.arch}`);
  return `${os}_${arch}`;
}

async function download(url, path, check) {
  if (existsSync(path)) {
    const buf = readFileSync(path);
    if (check(buf)) return buf;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!check(buf)) throw new Error(`${url}: checksum mismatch`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return buf;
}

/**
 * The verified `tofu` binary for a platform ('linux_386').
 * Returns { binary, record } where record is the manifest entry of the download.
 */
export async function fetchTofu(platform = hostPlatform()) {
  const sumsBuf = await download(`${TOFU.base}/${TOFU.sums.file}`, join(CACHE, TOFU.sums.file), (b) => sha256(b) === TOFU.sums.sha256);
  const archive = `tofu_${TOFU.version}_${platform}.tar.gz`;
  const line = sumsBuf
    .toString()
    .split('\n')
    .find((l) => l.trim().endsWith(`  ${archive}`));
  if (!line) throw new Error(`${archive} is not in ${TOFU.sums.file}`);
  const want = line.split(/\s+/)[0];
  const url = `${TOFU.base}/${archive}`;
  const buf = await download(url, join(CACHE, archive), (b) => sha256(b) === want);
  const exe = platform.startsWith('windows') ? 'tofu.exe' : 'tofu';
  const entry = parseTar(zlib.gunzipSync(buf)).find((e) => e.name === exe || e.name.endsWith(`/${exe}`));
  if (!entry) throw new Error(`${archive} has no ${exe}`);
  return {
    binary: Buffer.from(entry.data),
    record: { file: `tofu/${archive}`, url, sha256: want, size: buf.length, license: TOFU.license, version: TOFU.version, sumsSha256: TOFU.sums.sha256 },
  };
}

/** Writes the host binary to .cache/tofu/<version>/<platform>/tofu and returns its path. */
export async function hostTofu(platform = hostPlatform()) {
  const path = join(CACHE, platform, platform.startsWith('windows') ? 'tofu.exe' : 'tofu');
  if (!existsSync(path)) {
    const { binary } = await fetchTofu(platform);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, binary);
    chmodSync(path, 0o755);
  }
  return path;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--platform');
  hostTofu(i > 0 ? process.argv[i + 1] : undefined)
    .then((p) => console.log(p))
    .catch((e) => {
      console.error(`fetch-tofu: ${e.message}`);
      process.exit(1);
    });
}
