// The service worker of the course (design 09 §3.2), generated at build time
// by vite-plugin.ts with the exact list of files of this build:
//   - app shell (HTML, entry JS with every lesson, CSS, fonts): precached on install;
//   - hashed lazy chunks (xterm, explainers, labs): precached too, they never change;
//   - v86 engine and images (several MB): cached on first use or by the
//     "keep the real machine offline" button, never precached;
//   - /api/*: network only.
// A new version waits until the learner presses "update" or moves to another
// lesson; it never swaps the shell in the middle of a lesson.

export type Strategy = 'navigate' | 'precached' | 'v86' | 'runtime' | 'network' | 'skip';

/** Which strategy a request gets. Pure, so it is unit-tested; inlined into the worker. */
export function strategyFor(url: string, scope: string, mode: string, method: string): Strategy {
  if (method !== 'GET') return 'skip';
  if (!url.startsWith(scope)) return 'skip';
  const path = url.slice(scope.length).split('?')[0].split('#')[0];
  if (path.startsWith('media/')) return 'network'; // Avoid unbounded large-media caches.
  if (path.startsWith('api/')) return 'network';
  if (mode === 'navigate' || path === '' || path === 'index.html') return 'navigate';
  if (path.startsWith('v86/') || /(^|\/)v86[^/]*\.(wasm|js)$/.test(path)) return 'v86';
  if (path.startsWith('assets/')) return 'precached';
  return 'runtime';
}

export function swSource(version: string, files: string[], v86Files: string[] = []): string {
  return `// DevOps Trainer service worker — generated, version ${version}
'use strict';
const VERSION = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
const V86_FILES = ${JSON.stringify(v86Files)};
const SHELL = 'dt-shell-' + VERSION;
const RUNTIME = 'dt-runtime';
const V86 = 'dt-v86';
const scope = self.registration.scope;
const strategyFor = ${strategyFor.toString()};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', ...FILES].map((f) => new Request(new URL(f, scope), { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('dt-shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function fromCache(name, req) {
  const c = await caches.open(name);
  return c.match(req, { ignoreSearch: true });
}

async function cacheFirst(name, req) {
  const hit = (await fromCache(SHELL, req)) || (await fromCache(name, req));
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) (await caches.open(name)).put(req, res.clone());
  return res;
}

async function navigate(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(SHELL)).put(new URL('./', scope).href, res.clone());
    return res;
  } catch (e) {
    const hit = await fromCache(SHELL, new URL('./', scope).href);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(RUNTIME);
  const hit = (await fromCache(SHELL, req)) || (await c.match(req));
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok && res.status === 200) c.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.headers.has('range')) return;
  const s = strategyFor(req.url, scope, req.mode, req.method);
  if (s === 'skip' || s === 'network') return;
  if (s === 'navigate') return event.respondWith(navigate(req));
  if (s === 'precached') return event.respondWith(cacheFirst(RUNTIME, req));
  if (s === 'v86') return event.respondWith(cacheFirst(V86, req));
  return event.respondWith(staleWhileRevalidate(req));
});

self.addEventListener('message', (event) => {
  const m = event.data || {};
  const reply = (data) => event.source && event.source.postMessage({ ...data, id: m.id });
  if (m.op === 'skip-waiting') self.skipWaiting();
  if (m.op === 'status')
    event.waitUntil(
      Promise.all([caches.open(SHELL).then((c) => c.keys()), caches.open(V86).then((c) => c.keys())]).then(([shell, v86]) =>
        reply({ op: 'status', version: VERSION, shell: shell.length, files: FILES.length + 1, v86: v86.map((r) => r.url) }),
      ),
    );
  if (m.op === 'cache-v86')
    event.waitUntil(
      caches
        .open(V86)
        .then((c) => c.addAll([...new Set([...V86_FILES.map((f) => new URL(f, scope).href), ...(m.urls || [])])]))
        .then(
          () => reply({ op: 'cached', ok: true }),
          (e) => reply({ op: 'cached', ok: false, error: String(e) }),
        ),
    );
  if (m.op === 'drop-v86') event.waitUntil(caches.delete(V86).then(() => reply({ op: 'dropped' })));
});
`;
}
