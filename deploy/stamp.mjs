#!/usr/bin/env node
// Sets each file's mtime from a hash of its content (2020-01-01 + up to ~4 years).
// Image layers stay byte-identical for identical content, and nginx ETags
// (mtime + size) still change whenever a file's content changes.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 1577836800;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) {
      const hash = createHash('sha256').update(readFileSync(path)).digest();
      const t = BASE + (hash.readUInt32BE(0) >>> 5);
      utimesSync(path, t, t);
    }
  }
};
for (const dir of process.argv.slice(2)) walk(dir);
