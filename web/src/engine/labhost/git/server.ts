// git.lab: Git's smart HTTP protocol (v0/v1, which every Git client speaks;
// a client asking for v2 falls back to it). upload-pack serves clone and
// fetch with multi_ack_detailed negotiation and side-band-64k; receive-pack
// takes pushes (thin packs, deltas), checks fast-forward, updates refs and
// reports status. Pushing to a repository that does not exist creates it,
// as GitLab does. After every push, webhooks fire (HTTP to machines in the
// tab) and in-page listeners run (the CI bridge).

import type { HttpRequest, HttpResponse } from '../http';
import { json, text } from '../http';
import { concat, dec, utf8 } from '../wire';
import { parseCommit } from './objects';
import { readPack, writePack } from './pack';
import { GitStore, REPO_NAME, type RepoMeta } from './store';
import { gunzip } from './zlib';

const ZERO = '0'.repeat(40);
const AGENT = 'agent=lab-git/1.0';

// ── pkt-line ──

export function pkt(line: string | Uint8Array): Uint8Array {
  const b = typeof line === 'string' ? utf8(line) : line;
  return concat([utf8((b.length + 4).toString(16).padStart(4, '0')), b]);
}
export const FLUSH = utf8('0000');

/** Split bytes into side-band packets of one band. */
function band(n: number, data: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += 65515) out.push(pkt(concat([Uint8Array.of(n), data.subarray(i, i + 65515)])));
  return out;
}

export interface PushUpdate {
  ref: string;
  before: string | null;
  after: string | null;
}

export interface PushInfo {
  repo: string;
  updates: PushUpdate[];
  /** Who pushed (the client's address). */
  from: string;
}

/** A push listener may return lines that the pusher sees as "remote: …". */
export type PushListener = (p: PushInfo, store: GitStore) => Promise<string[]> | string[];

export interface GitServerEvent {
  t: 'git.clone' | 'git.fetch' | 'git.push' | 'git.create' | 'git.hook';
  repo: string;
  from: string;
  detail: string;
}

export class GitServer {
  private listeners: PushListener[] = [];
  private fns = new Set<(e: GitServerEvent) => void>();
  /** Delivers a webhook; set by the lab (it needs the TCP stack). Returns the status code. */
  deliver: ((url: string, body: string, headers: Record<string, string>) => Promise<number>) | null = null;

  constructor(readonly store: GitStore) {}

