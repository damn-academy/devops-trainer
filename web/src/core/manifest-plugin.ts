// Vite plugin: serves `virtual:dt-manifest`, the light manifest of the course
// (src/core/manifest.ts). It loads every block and engine module in Node
// through Vite's module runner, so the manifest is always computed from the
// current content; in dev it is recomputed after a source file changes.

import { fileURLToPath } from 'node:url';
import { runnerImport, type Plugin, type ViteDevServer } from 'vite';
import type { Manifest } from './manifest';
import { publicRawPlugin } from './public-raw-plugin.ts';

const ID = 'virtual:dt-manifest';
const RESOLVED = `\0${ID}`;
const BUILDER = fileURLToPath(new URL('./manifest-build.ts', import.meta.url));

// Styles mean nothing in Node, and Vite's CSS transform does not run inside runnerImport.
const STUB_CSS = '\0dt-css-stub';
const noStyles: Plugin = {
  name: 'dt-manifest-no-styles',
  enforce: 'pre',
  resolveId: (id) => (/\.css(\?|$)/.test(id) ? STUB_CSS : undefined),
  load: (id) => (id === STUB_CSS ? 'export default "";' : undefined),
};

async function compute(root: string): Promise<string> {
  const { module } = await runnerImport<{ manifest: Manifest }>(BUILDER, { root, configFile: false, logLevel: 'error', plugins: [noStyles, publicRawPlugin()] });
  const json = JSON.stringify(module.manifest);
  // JSON.parse of a string literal is faster to start than the same object literal.
  return `export default JSON.parse(${JSON.stringify(json)});\n`;
}

export function manifestPlugin(): Plugin {
  let root = process.cwd();
  let cached: Promise<string> | null = null;
  const invalidate = (server: ViteDevServer, file: string) => {
    if (!/\/src\/.*\.ts$/.test(file) || file.endsWith('.test.ts')) return;
    cached = null;
    const mod = server.moduleGraph.getModuleById(RESOLVED);
    if (mod) server.moduleGraph.invalidateModule(mod);
  };
  return {
    name: 'dt-manifest',
    configResolved(c) {
      root = c.root;
    },
    configureServer(server) {
      for (const ev of ['change', 'add', 'unlink'] as const) server.watcher.on(ev, (f: string) => invalidate(server, f));
    },
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return undefined;
      cached ??= compute(root).catch((e: unknown) => {
        cached = null;
        throw e;
      });
      return cached;
    },
  };
}
