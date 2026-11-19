// s3.cloud.lab: the S3-compatible subset that the Terraform/OpenTofu `s3`
// backend and the AWS CLI need (see the `s3` tag of openapi.yaml). Buckets
// are cloud resources (api.ts); objects live here, in memory, with a
// persistence hook. Errors are S3 XML, the way real S3 answers.

import type { HttpRequest, HttpResponse } from '../labhost/http';
import { concat, dec } from '../labhost/wire';
import type { Bucket, Cloud } from './api';

export interface S3Object {
  body: Uint8Array;
  etag: string;
  contentType: string;
  modified: string;
  meta: Record<string, string>;
}

export interface S3Persistence {
  put(bucket: string, key: string, o: S3Object): Promise<void>;
  delete(bucket: string, key: string): Promise<void>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function xml(status: number, body: string, headers: Record<string, string> = {}): HttpResponse {
  return { status, headers: { 'content-type': 'application/xml', ...headers }, body: `<?xml version="1.0" encoding="UTF-8"?>\n${body}` };
}

let reqN = 0;
function s3Error(status: number, code: string, message: string, resource: string): HttpResponse {
  const rid = `LAB${(++reqN).toString(16).padStart(12, '0').toUpperCase()}`;
  return xml(status, `<Error><Code>${code}</Code><Message>${esc(message)}</Message><Resource>${esc(resource)}</Resource><RequestId>${rid}</RequestId></Error>`, { 'x-amz-request-id': rid });
}

/** Decode `Content-Encoding: aws-chunked` (SigV4 streaming): "<hex>;chunk-signature=…\r\n<data>\r\n…0;…\r\n<trailers>". */
export function decodeAwsChunked(b: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let p = 0;
  for (;;) {
    let e = p;
    while (e + 1 < b.length && !(b[e] === 13 && b[e + 1] === 10)) e++;
    if (e + 1 >= b.length) break;
    const size = parseInt(dec.decode(b.subarray(p, e)).split(';')[0], 16);
    if (!Number.isFinite(size)) throw new Error('bad aws-chunked encoding');
    p = e + 2;
    if (size === 0) break;
    parts.push(b.subarray(p, p + size));
    p += size + 2;
  }
  return concat(parts);
}

/** MD5 for ETags (S3 clients compare it with Content-MD5). */
export function md5(data: Uint8Array): string {
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const len = data.length;
  const total = (((len + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (len * 8) >>> 0, true);
  dv.setUint32(total - 4, Math.floor((len * 8) / 2 ** 32), true);
  let a0 = 0x67452301,
    b0 = 0xefcdab89,
    c0 = 0x98badcfe,
    d0 = 0x10325476;
  for (let off = 0; off < total; off += 64) {
    let A = a0,
      B = b0,
      C = c0,
      D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const s = S[(i >> 4) * 4 + (i & 3)];
      F = (F + A + K[i] + dv.getUint32(off + g * 4, true)) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0].map((x) => [0, 8, 16, 24].map((s) => ((x >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

export type S3Event = { t: 's3'; op: string; bucket: string; key?: string; status: number; bytes: number; from: string };

export class S3Store {
  private data = new Map<string, Map<string, S3Object>>();
  private fns = new Set<(e: S3Event) => void>();

  constructor(
    private cloud: Cloud,
    private persist?: S3Persistence,
  ) {
    cloud.bucketStats = (name) => {
      const m = this.data.get(name);
      let bytes = 0;
      for (const o of m?.values() ?? []) bytes += o.body.length;
      return { objects: m?.size ?? 0, bytes };
    };
    cloud.bucketPurge = (name) => {
      for (const k of this.data.get(name)?.keys() ?? []) void this.persist?.delete(name, k);
      this.data.delete(name);
    };
    cloud.storageBytes = (project) => cloud.state.buckets.filter((b) => b.project === project).reduce((n, b) => n + cloud.bucketStats(b.name).bytes, 0);
  }

  on(fn: (e: S3Event) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  /** Fill from saved objects (persistence load). */
  load(bucket: string, key: string, o: S3Object): void {
    let m = this.data.get(bucket);
    if (!m) this.data.set(bucket, (m = new Map()));
    m.set(key, o);
  }

  get(bucket: string, key: string): S3Object | undefined {
    return this.data.get(bucket)?.get(key);
  }

  keys(bucket: string): string[] {
    return [...(this.data.get(bucket)?.keys() ?? [])].sort();
  }

  /** Write an object directly (used by the page). */
  put(bucket: string, key: string, body: Uint8Array, contentType = 'application/octet-stream', meta: Record<string, string> = {}): S3Object {
    const o: S3Object = { body, etag: `"${md5(body)}"`, contentType, modified: new Date().toUTCString(), meta };
    let m = this.data.get(bucket);
    if (!m) this.data.set(bucket, (m = new Map()));
    m.set(key, o);
    void this.persist?.put(bucket, key, o);
    return o;
  }

  private delete(bucket: string, key: string) {
    this.data.get(bucket)?.delete(key);
    void this.persist?.delete(bucket, key);
  }

  handle = (req: HttpRequest): HttpResponse => {
    const res = this.route(req);
    const m = /^\/([^/]+)?\/?(.*)$/.exec(this.pathOf(req));
    this.emit({ t: 's3', op: req.method, bucket: m?.[1] ?? '', key: m?.[2] || undefined, status: res.status, bytes: req.body.length, from: req.remote.ip });
    return res;
  };

  private emit(e: S3Event) {
    for (const f of this.fns) f(e);
  }

  /** Virtual-hosted style: tfstate.s3.cloud.lab/key → /tfstate/key. */
  private pathOf(req: HttpRequest): string {
    const vh = /^([a-z0-9][a-z0-9.-]*)\.s3\.cloud\.lab$/.exec(req.host);
    return vh ? `/${vh[1]}${req.path === '/' ? '' : req.path}` : req.path;
  }

  private route(req: HttpRequest): HttpResponse {
    const path = this.pathOf(req);
    const auth = req.headers['authorization'] ?? '';
    const cred = /Credential=([A-Z0-9]+)\//.exec(auth)?.[1] ?? /^AWS ([A-Z0-9]+):/.exec(auth)?.[1];
    if (!cred) return s3Error(403, 'AccessDenied', 'Anonymous access is not allowed: sign the request with an access key of the lab cloud', path);
    const key = this.cloud.keyById(cred);
    if (!key) return s3Error(403, 'InvalidAccessKeyId', 'The AWS Access Key Id you provided does not exist in our records.', path);
    const project = key.project;
    const m = /^\/([^/]*)\/?(.*)$/.exec(path)!;
    const bucketName = m[1];
    const objKey = m[2];
    if (!bucketName) {
      if (req.method !== 'GET') return s3Error(405, 'MethodNotAllowed', 'The specified method is not allowed against this resource.', path);
      const items = this.cloud.state.buckets.filter((b) => b.project === project).map((b) => `<Bucket><Name>${esc(b.name)}</Name><CreationDate>${b.created_at}</CreationDate></Bucket>`);
      return xml(200, `<ListAllMyBucketsResult><Owner><ID>${project}</ID><DisplayName>${project}</DisplayName></Owner><Buckets>${items.join('')}</Buckets></ListAllMyBucketsResult>`);
    }
    const bucket = this.cloud.state.buckets.find((b) => b.name === bucketName);
    if (!objKey && req.method === 'PUT') {
      if (bucket) return s3Error(409, bucket.project === project ? 'BucketAlreadyOwnedByYou' : 'BucketAlreadyExists', 'The requested bucket name is not available.', path);
      try {
        this.cloud.createBucket(project, bucketName);
      } catch (e) {
        return s3Error(400, 'InvalidBucketName', (e as Error).message, path);
      }
      return { status: 200, headers: { location: `/${bucketName}` } };
    }
    if (!bucket) return s3Error(404, 'NoSuchBucket', 'The specified bucket does not exist', path);
    if (bucket.project !== project) return s3Error(403, 'AccessDenied', 'Access Denied', path);
    if (!objKey) return this.bucketOp(req, bucket, path);
    return this.objectOp(req, bucket, objKey, path, project);
  }

  private bucketOp(req: HttpRequest, b: Bucket, path: string): HttpResponse {
    const q = req.query;
    if (req.method === 'HEAD') return { status: 200, headers: { 'x-amz-bucket-region': 'lab-1' } };
    if (req.method === 'DELETE') {
      if (this.keys(b.name).length) return s3Error(409, 'BucketNotEmpty', 'The bucket you tried to delete is not empty', path);
      this.cloud.deleteBucket(b, false);
      return { status: 204 };
    }
    if (req.method !== 'GET') return s3Error(405, 'MethodNotAllowed', 'The specified method is not allowed against this resource.', path);
    if (q.has('location')) return xml(200, '<LocationConstraint>lab-1</LocationConstraint>');
    if (q.has('versioning')) return xml(200, `<VersioningConfiguration>${b.versioning ? '<Status>Enabled</Status>' : ''}</VersioningConfiguration>`);
    for (const sub of ['acl', 'policy', 'lifecycle', 'cors', 'tagging', 'encryption', 'uploads', 'versions'])
      if (q.has(sub)) return s3Error(501, 'NotImplemented', `?${sub} is not implemented in the lab`, path);
    const prefix = q.get('prefix') ?? '';
    const delim = q.get('delimiter') ?? '';
    const max = Math.min(1000, Number(q.get('max-keys') ?? 1000) || 1000);
    const v2 = q.get('list-type') === '2';
    const after = v2 ? (q.get('continuation-token') ?? q.get('start-after') ?? '') : (q.get('marker') ?? '');
    const contents: string[] = [];
    const prefixes = new Set<string>();
    let truncated = false;
    let last = '';
    for (const k of this.keys(b.name)) {
      if (!k.startsWith(prefix) || (after && k <= after)) continue;
      if (contents.length + prefixes.size >= max) {
        truncated = true;
        break;
      }
      if (delim) {
        const i = k.indexOf(delim, prefix.length);
        if (i >= 0) {
          prefixes.add(k.slice(0, i + delim.length));
          last = k;
          continue;
        }
      }
      const o = this.get(b.name, k)!;
      contents.push(`<Contents><Key>${esc(k)}</Key><LastModified>${new Date(o.modified).toISOString()}</LastModified><ETag>${esc(o.etag)}</ETag><Size>${o.body.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`);
      last = k;
    }
    const cp = [...prefixes].map((p) => `<CommonPrefixes><Prefix>${esc(p)}</Prefix></CommonPrefixes>`).join('');
    const head = `<Name>${esc(b.name)}</Name><Prefix>${esc(prefix)}</Prefix>${delim ? `<Delimiter>${esc(delim)}</Delimiter>` : ''}<MaxKeys>${max}</MaxKeys><IsTruncated>${truncated}</IsTruncated>`;
    const page = v2 ? `<KeyCount>${contents.length + prefixes.size}</KeyCount>${truncated ? `<NextContinuationToken>${esc(last)}</NextContinuationToken>` : ''}` : truncated ? `<NextMarker>${esc(last)}</NextMarker>` : '';
    return xml(200, `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${head}${page}${contents.join('')}${cp}</ListBucketResult>`);
  }

  private objectOp(req: HttpRequest, b: Bucket, key: string, path: string, project: string): HttpResponse {
    const cur = this.get(b.name, key);
    const head = (o: S3Object): Record<string, string> => ({
      'content-type': o.contentType,
      etag: o.etag,
      'last-modified': o.modified,
      'accept-ranges': 'bytes',
      ...Object.fromEntries(Object.entries(o.meta).map(([k, v]) => [`x-amz-meta-${k}`, v])),
    });
    switch (req.method) {
      case 'GET':
      case 'HEAD': {
        if (!cur) return req.method === 'HEAD' ? { status: 404 } : s3Error(404, 'NoSuchKey', 'The specified key does not exist.', path);
        const inm = req.headers['if-none-match'];
        if (inm && (inm === cur.etag || inm === '*')) return { status: 304, headers: { etag: cur.etag } };
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers['range'] ?? '');
        if (range && req.method === 'GET') {
          const size = cur.body.length;
          let start = range[1] ? Number(range[1]) : size - Number(range[2]);
          let end = range[1] && range[2] ? Number(range[2]) : size - 1;
          start = Math.max(0, start);
          end = Math.min(size - 1, end);
          if (start > end) return s3Error(416, 'InvalidRange', 'The requested range is not satisfiable', path);
          return { status: 206, headers: { ...head(cur), 'content-range': `bytes ${start}-${end}/${size}` }, body: cur.body.subarray(start, end + 1) };
        }
        return { status: 200, headers: head(cur), body: cur.body };
      }
      case 'PUT': {
        if (req.headers['x-amz-copy-source']) return s3Error(501, 'NotImplemented', 'CopyObject is not implemented in the lab', path);
        if (req.query.has('partNumber') || req.query.has('uploadId')) return s3Error(501, 'NotImplemented', 'multipart upload is not implemented in the lab', path);
        if (req.headers['if-none-match'] === '*' && cur) return s3Error(412, 'PreconditionFailed', 'At least one of the pre-conditions you specified did not hold', path);
        const im = req.headers['if-match'];
        if (im && (!cur || cur.etag !== im)) return s3Error(412, 'PreconditionFailed', 'At least one of the pre-conditions you specified did not hold', path);
        let body = req.body;
        const ce = req.headers['content-encoding'] ?? '';
        if (ce.includes('aws-chunked') || (req.headers['x-amz-content-sha256'] ?? '').startsWith('STREAMING-')) {
          try {
            body = decodeAwsChunked(body);
          } catch (e) {
            return s3Error(400, 'IncompleteBody', (e as Error).message, path);
          }
        }
        const md5h = req.headers['content-md5'];
        if (md5h) {
          const got = btoa(String.fromCharCode(...(md5(body).match(/../g) ?? []).map((x) => parseInt(x, 16))));
          if (got !== md5h) return s3Error(400, 'BadDigest', 'The Content-MD5 you specified did not match what we received.', path);
        }
        const q = this.cloud.usage(project).storage_mb;
        const extra = body.length - (cur?.body.length ?? 0);
        if (extra > 0 && (this.cloud.storageBytes(project) + extra) / (1024 * 1024) > q.limit) return s3Error(403, 'QuotaExceeded', `storage quota of ${q.limit} MiB exceeded`, path);
        const meta: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) if (k.startsWith('x-amz-meta-')) meta[k.slice(11)] = v;
        const o = this.put(b.name, key, body, req.headers['content-type'] ?? 'application/octet-stream', meta);
        return { status: 200, headers: { etag: o.etag } };
      }
      case 'DELETE':
        this.delete(b.name, key);
        return { status: 204 };
    }
    return s3Error(405, 'MethodNotAllowed', 'The specified method is not allowed against this resource.', path);
  }
}

