// The repository model of the simulated Git. Everything lives in the machine's
// virtual file system the way Git keeps it: objects in .git/objects/xx/…,
// branches in .git/refs/heads, HEAD as a symbolic ref, the reflog in
// .git/logs. Objects are stored uncompressed ("blob 12\0…"), so `cat` shows
// what zlib would hide; blob ids are the real SHA-1 Git would compute.
// The index is kept as readable JSON (real Git uses a binary file).

import type { FsApi } from '../../../core/types';
import { isIgnored, parseIgnore, type IgnoreRule } from './ignore';
import { byteLength, objectId } from './sha1';

export type ObjType = 'blob' | 'tree' | 'commit' | 'tag';

export interface TreeEntry {
  mode: string;
  type: 'blob' | 'tree';
  oid: string;
  name: string;
}

export interface Person {
  name: string;
  email: string;
  time: number;
  tz: string;
}

export interface Commit {
  oid: string;
  tree: string;
  parents: string[];
  author: Person;
  committer: Person;
  message: string;
}

export interface IndexEntry {
  oid: string;
  mode: string;
  /** Present while a merge conflict on this path is not resolved. */
  conflict?: { base?: string; ours?: string; theirs?: string };
}

export type FlatTree = Map<string, { oid: string; mode: string }>;

export interface StatusEntry {
  path: string;
  kind: 'new' | 'modified' | 'deleted';
}

export interface Status {
  staged: StatusEntry[];
  unstaged: StatusEntry[];
  untracked: string[];
  conflicted: string[];
}

export class GitError extends Error {
  constructor(
    msg: string,
    public code = 128,
  ) {
    super(msg);
  }
}

const join = (a: string, b: string) => (a.endsWith('/') ? a + b : `${a}/${b}`);

export function formatPerson(p: Person): string {
  return `${p.name} <${p.email}> ${Math.floor(p.time / 1000)} ${p.tz}`;
}

export function parsePerson(s: string): Person {
  const m = /^(.*) <(.*)> (\d+) ([+-]\d{4})$/.exec(s);
  if (!m) return { name: s, email: '', time: 0, tz: '+0000' };
  return { name: m[1], email: m[2], time: Number(m[3]) * 1000, tz: m[4] };
}

// ── config files (git-config(1) syntax, the subset Git writes itself) ──

export function parseConfig(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const sec = /^\[([\w.-]+)(?:\s+"(.*)")?\]$/.exec(line);
    if (sec) {
      section = sec[2] !== undefined ? `${sec[1].toLowerCase()}.${sec[2]}` : sec[1].toLowerCase();
      continue;
    }
    const kv = /^([\w-]+)\s*(?:=\s*(.*))?$/.exec(line);
    if (kv && section) out.set(`${section}.${kv[1].toLowerCase()}`, (kv[2] ?? 'true').replace(/^"(.*)"$/, '$1'));
  }
  return out;
}

export function serializeConfig(map: Map<string, string>): string {
  const sections = new Map<string, [string, string][]>();
  for (const [k, v] of map) {
    const i = k.lastIndexOf('.');
    const sec = k.slice(0, i);
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push([k.slice(i + 1), v]);
  }
  let out = '';
  for (const [sec, kvs] of sections) {
    const dot = sec.indexOf('.');
    out += dot < 0 ? `[${sec}]\n` : `[${sec.slice(0, dot)} "${sec.slice(dot + 1)}"]\n`;
    for (const [k, v] of kvs) out += `\t${k} = ${v}\n`;
  }
  return out;
}

export class Repo {
  constructor(
    readonly fs: FsApi,
    /** Absolute path of the working tree (the bare repository itself when bare). */
    readonly root: string,
    readonly gitdir: string,
    readonly bare = false,
    readonly clock: () => number = () => Date.now(),
  ) {}

  /** Walk up from `cwd` to the nearest directory that contains .git. */
  static find(fs: FsApi, cwd: string, clock?: () => number): Repo | null {
    let dir = fs.resolve(cwd);
    for (;;) {
      const st = fs.stat(join(dir, '.git'));
      if (st?.type === 'd') return new Repo(fs, dir, join(dir, '.git'), false, clock);
      if (dir === '/') return null;
      dir = dir.slice(0, dir.lastIndexOf('/')) || '/';
    }
  }

