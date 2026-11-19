// Bare repositories of git.lab. Everything lives in memory (pack building
// is synchronous); a persistence backend (IndexedDB in the browser) gets
// every change and fills the store again on the next visit.

import { parseCommit, parseTree, tagTarget, type GitObject } from './objects';

export interface RepoMeta {
  name: string;
  /** Symbolic HEAD target, e.g. 'refs/heads/main'. */
  head: string;
  refs: Record<string, string>;
  hooks: { id: number; url: string; events: string[] }[];
  createdAt: string;
  description?: string;
}

export interface GitPersistence {
  loadAll(): Promise<{ repos: RepoMeta[]; objects: { repo: string; oid: string; obj: GitObject }[] }>;
  saveRepo(meta: RepoMeta): Promise<void>;
  saveObjects(repo: string, objs: [string, GitObject][]): Promise<void>;
  deleteRepo(name: string): Promise<void>;
}

export const REPO_NAME = /^[a-z0-9][a-z0-9._-]{0,62}(\/[a-z0-9][a-z0-9._-]{0,62})?$/;

export class GitStore {
  private meta = new Map<string, RepoMeta>();
  private objects = new Map<string, Map<string, GitObject>>();

  constructor(private persist?: GitPersistence) {}

  async load(): Promise<void> {
    if (!this.persist) return;
    const all = await this.persist.loadAll();
    for (const m of all.repos) {
      this.meta.set(m.name, m);
      this.objects.set(m.name, new Map());
    }
    for (const o of all.objects) this.objects.get(o.repo)?.set(o.oid, o.obj);
  }

  list(): RepoMeta[] {
    return [...this.meta.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name: string): RepoMeta | undefined {
    return this.meta.get(name);
  }

  create(name: string, o: { description?: string; head?: string } = {}): RepoMeta {
    if (!REPO_NAME.test(name)) throw new Error(`bad repository name: ${name}`);
    const existing = this.meta.get(name);
    if (existing) return existing;
    const m: RepoMeta = { name, head: o.head ?? 'refs/heads/main', refs: {}, hooks: [], createdAt: new Date().toISOString(), description: o.description };
    this.meta.set(name, m);
    this.objects.set(name, new Map());
    void this.persist?.saveRepo(m);
    return m;
  }

  delete(name: string): void {
    this.meta.delete(name);
    this.objects.delete(name);
    void this.persist?.deleteRepo(name);
  }

  saveMeta(name: string): void {
    const m = this.meta.get(name);
    if (m) void this.persist?.saveRepo(m);
  }

  object(repo: string, oid: string): GitObject | undefined {
    return this.objects.get(repo)?.get(oid);
  }

  has(repo: string, oid: string): boolean {
    return !!this.objects.get(repo)?.has(oid);
  }

  putObjects(repo: string, objs: Map<string, GitObject>): void {
    const store = this.objects.get(repo);
    if (!store) throw new Error(`no repository ${repo}`);
    const fresh: [string, GitObject][] = [];
    for (const [oid, o] of objs)
      if (!store.has(oid)) {
        store.set(oid, o);
        fresh.push([oid, o]);
      }
    if (fresh.length) void this.persist?.saveObjects(repo, fresh);
  }

  objectCount(repo: string): number {
    return this.objects.get(repo)?.size ?? 0;
  }

  /** Every object reachable from `tips`, minus those reachable from `stop`. */
  reachable(repo: string, tips: string[], stop: string[] = []): string[] {
    const exclude = new Set<string>();
    const walk = (start: string[], into: Set<string>, ignore: Set<string>) => {
      const stack = [...start];
      while (stack.length) {
        const oid = stack.pop()!;
        if (into.has(oid) || ignore.has(oid)) continue;
        const o = this.object(repo, oid);
        if (!o) continue;
        into.add(oid);
        if (o.type === 'commit') {
          const c = parseCommit(o.body);
          stack.push(...c.parents, c.tree);
        } else if (o.type === 'tree') {
          for (const e of parseTree(o.body)) if (e.mode !== '160000') stack.push(e.oid);
        } else if (o.type === 'tag') stack.push(tagTarget(o.body));
      }
    };
    walk(stop, exclude, new Set());
    const out = new Set<string>();
    walk(tips, out, exclude);
    return [...out];
  }

  /** Is `ancestor` reachable from `oid` through commit parents? */
  isAncestor(repo: string, ancestor: string, oid: string): boolean {
    const seen = new Set<string>();
    const stack = [oid];
    while (stack.length) {
      const x = stack.pop()!;
      if (x === ancestor) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      const o = this.object(repo, x);
      if (o?.type === 'commit') stack.push(...parseCommit(o.body).parents);
    }
    return false;
  }

  /** Files of a commit: path → blob body. */
  files(repo: string, commit: string): Map<string, Uint8Array> {
    const out = new Map<string, Uint8Array>();
    const c = this.object(repo, commit);
    if (c?.type !== 'commit') return out;
    const walk = (tree: string, prefix: string) => {
      const t = this.object(repo, tree);
      if (t?.type !== 'tree') return;
      for (const e of parseTree(t.body)) {
        if (e.mode === '40000') walk(e.oid, `${prefix}${e.name}/`);
        else if (e.mode !== '160000') {
          const b = this.object(repo, e.oid);
          if (b) out.set(`${prefix}${e.name}`, b.body);
        }
      }
    };
    walk(parseCommit(c.body).tree, '');
    return out;
  }
}

/** IndexedDB persistence for the browser (database 'dt-git'). */
export async function idbPersistence(): Promise<GitPersistence | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  const { openDB } = await import('idb');
  const db = await openDB('dt-git', 1, {
    upgrade(d) {
      d.createObjectStore('repos');
      d.createObjectStore('objects');
    },
  });
  return {
    async loadAll() {
      const repos = (await db.getAll('repos')) as RepoMeta[];
      const keys = (await db.getAllKeys('objects')) as string[];
      const vals = (await db.getAll('objects')) as GitObject[];
      const objects = keys.map((k, i) => {
        const at = k.lastIndexOf('#');
        return { repo: k.slice(0, at), oid: k.slice(at + 1), obj: vals[i] };
      });
      return { repos, objects };
    },
    async saveRepo(m) {
      await db.put('repos', structuredClone(m), m.name);
    },
    async saveObjects(repo, objs) {
      const tx = db.transaction('objects', 'readwrite');
      for (const [oid, o] of objs) void tx.store.put(o, `${repo}#${oid}`);
      await tx.done;
    },
    async deleteRepo(name) {
      await db.delete('repos', name);
      const tx = db.transaction('objects', 'readwrite');
      for (const k of (await tx.store.getAllKeys()) as string[]) if (k.startsWith(`${name}#`)) void tx.store.delete(k);
      await tx.done;
    },
  };
}
