// Run at build time in Node by manifest-plugin.ts: loads the full registry and
// reduces it to the manifest the app paints the route map from. The work is
// done at the top level because Vite closes its module runner once this
// module has been imported (later dynamic imports would fail).

import { toManifest, type Manifest } from './manifest';
import { loadRegistry } from './registry';

const r = await loadRegistry();
if (r.errors.length) throw new Error(`registry errors:\n${r.errors.join('\n')}`);

export const manifest: Manifest = toManifest(r);