  static open(fs: FsApi, path: string, clock?: () => number): Repo | null {
    const abs = fs.resolve(path);
    if (fs.stat(join(abs, '.git'))?.type === 'd') return new Repo(fs, abs, join(abs, '.git'), false, clock);
    if (fs.stat(join(abs, 'HEAD'))?.type === 'f' && fs.stat(join(abs, 'objects'))?.type === 'd') return new Repo(fs, abs, abs, true, clock);
    return null;
  }

  static init(fs: FsApi, dir: string, o: { bare?: boolean; branch?: string; clock?: () => number } = {}): { repo: Repo; reinit: boolean } {
    const abs = fs.resolve(dir);
    if (!fs.exists(abs)) fs.mkdir(abs, { parents: true });
    const gitdir = o.bare ? abs : join(abs, '.git');
    const reinit = fs.exists(join(gitdir, 'HEAD'));
    for (const d of ['', 'objects', 'refs', 'refs/heads', 'refs/tags', 'info', 'logs']) {
      const p = d ? join(gitdir, d) : gitdir;
      if (!fs.exists(p)) fs.mkdir(p, { parents: true });
    }
    if (!reinit) {
      fs.writeFile(join(gitdir, 'HEAD'), `ref: refs/heads/${o.branch ?? 'main'}\n`);
      fs.writeFile(join(gitdir, 'config'), `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = ${o.bare ? 'true' : 'false'}\n`);
      fs.writeFile(join(gitdir, 'description'), "Unnamed repository; edit this file 'description' to name the repository.\n");
      fs.writeFile(join(gitdir, 'info/exclude'), '# git ls-files --others --exclude-from=.git/info/exclude\n');
    }
    return { repo: new Repo(fs, abs, gitdir, !!o.bare, o.clock), reinit };
  }

  p(rel: string): string {
    return join(this.gitdir, rel);
  }

  // ── objects ──

  writeObject(type: ObjType, body: string): string {
    const oid = objectId(type, body);
    const dir = this.p(`objects/${oid.slice(0, 2)}`);
    const file = `${dir}/${oid.slice(2)}`;
    if (!this.fs.exists(file)) {
      if (!this.fs.exists(dir)) this.fs.mkdir(dir, { parents: true });
      this.fs.writeFile(file, `${type} ${byteLength(body)}\0${body}`);
    }
    return oid;
  }

  hasObject(oid: string): boolean {
    return /^[0-9a-f]{40}$/.test(oid) && this.fs.exists(this.p(`objects/${oid.slice(0, 2)}/${oid.slice(2)}`));
  }

  readObject(oid: string): { type: ObjType; body: string } | null {
    if (!this.hasObject(oid)) return null;
    const raw = this.fs.readFile(this.p(`objects/${oid.slice(0, 2)}/${oid.slice(2)}`));
    const nul = raw.indexOf('\0');
    const type = raw.slice(0, raw.indexOf(' ')) as ObjType;
    return { type, body: raw.slice(nul + 1) };
  }

  /** Every object id in the store (for prefix lookup and copying to a remote). */
  allObjects(): string[] {
    const out: string[] = [];
    const base = this.p('objects');
    if (!this.fs.exists(base)) return out;
    for (const d of this.fs.readdir(base)) {
      if (!/^[0-9a-f]{2}$/.test(d)) continue;
      for (const f of this.fs.readdir(`${base}/${d}`)) out.push(d + f);
    }
    return out;
  }

  readBlob(oid: string): string {
    const o = this.readObject(oid);
    if (!o || o.type !== 'blob') throw new GitError(`fatal: bad object ${oid}`);
    return o.body;
  }

  writeTree(entries: TreeEntry[]): string {
    const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return this.writeObject('tree', sorted.map((e) => `${e.mode} ${e.type} ${e.oid}\t${e.name}\n`).join(''));
  }

