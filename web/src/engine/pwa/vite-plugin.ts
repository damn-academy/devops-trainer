// Vite plugin: writes sw.js and manifest.webmanifest next to index.html, with
// the list of every file of this build (so the service worker can precache
// the shell and all lessons) and a version that changes with the content.

import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { swSource } from './sw-source.ts';

/** Files the worker must not precache: source maps and optional machine packs (cached on first use). */
export function precacheable(file: string): boolean {
  // Public lesson media can be large; fetch on demand, never precache.
  if (file.startsWith('media/')) return false;
  if (file.endsWith('.map')) return false;
  if (/^(v86|rv64)\//.test(file)) return false;
  if (/(^|\/)(?:libv86|v86|rv64)[^/]*\.(wasm|js|bin|img)$/.test(file)) return false;
  if (file === 'sw.js' || file.startsWith('.vite/')) return false;
  return true;
}

export const WEB_MANIFEST = {
  name: 'DevOps Trainer',
  short_name: 'DevOps Trainer',
  description: 'Interactive textbook and hands-on trainer for entering DevOps (RU + EN).',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#f6f3ec',
  theme_color: '#353a6e',
  icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
};

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#353a6e"/><path d="m150 196 72 72-72 72m118 0h104" stroke="#f4efe4" stroke-width="36" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function pwaPlugin(): Plugin {
  return {
    name: 'dt-pwa',
    apply: 'build',
    generateBundle(_opts, bundle) {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(WEB_MANIFEST, null, 2) });
      this.emitFile({ type: 'asset', fileName: 'icon.svg', source: ICON_SVG });
      const files = [...Object.keys(bundle), 'manifest.webmanifest', 'icon.svg'].filter(precacheable).sort();
      const hash = createHash('sha256');
      for (const f of files) {
        const item = bundle[f];
        hash.update(f);
        if (item && item.type === 'chunk') hash.update(item.code);
        else if (item && item.type === 'asset') hash.update(typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      const version = hash.digest('hex').slice(0, 12);
      const v86Files = Object.keys(bundle).filter((f) => /(^|\/)v86[^/]*\.(wasm|js)$/.test(f)).sort();
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(version, files, v86Files) });
    },
  };
}