  onPush(fn: PushListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== fn);
    };
  }

  on(fn: (e: GitServerEvent) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  private emit(e: GitServerEvent) {
    for (const f of this.fns) f(e);
  }

  /** '/team/site.git/info/refs' → { repo: 'team/site', rest: '/info/refs' } */
  private split(path: string): { repo: string; rest: string } | null {
    const m = /^\/(.+?)(?:\.git)?(\/info\/refs|\/git-upload-pack|\/git-receive-pack|\/HEAD)$/.exec(path);
    if (!m) return null;
    return { repo: m[1].toLowerCase(), rest: m[2] };
  }

  handle = async (req: HttpRequest): Promise<HttpResponse> => {
    if (req.path.startsWith('/api/')) return this.api(req);
    if (req.path === '/' || req.path === '') return this.index();
    const s = this.split(req.path);
    if (!s) {
      const m = /^\/(.+?)(?:\.git)?\/?$/.exec(req.path);
      const r = m && this.store.get(m[1]);
      if (r) return this.browse(r);
      return text(404, `not found: ${req.path}\nThis is a smart HTTP Git server: git clone http://git.lab/<name>.git\n`);
    }
    if (!REPO_NAME.test(s.repo)) return text(400, `bad repository name: ${s.repo}\n`);
    let body = req.body;
    if ((req.headers['content-encoding'] ?? '') === 'gzip') {
      try {
        body = gunzip(body);
      } catch (e) {
        return text(400, `${(e as Error).message}\n`);
      }
    }
    if (s.rest === '/info/refs') {
      const service = req.query.get('service');
      if (service !== 'git-upload-pack' && service !== 'git-receive-pack') return text(403, 'dumb HTTP is not supported; use a Git client 1.6.6 or newer\n');
      let repo = this.store.get(s.repo);
      if (!repo) {
        if (service === 'git-upload-pack') return text(404, `repository '${s.repo}' not found\n`);
        repo = this.store.create(s.repo);
        this.emit({ t: 'git.create', repo: s.repo, from: req.remote.ip, detail: 'created by push' });
      }
      return this.advertise(repo, service);
    }
    if (s.rest === '/HEAD') {
      const repo = this.store.get(s.repo);
      return repo ? text(200, `ref: ${repo.head}\n`) : text(404, 'not found\n');
    }
    const repo = this.store.get(s.repo);
    if (!repo) return text(404, `repository '${s.repo}' not found\n`);
    if (req.method !== 'POST') return text(405, 'POST only\n');
    if (s.rest === '/git-upload-pack') return this.uploadPack(repo, body, req.remote.ip);
    return this.receivePack(repo, body, req.remote.ip);
  };

  private advertise(repo: RepoMeta, service: string): HttpResponse {
    const caps =
      service === 'git-upload-pack'
        ? ['multi_ack_detailed', 'side-band-64k', 'thin-pack', 'ofs-delta', 'no-progress', `symref=HEAD:${repo.head}`, AGENT, 'object-format=sha1']
        : ['report-status', 'delete-refs', 'side-band-64k', 'quiet', 'ofs-delta', AGENT, 'object-format=sha1'];
    const refs: [string, string][] = [];
    const headOid = repo.refs[repo.head];
    if (headOid && service === 'git-upload-pack') refs.push(['HEAD', headOid]);
    for (const k of Object.keys(repo.refs).sort()) refs.push([k, repo.refs[k]]);
    const lines: Uint8Array[] = [pkt(`# service=${service}\n`), FLUSH];
    if (!refs.length) lines.push(pkt(`${ZERO} capabilities^{}\0${caps.join(' ')}\n`));
    refs.forEach(([name, oid], i) => lines.push(pkt(i === 0 ? `${oid} ${name}\0${caps.join(' ')}\n` : `${oid} ${name}\n`)));
    lines.push(FLUSH);
    return { status: 200, headers: { 'content-type': `application/x-${service}-advertisement`, 'cache-control': 'no-cache' }, body: concat(lines) };
  }

  private uploadPack(repo: RepoMeta, body: Uint8Array, from: string): HttpResponse {
    const wants: string[] = [];
    const haves: string[] = [];
    let caps = new Set<string>();
    let done = false;
    let p = 0;
    while (p + 4 <= body.length) {
      const len = parseInt(dec.decode(body.subarray(p, p + 4)), 16);
      if (len === 0) {
        p += 4;
        continue;
      }
      if (!Number.isFinite(len) || len < 4) break;
      const line = dec.decode(body.subarray(p + 4, p + len)).replace(/\n$/, '');
      p += len;
      const [cmd, oid, ...rest] = line.split(' ');
      if (cmd === 'want') {
        wants.push(oid);
        if (rest.length) caps = new Set(rest);
      } else if (cmd === 'have') haves.push(oid);
      else if (cmd === 'done') done = true;
      else if (cmd === 'deepen' || cmd === 'shallow' || cmd.startsWith('filter')) return text(400, 'shallow clones and partial clones are not supported by this server\n');
    }
    for (const w of wants) if (!this.store.has(repo.name, w)) return { status: 200, headers: { 'content-type': 'application/x-git-upload-pack-result' }, body: pkt(`ERR upload-pack: not our ref ${w}\n`) };
    const common = haves.filter((h) => this.store.has(repo.name, h));
    const out: Uint8Array[] = [];
    if (!done) {
      // A negotiation round (stateless RPC): acknowledge what we share, say we are ready.
      for (const c of common) out.push(pkt(`ACK ${c} common\n`));
      if (common.length) out.push(pkt(`ACK ${common.at(-1)} ready\n`));
      out.push(pkt('NAK\n'));
      return { status: 200, headers: { 'content-type': 'application/x-git-upload-pack-result', 'cache-control': 'no-cache' }, body: concat(out) };
    }
    out.push(pkt(common.length ? `ACK ${common.at(-1)}\n` : 'NAK\n'));
    const oids = this.store.reachable(repo.name, wants, common);
    const pack = writePack(oids.map((o) => this.store.object(repo.name, o)!));
    if (caps.has('side-band-64k') || caps.has('side-band')) {
      if (!caps.has('no-progress')) out.push(...band(2, utf8(`Counting objects: ${oids.length}, done.\n`)));
      out.push(...band(1, pack), FLUSH);
    } else out.push(pack);
    this.emit({ t: haves.length ? 'git.fetch' : 'git.clone', repo: repo.name, from, detail: `${oids.length} objects, ${pack.length} bytes` });
    return { status: 200, headers: { 'content-type': 'application/x-git-upload-pack-result', 'cache-control': 'no-cache' }, body: concat(out) };
  }

  private async receivePack(repo: RepoMeta, body: Uint8Array, from: string): Promise<HttpResponse> {
    const cmds: { old: string; new: string; ref: string }[] = [];
    let caps = new Set<string>();
    let p = 0;
    while (p + 4 <= body.length) {
      const len = parseInt(dec.decode(body.subarray(p, p + 4)), 16);
      p += 4;
      if (len === 0) break;
      if (!Number.isFinite(len) || len < 4) return text(400, 'bad pkt-line\n');
      let line = dec.decode(body.subarray(p, p + len - 4)).replace(/\n$/, '');
      p += len - 4;
      const nul = line.indexOf('\0');
      if (nul >= 0) {
        caps = new Set(line.slice(nul + 1).split(' '));
        line = line.slice(0, nul);
      }
      if (line.startsWith('shallow ')) continue;
      const [old, nw, ref] = line.split(' ');
      cmds.push({ old, new: nw, ref });
    }
    const pack = body.subarray(p);
    let unpack = 'ok';
    if (pack.length) {
      try {
        const parsed = readPack(pack, (oid) => this.store.object(repo.name, oid));
        this.store.putObjects(repo.name, parsed.objects);
      } catch (e) {
        unpack = (e as Error).message;
      }
    }
    const results: string[] = [];
    const updates: PushUpdate[] = [];
    for (const c of cmds) {
      const cur = repo.refs[c.ref] ?? ZERO;
      const reject = (why: string) => results.push(`ng ${c.ref} ${why}`);
      if (unpack !== 'ok') {
        reject('unpacker error');
        continue;
      }
      if (!/^refs\/(heads|tags)\/[\w./-]+$/.test(c.ref) || c.ref.includes('..')) {
        reject('funny refname');
        continue;
      }
      if (cur !== c.old) {
        reject('stale info');
        continue;
      }
      if (c.new === ZERO) {
        if (c.ref === repo.head) {
          reject('refusing to delete the current branch');
          continue;
        }
        delete repo.refs[c.ref];
      } else {
        const o = this.store.object(repo.name, c.new);
        if (!o) {
          reject('missing necessary objects');
          continue;
        }
        if (c.ref.startsWith('refs/heads/') && o.type !== 'commit') {
          reject('branch must point to a commit');
          continue;
        }
        if (cur !== ZERO && c.ref.startsWith('refs/heads/') && !this.store.isAncestor(repo.name, cur, c.new)) {
          reject('non-fast-forward');
          continue;
        }
        if (cur !== ZERO && c.ref.startsWith('refs/tags/')) {
          reject('tag already exists');
          continue;
        }
        repo.refs[c.ref] = c.new;
        if (!repo.refs[repo.head] && c.ref.startsWith('refs/heads/')) repo.head = c.ref;
      }
      results.push(`ok ${c.ref}`);
      updates.push({ ref: c.ref, before: cur === ZERO ? null : cur, after: c.new === ZERO ? null : c.new });
    }
    this.store.saveMeta(repo.name);
    const remote: string[] = [];
    if (updates.length) {
      const info = { repo: repo.name, updates, from };
      this.emit({ t: 'git.push', repo: repo.name, from, detail: updates.map((u) => `${u.ref} ${u.before?.slice(0, 7) ?? 'new'}..${u.after?.slice(0, 7) ?? 'deleted'}`).join(', ') });
      for (const l of this.listeners) {
        try {
          remote.push(...(await l(info, this.store)));
        } catch (e) {
          remote.push(`hook failed: ${(e as Error).message}`);
        }
      }
      remote.push(...(await this.fireHooks(repo, info)));
    }
    const report = concat([pkt(`unpack ${unpack}\n`), ...results.map((r) => pkt(`${r}\n`)), FLUSH]);
    let out: Uint8Array;
    if (caps.has('side-band-64k') || caps.has('side-band')) {
      const msgs = remote.length ? band(2, utf8(remote.map((l) => `${l}\n`).join(''))) : [];
      out = concat([...msgs, ...band(1, report), FLUSH]);
    } else out = caps.has('report-status') ? report : new Uint8Array(0);
    return { status: 200, headers: { 'content-type': 'application/x-git-receive-pack-result', 'cache-control': 'no-cache' }, body: out };
  }

  /** The GitLab-style push event body. */
  pushPayload(repo: RepoMeta, u: PushUpdate): Record<string, unknown> {
    const commits: { id: string; message: string; author: string }[] = [];
    const seen = new Set<string>();
    const stack = u.after ? [u.after] : [];
    while (stack.length && commits.length < 20) {
      const oid = stack.pop()!;
      if (seen.has(oid) || oid === u.before) continue;
      seen.add(oid);
      const o = this.store.object(repo.name, oid);
      if (o?.type !== 'commit') continue;
      const c = parseCommit(o.body);
      commits.push({ id: oid, message: c.message, author: c.author.replace(/ \d+ [+-]\d{4}$/, '') });
      stack.push(...c.parents);
    }
    return {
      object_kind: u.ref.startsWith('refs/tags/') ? 'tag_push' : 'push',
      ref: u.ref,
      before: u.before ?? ZERO,
      after: u.after ?? ZERO,
      repository: { name: repo.name, url: `http://git.lab/${repo.name}.git`, default_branch: repo.head.replace('refs/heads/', '') },
      commits,
      total_commits_count: commits.length,
    };
  }

  private async fireHooks(repo: RepoMeta, info: PushInfo): Promise<string[]> {
    const lines: string[] = [];
    for (const h of repo.hooks)
      for (const u of info.updates) {
        const kind = u.ref.startsWith('refs/tags/') ? 'tag_push' : 'push';
        if (h.events.length && !h.events.includes(kind)) continue;
        const body = JSON.stringify(this.pushPayload(repo, u));
        let status = 0;
        let err = '';
        try {
          status = this.deliver ? await this.deliver(h.url, body, { 'content-type': 'application/json', 'x-gitlab-event': kind === 'push' ? 'Push Hook' : 'Tag Push Hook' }) : 0;
        } catch (e) {
          err = (e as Error).message;
        }
        const detail = err ? `${h.url}: ${err}` : `${h.url}: HTTP ${status}`;
        this.emit({ t: 'git.hook', repo: repo.name, from: info.from, detail });
        lines.push(`webhook ${detail}`);
      }
    return lines;
  }

  // ── small JSON API and pages ──

  private index(): HttpResponse {
    const repos = this.store.list();
    const lines = repos.map((r) => `  http://git.lab/${r.name}.git   ${Object.keys(r.refs).length} refs`);
    return text(200, `git.lab — Git over smart HTTP in this tab\n\n${lines.length ? lines.join('\n') : '  (no repositories yet: git push to create one)'}\n\nAPI: GET /api/repos, POST /api/repos {"name"}, POST /api/repos/<name>/hooks {"url"}\n`);
  }

  private browse(r: RepoMeta): HttpResponse {
    const oid = r.refs[r.head];
    const files = oid ? [...this.store.files(r.name, oid).keys()] : [];
    return text(200, `${r.name} (HEAD → ${r.head}${oid ? ` ${oid.slice(0, 7)}` : ', empty'})\n\n${files.map((f) => `  ${f}`).join('\n')}\n\nclone: git clone http://git.lab/${r.name}.git\n`);
  }

  private repoJson(r: RepoMeta) {
    return { name: r.name, url: `http://git.lab/${r.name}.git`, head: r.head, refs: r.refs, hooks: r.hooks, objects: this.store.objectCount(r.name), created_at: r.createdAt, description: r.description ?? '' };
  }

  private async api(req: HttpRequest): Promise<HttpResponse> {
    const parts = req.path.replace(/^\/api\/repos\/?/, '');
    let body: Record<string, unknown> = {};
    if (req.body.length) {
      try {
        body = JSON.parse(dec.decode(req.body)) as Record<string, unknown>;
      } catch {
        return json(400, { error: { code: 'InvalidArgument', message: 'body is not JSON' } });
      }
    }
    if (!req.path.startsWith('/api/repos')) return json(404, { error: { code: 'NotFound', message: req.path } });
    if (!parts) {
      if (req.method === 'GET') return json(200, { items: this.store.list().map((r) => this.repoJson(r)) });
      if (req.method === 'POST') {
        const name = String(body.name ?? '').toLowerCase();
        if (!REPO_NAME.test(name)) return json(400, { error: { code: 'InvalidArgument', message: `bad repository name: ${name}` } });
        if (this.store.get(name)) return json(409, { error: { code: 'AlreadyExists', message: `repository ${name} exists` } });
        const r = this.store.create(name, { description: typeof body.description === 'string' ? body.description : undefined });
        this.emit({ t: 'git.create', repo: name, from: req.remote.ip, detail: 'created by API' });
        return json(201, this.repoJson(r));
      }
      return json(405, { error: { code: 'MethodNotAllowed', message: req.method } });
    }
    const hm = /^(.+?)\/hooks(?:\/(\d+))?$/.exec(parts);
    const name = (hm ? hm[1] : parts).replace(/\.git$/, '');
    const r = this.store.get(name);
    if (!r) return json(404, { error: { code: 'NotFound', message: `repository ${name} not found` } });
    if (hm) {
      if (req.method === 'GET' && !hm[2]) return json(200, { items: r.hooks });
      if (req.method === 'POST' && !hm[2]) {
        const url = String(body.url ?? '');
        if (!/^https?:\/\/[^/]+/.test(url)) return json(400, { error: { code: 'InvalidArgument', message: 'url must be http://host/path' } });
        const hook = { id: (r.hooks.at(-1)?.id ?? 0) + 1, url, events: Array.isArray(body.events) ? (body.events as string[]) : ['push'] };
        r.hooks.push(hook);
        this.store.saveMeta(name);
        return json(201, hook);
      }
      if (req.method === 'DELETE' && hm[2]) {
        r.hooks = r.hooks.filter((h) => h.id !== Number(hm[2]));
        this.store.saveMeta(name);
        return { status: 204 };
      }
      return json(405, { error: { code: 'MethodNotAllowed', message: req.method } });
    }
    if (req.method === 'GET') return json(200, this.repoJson(r));
    if (req.method === 'DELETE') {
      this.store.delete(name);
      return { status: 204 };
    }
    return json(405, { error: { code: 'MethodNotAllowed', message: req.method } });
  }
}

