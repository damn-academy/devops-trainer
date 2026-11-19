// Vite plugin: lets a module import a file from public/ as text (`?raw`).
// The file stays at its public URL for the learner to download, and the page
// shows the same bytes; without this, Vite warns on every dev request that
// public assets cannot be imported from JavaScript.

import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const PREFIX = '\0dt-public-raw:';

export function publicRawPlugin(): Plugin {
  return {
    name: 'dt-public-raw',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!id.endsWith('?raw') || !importer) return undefined;
      const file = resolve(dirname(importer.replace(/\?.*$/, '')), id.slice(0, -'?raw'.length));
      return file.includes(`${sep}public${sep}`) ? PREFIX + file : undefined;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return undefined;
      const file = id.slice(PREFIX.length);
      this.addWatchFile(file);
      return `export default ${JSON.stringify(readFileSync(file, 'utf8'))};\n`;
    },
  };
}
