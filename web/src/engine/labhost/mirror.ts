// mirror.lab: a package mirror for installers inside the tab. Files come
// from a StaticSource — in the browser, the page's own origin (web/public,
// fetched by scripts/fetch-*.mjs and served by Vite or the service worker);
// in Node tests, a directory. The mirror only serves what is there: no
// upstream, no internet.

import type { HttpRequest, HttpResponse } from './http';
import { text } from './http';

export interface StaticFile {
  body: Uint8Array;
  type?: string;
}

/** Read a file by its path under the mirror root ('alpine/v3.20/main/x86/APKINDEX.tar.gz'). */
export type StaticSource = (path: string) => Promise<StaticFile | null>;

const TYPES: Record<string, string> = {
  gz: 'application/gzip',
  tgz: 'application/gzip',
  xz: 'application/x-xz',
  apk: 'application/octet-stream',
  deb: 'application/vnd.debian.binary-package',
  zip: 'application/zip',
  iso: 'application/x-iso9660-image',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
  sig: 'application/pgp-signature',
  asc: 'application/pgp-signature',
  pub: 'text/plain',
  sh: 'text/x-shellscript',
};

export function contentType(path: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? '';
  return TYPES[ext] ?? 'application/octet-stream';
}

/** A source that fetches from a base URL (the page's origin + 'mirror/'). */
export function fetchSource(base: string): StaticSource {
  return async (path) => {
    const r = await fetch(new URL(path, base).href);
    if (!r.ok) return null;
    // A dev server answers unknown paths with index.html; that is not a mirror file.
    const type = r.headers.get('content-type') ?? '';
    if (type.startsWith('text/html') && !path.endsWith('.html')) return null;
    return { body: new Uint8Array(await r.arrayBuffer()), type: type || undefined };
  };
}

export interface MirrorEvent {
  path: string;
  status: number;
  bytes: number;
  from: string;
}

export function mirrorHandler(source: StaticSource, onServe?: (e: MirrorEvent) => void): (req: HttpRequest) => Promise<HttpResponse> {
  const cache = new Map<string, StaticFile | null>();
  return async (req) => {
    const done = (r: HttpResponse, bytes = 0) => {
      onServe?.({ path: req.path, status: r.status, bytes, from: req.remote.ip });
      return r;
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return done(text(405, 'GET only\n'));
    const rel = req.path.replace(/^\/+/, '');
    if (rel.split('/').some((p) => p === '..')) return done(text(400, 'bad path\n'));
    const path = rel === '' || rel.endsWith('/') ? `${rel}index.txt` : rel;
    let f = cache.get(path);
    if (f === undefined) {
      f = await source(path).catch(() => null);
      // Keep index files fresh; packages never change under one name.
      if (!path.endsWith('index.txt')) cache.set(path, f);
    }
    if (!f) return done(text(404, `not on this mirror: /${rel}\nThe mirror serves only what the course downloaded into web/public/mirror.\n`));
    return done({ status: 200, headers: { 'content-type': f.type ?? contentType(path), 'cache-control': 'max-age=3600' }, body: f.body }, f.body.length);
  };
}
