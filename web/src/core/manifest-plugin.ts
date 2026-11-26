// Vite plugin: serves `virtual:dt-manifest`, the light manifest of the course
// (src/core/manifest.ts). It loads every block and engine module in Node
// through Vite's module runner, so the manifest is always computed from the
// current content; in dev it is recomputed after a source file changes.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport, type Plugin, type ViteDevServer } from 'vite';
import type { Manifest } from './manifest';
import { publicRawPlugin } from './public-raw-plugin.ts';
import { bi } from './i18n.ts';

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

async function compute(root: string): Promise<{ source: string; courses: string }> {
  const { module } = await runnerImport<{ manifest: Manifest }>(BUILDER, { root, configFile: false, logLevel: 'error', plugins: [noStyles, publicRawPlugin()] });
  const hours = Object.fromEntries(module.manifest.blocks.map(b => [b.id, b.hours]));
  const hoursSource = "// Generated from lesson minutes by manifest-plugin.ts. Do not edit by hand.\nexport const ROUTE_HOURS: Record<string, Record<import('./types').Level, number>> = " + JSON.stringify(hours, null, 2) + ';\n';
  const hoursPath = resolve(root, 'src/core/route-hours.ts');
  if (await readFile(hoursPath, 'utf8').catch(() => '') !== hoursSource) await writeFile(hoursPath, hoursSource);
  const json = JSON.stringify(module.manifest);
  // JSON.parse of a string literal is faster to start than the same object literal.
  return { source: `export default JSON.parse(${JSON.stringify(json)});\n`, courses: JSON.stringify(module.manifest.blocks.filter(b => !b.hidden).map(({ id, title }) => ({ id, title }))) };
}

export function manifestPlugin(): Plugin {
  let root = process.cwd();
  let cached: ReturnType<typeof compute> | null = null;
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
    async generateBundle() {
      cached ??= compute(root);
      this.emitFile({ type: 'asset', fileName: 'catalog-courses.json', source: (await cached).courses });
      this.emitFile({ type: 'asset', fileName: 'catalog-labels.json', source: JSON.stringify({
        academy: { title: bi('Все курсы damn.academy', 'All damn.academy courses'), description: bi('Профессия DevOps и деловые курсы: уроки, объяснения, задания, тесты и документация.', 'The DevOps profession and the business courses: lessons, explainers, exercises, quizzes and documentation.') },
        v86: { title: bi('Машины Linux во вкладке', 'In-tab Linux machines'), description: bi('Эмулятор, ядра и образы Linux для практических заданий.', 'Emulator, kernels and Linux images for hands-on exercises.') },
        rv64: { title: bi('Машины RISC-V во вкладке', 'In-tab RISC-V machines'), description: bi('Файлы машин RISC-V для практических заданий.', 'RISC-V machine assets for hands-on exercises.') },
      }) });
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
      return cached.then(result => result.source);
    },
  };
}