  readTree(oid: string): TreeEntry[] {
    const o = this.readObject(oid);
    if (!o || o.type !== 'tree') throw new GitError(`fatal: not a tree object: ${oid}`);
    return o.body
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [meta, name] = line.split('\t');
        const [mode, type, id] = meta.split(' ');
        return { mode, type: type as 'blob' | 'tree', oid: id, name };
      });
  }

  writeCommit(c: Omit<Commit, 'oid'>): string {
    let body = `tree ${c.tree}\n`;
    for (const p of c.parents) body += `parent ${p}\n`;
    body += `author ${formatPerson(c.author)}\ncommitter ${formatPerson(c.committer)}\n\n${c.message.endsWith('\n') ? c.message : c.message + '\n'}`;
    return this.writeObject('commit', body);
  }

  readCommit(oid: string): Commit {
    const o = this.readObject(oid);
    if (!o || o.type !== 'commit') throw new GitError(`fatal: bad object ${oid}`);
    const [head, ...rest] = o.body.split('\n\n');
    const c: Commit = { oid, tree: '', parents: [], author: parsePerson(''), committer: parsePerson(''), message: rest.join('\n\n').replace(/\n$/, '') };
    for (const line of head.split('\n')) {
      const sp = line.indexOf(' ');
      const k = line.slice(0, sp);
      const v = line.slice(sp + 1);
      if (k === 'tree') c.tree = v;
      else if (k === 'parent') c.parents.push(v);
      else if (k === 'author') c.author = parsePerson(v);
      else if (k === 'committer') c.committer = parsePerson(v);
    }
    return c;
  }

  /** Path → blob of a commit's tree, recursively. */
  flatTree(treeOid: string | null, prefix = '', out: FlatTree = new Map()): FlatTree {
    if (!treeOid) return out;
    for (const e of this.readTree(treeOid)) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.type === 'tree') this.flatTree(e.oid, path, out);
      else out.set(path, { oid: e.oid, mode: e.mode });
    }
    return out;
  }

  /** Write tree objects for a flat path map; returns the root tree id. */
  buildTree(flat: FlatTree): string {
    type Dir = { files: Map<string, { oid: string; mode: string }>; dirs: Map<string, Dir> };
    const root: Dir = { files: new Map(), dirs: new Map() };
    for (const [path, e] of flat) {
      const parts = path.split('/');
      let d = root;
      for (const part of parts.slice(0, -1)) {
        if (!d.dirs.has(part)) d.dirs.set(part, { files: new Map(), dirs: new Map() });
        d = d.dirs.get(part)!;
      }
      d.files.set(parts[parts.length - 1], e);
    }
    const write = (d: Dir): string => {
      const entries: TreeEntry[] = [];
      for (const [name, e] of d.files) entries.push({ mode: e.mode, type: 'blob', oid: e.oid, name });
      for (const [name, sub] of d.dirs) entries.push({ mode: '040000', type: 'tree', oid: write(sub), name });
      return this.writeTree(entries);
    };
    return write(root);
  }

  commitFiles(oid: string | null): FlatTree {
    return oid ? this.flatTree(this.readCommit(oid).tree) : new Map();
  }

  // ── refs ──

  headRef(): { symbolic: string | null; oid: string | null } {
    const raw = this.fs.exists(this.p('HEAD')) ? this.fs.readFile(this.p('HEAD')).trim() : '';
    if (raw.startsWith('ref: ')) {
      const ref = raw.slice(5);
      return { symbolic: ref, oid: this.readRef(ref) };
    }
    return { symbolic: null, oid: raw || null };
  }

  currentBranch(): string | null {
    const h = this.headRef();
    return h.symbolic?.startsWith('refs/heads/') ? h.symbolic.slice(11) : null;
  }

  headOid(): string | null {
    return this.headRef().oid;
  }

  readRef(ref: string): string | null {
    const file = this.p(ref);
    if (this.fs.stat(file)?.type !== 'f') return null;
    const v = this.fs.readFile(file).trim();
    return v.startsWith('ref: ') ? this.readRef(v.slice(5)) : v || null;
  }

  writeRef(ref: string, oid: string, reason: string, old?: string | null): void {
    const file = this.p(ref);
    const dir = file.slice(0, file.lastIndexOf('/'));
    if (!this.fs.exists(dir)) this.fs.mkdir(dir, { parents: true });
    const prev = old !== undefined ? old : this.readRef(ref);
    this.fs.writeFile(file, `${oid}\n`);
    this.reflog(ref, prev, oid, reason);
  }

  deleteRef(ref: string): void {
    if (this.fs.exists(this.p(ref))) this.fs.unlink(this.p(ref));
  }

  setHead(target: { branch: string } | { oid: string }, reason: string): void {
    const prev = this.headOid();
    if ('branch' in target) this.fs.writeFile(this.p('HEAD'), `ref: refs/heads/${target.branch}\n`);
    else this.fs.writeFile(this.p('HEAD'), `${target.oid}\n`);
    const now = this.headOid();
    if (now) this.reflog('HEAD', prev, now, reason);
  }

  /** Move the branch HEAD points to (or HEAD itself when detached) and log it in both reflogs. */
  advanceHead(oid: string, reason: string): void {
    const h = this.headRef();
    const prev = h.oid;
    if (h.symbolic) this.writeRef(h.symbolic, oid, reason, prev);
    else this.fs.writeFile(this.p('HEAD'), `${oid}\n`);
    this.reflog('HEAD', prev, oid, reason);
  }

  private reflog(ref: string, from: string | null, to: string, reason: string): void {
    if (this.bare) return;
    const file = this.p(`logs/${ref}`);
    const dir = file.slice(0, file.lastIndexOf('/'));
    if (!this.fs.exists(dir)) this.fs.mkdir(dir, { parents: true });
    const who = this.identity(false);
    const line = `${from ?? '0'.repeat(40)} ${to} ${who ? `${who.name} <${who.email}>` : 'unknown <unknown>'} ${Math.floor(this.clock() / 1000)} +0000\t${reason}\n`;
    this.fs.writeFile(file, line, { append: true });
  }

  readReflog(ref = 'HEAD'): { from: string; to: string; reason: string }[] {
    const file = this.p(`logs/${ref}`);
    if (!this.fs.exists(file)) return [];
    return this.fs
      .readFile(file)
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [meta, reason] = l.split('\t');
        const [from, to] = meta.split(' ');
        return { from, to, reason: reason ?? '' };
      });
  }

  private listRefs(prefix: string): Map<string, string> {
    const out = new Map<string, string>();
    const walk = (dir: string, name: string) => {
      const st = this.fs.stat(dir);
      if (!st) return;
      if (st.type === 'f') {
        const v = this.readRef(dir.slice(this.gitdir.length + 1));
        if (v) out.set(name, v);
        return;
      }
      for (const e of this.fs.readdir(dir)) walk(`${dir}/${e}`, name ? `${name}/${e}` : e);
    };
    walk(this.p(prefix), '');
    return out;
  }

  branches(): Map<string, string> {
    return this.listRefs('refs/heads');
  }

  tags(): Map<string, string> {
    return this.listRefs('refs/tags');
  }

  remoteBranches(): Map<string, string> {
    return this.listRefs('refs/remotes');
  }

  /** Resolve a revision: HEAD, a branch, a tag, origin/main, a (short) hash, with ~n and ^ suffixes. */
  resolve(rev: string): string | null {
    const m = /^(.*?)((?:[~^]\d*)*)$/.exec(rev.trim());
    if (!m) return null;
    let base = m[1];
    const suffix = m[2];
    let oid: string | null = null;
    const at = /^(.*)@\{(\d+)\}$/.exec(base);
    if (at) {
      // HEAD@{2}, main@{1}: where the reference was n moves ago, from its reflog.
      const name = at[1] === '' || at[1] === 'HEAD' ? 'HEAD' : `refs/heads/${at[1].replace(/^refs\/heads\//, '')}`;
      const log = this.readReflog(name).reverse();
      const e = log[Number(at[2])];
      if (!e) throw new GitError(`fatal: log for '${at[1] || 'HEAD'}' only has ${log.length} entries`);
      oid = e.to;
    } else if (base === 'HEAD' || base === '@' || base === '') oid = this.headOid();
    else if (base === 'MERGE_HEAD' || base === 'ORIG_HEAD') oid = this.fs.exists(this.p(base)) ? this.fs.readFile(this.p(base)).trim() : null;
    else {
      base = base.replace(/^refs\//, '');
      for (const ref of [`refs/${base}`, `refs/heads/${base}`, `refs/tags/${base}`, `refs/remotes/${base}`]) {
        const v = this.readRef(ref);
        if (v) {
          oid = this.peel(v);
          break;
        }
      }
      if (!oid && /^[0-9a-f]{4,40}$/.test(base)) {
        const hits = this.allObjects().filter((o) => o.startsWith(base));
        if (hits.length === 1) oid = hits[0];
        else if (hits.length > 1) throw new GitError(`error: short object ID ${base} is ambiguous`);
      }
    }
    if (!oid) return null;
    const re = /([~^])(\d*)/g;
    let s: RegExpExecArray | null;
    while ((s = re.exec(suffix))) {
      const n = s[2] === '' ? 1 : Number(s[2]);
      if (s[1] === '~') {
        for (let i = 0; i < n; i++) {
          const c = this.readCommit(oid!);
          if (!c.parents[0]) return null;
          oid = c.parents[0];
        }
      } else {
        const c = this.readCommit(oid!);
        if (n === 0) continue;
        oid = c.parents[n - 1] ?? null;
        if (!oid) return null;
      }
    }
    return oid;
  }

  /** An annotated tag points to a tag object; follow it to the commit. */
  peel(oid: string): string {
    const o = this.readObject(oid);
    if (o?.type === 'tag') {
      const m = /^object ([0-9a-f]{40})/m.exec(o.body);
      return m ? this.peel(m[1]) : oid;
    }
    return oid;
  }

  // ── history ──

  /** Commits reachable from `starts`, newest first (by committer time, then topology). */
  walk(starts: string[], limit = 10_000): Commit[] {
    const seen = new Set<string>();
    const queue: Commit[] = [];
    for (const s of starts) if (s && !seen.has(s)) {
      seen.add(s);
      queue.push(this.readCommit(s));
    }
    const out: Commit[] = [];
    while (queue.length && out.length < limit) {
      queue.sort((a, b) => b.committer.time - a.committer.time);
      const c = queue.shift()!;
      out.push(c);
      for (const p of c.parents) if (!seen.has(p) && this.hasObject(p)) {
        seen.add(p);
        queue.push(this.readCommit(p));
      }
    }
    return out;
  }

  ancestors(oid: string): Set<string> {
    const out = new Set<string>();
    const stack = [oid];
    while (stack.length) {
      const o = stack.pop()!;
      if (out.has(o) || !this.hasObject(o)) continue;
      out.add(o);
      stack.push(...this.readCommit(o).parents);
    }
    return out;
  }

  isAncestor(maybe: string, of: string): boolean {
    return this.ancestors(of).has(maybe);
  }

  mergeBase(a: string, b: string): string | null {
    const A = this.ancestors(a);
    // Breadth-first from b: the first common ancestor found is a best common ancestor for the course's histories.
    const seen = new Set<string>();
    const queue = [b];
    while (queue.length) {
      const o = queue.shift()!;
      if (seen.has(o)) continue;
      seen.add(o);
      if (A.has(o)) return o;
      if (this.hasObject(o)) queue.push(...this.readCommit(o).parents);
    }
    return null;
  }

  // ── index ──

  readIndex(): Map<string, IndexEntry> {
    const file = this.p('index');
    if (!this.fs.exists(file)) return new Map();
    try {
      const j = JSON.parse(this.fs.readFile(file)) as { entries: Record<string, IndexEntry> };
      return new Map(Object.entries(j.entries ?? {}));
    } catch {
      throw new GitError('fatal: index file corrupt');
    }
  }

  writeIndex(idx: Map<string, IndexEntry>): void {
    const entries = Object.fromEntries([...idx.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    this.fs.writeFile(this.p('index'), JSON.stringify({ version: 2, entries }, null, 1) + '\n');
  }

  indexAsTree(idx = this.readIndex()): FlatTree {
    const m: FlatTree = new Map();
    for (const [p, e] of idx) m.set(p, { oid: e.oid, mode: e.mode });
    return m;
  }

  // ── working tree ──

  ignoreRules(): IgnoreRule[] {
    let text = '';
    for (const f of [join(this.root, '.gitignore'), this.p('info/exclude')]) if (this.fs.stat(f)?.type === 'f') text += this.fs.readFile(f) + '\n';
    return parseIgnore(text);
  }

  /** Files of the working tree (relative paths), without .git; directories are not listed. */
  worktree(): Map<string, { text: string; mode: string }> {
    const out = new Map<string, { text: string; mode: string }>();
    const walk = (dir: string, rel: string) => {
      let names: string[];
      try {
        names = this.fs.readdir(dir);
      } catch {
        return;
      }
      for (const name of names) {
        if (!rel && name === '.git') continue;
        const abs = join(dir, name);
        const r = rel ? `${rel}/${name}` : name;
        const st = this.fs.lstat(abs);
        if (!st) continue;
        if (st.type === 'd') walk(abs, r);
        else if (st.type === 'f') {
          try {
            out.set(r, { text: this.fs.readFile(abs), mode: st.mode & 0o111 ? '100755' : '100644' });
          } catch {
            /* unreadable files are skipped, as Git would report them */
          }
        }
      }
    };
    if (!this.bare) walk(this.root, '');
    return out;
  }

  ignored(path: string, isDir = false, rules = this.ignoreRules()): boolean {
    return isIgnored(rules, path, isDir);
  }

  status(): Status {
    const head = this.headOid();
    const headFiles = this.commitFiles(head);
    const idx = this.readIndex();
    const wt = this.worktree();
    const rules = this.ignoreRules();
    const staged: StatusEntry[] = [];
    const unstaged: StatusEntry[] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];
    for (const [path, e] of idx) {
      if (e.conflict) {
        conflicted.push(path);
        continue;
      }
      const h = headFiles.get(path);
      if (!h) staged.push({ path, kind: 'new' });
      else if (h.oid !== e.oid || h.mode !== e.mode) staged.push({ path, kind: 'modified' });
      const w = wt.get(path);
      if (!w) unstaged.push({ path, kind: 'deleted' });
      else if (objectId('blob', w.text) !== e.oid || w.mode !== e.mode) unstaged.push({ path, kind: 'modified' });
    }
    for (const [path] of headFiles) if (!idx.has(path)) staged.push({ path, kind: 'deleted' });
    for (const [path] of wt) if (!idx.has(path) && !isIgnored(rules, path)) untracked.push(path);
    const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : 1);
    return { staged: staged.sort(byPath), unstaged: unstaged.sort(byPath), untracked: untracked.sort(), conflicted: conflicted.sort() };
  }

  /** Write the files of a tree into the working tree and the index (checkout / reset --hard). */
  checkoutTree(target: FlatTree, opts: { from?: FlatTree } = {}): void {
    const from = opts.from ?? this.indexAsTree();
    for (const [path] of from) {
      if (!target.has(path)) {
        const abs = join(this.root, path);
        if (this.fs.exists(abs)) this.fs.unlink(abs);
        this.pruneEmptyDirs(path);
      }
    }
    for (const [path, e] of target) {
      const abs = join(this.root, path);
      const dir = abs.slice(0, abs.lastIndexOf('/'));
      if (!this.fs.exists(dir)) this.fs.mkdir(dir, { parents: true });
      this.fs.writeFile(abs, this.readBlob(e.oid));
      this.fs.chmod(abs, e.mode === '100755' ? 0o755 : 0o644);
    }
    const idx = new Map<string, IndexEntry>();
    for (const [path, e] of target) idx.set(path, { oid: e.oid, mode: e.mode });
    this.writeIndex(idx);
  }

  private pruneEmptyDirs(path: string): void {
    const parts = path.split('/').slice(0, -1);
    while (parts.length) {
      const abs = join(this.root, parts.join('/'));
      try {
        if (this.fs.readdir(abs).length) return;
        this.fs.rmdir(abs);
      } catch {
        return;
      }
      parts.pop();
    }
  }

  // ── config ──

  private configFiles(): string[] {
    const home = this.homeDir();
    return [home ? join(home, '.gitconfig') : '', this.p('config')].filter(Boolean);
  }

  homeDir: () => string | null = () => null;

  readConfig(file: string): Map<string, string> {
    return this.fs.stat(file)?.type === 'f' ? parseConfig(this.fs.readFile(file)) : new Map();
  }

  config(key: string): string | undefined {
    let v: string | undefined;
    for (const f of this.configFiles()) {
      const m = this.readConfig(f);
      if (m.has(key.toLowerCase()) || m.has(key)) v = m.get(key.toLowerCase()) ?? m.get(key);
    }
    return v;
  }

  setConfig(key: string, value: string | null, global = false): void {
    const home = this.homeDir();
    const file = global && home ? join(home, '.gitconfig') : this.p('config');
    const m = this.readConfig(file);
    const i = key.lastIndexOf('.');
    const norm = key.slice(0, key.indexOf('.')).toLowerCase() + key.slice(key.indexOf('.'), i) + '.' + key.slice(i + 1).toLowerCase();
    if (value === null) m.delete(norm);
    else m.set(norm, value);
    this.fs.writeFile(file, serializeConfig(m));
  }

  identity(strict = true): { name: string; email: string } | null {
    const name = this.config('user.name');
    const email = this.config('user.email');
    if (name && email) return { name, email };
    if (strict) {
      throw new GitError(
        `Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account's default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address`,
      );
    }
    return null;
  }

  person(): Person {
    const id = this.identity(true)!;
    return { ...id, time: this.clock(), tz: '+0000' };
  }
}
