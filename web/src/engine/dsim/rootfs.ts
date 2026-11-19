// The file system a container sees (04 §11.1): image layers merged with the
// writable layer, with volumes, bind mounts and tmpfs mounted on top. A
// command inside the container runs on its own SimMachine built from this
// view; afterwards the changes are sorted back where they belong: the upper
// layer, a volume, the host directory of a bind mount or a tmpfs.

import type { FsApi } from '../../core/types';
import { applyDiff, diff, dir, merge, type LayerEntry, type LayerFiles } from './layers';
import type { ContainerRec, DockerSnapshot, MountRec } from './state';

export function imageOf(st: DockerSnapshot, id: string) {
  return st.images.find((i) => i.id === id);
}

/** The lower layers of a container: its image's layers, bottom-up. */
export function lowerLayers(st: DockerSnapshot, c: ContainerRec): LayerFiles[] {
  if (c.buildLayers) return c.buildLayers.map((d) => st.layers[d]?.files ?? {});
  const img = imageOf(st, c.imageId);
  if (!img) return [];
  return img.layers.map((d) => st.layers[d]?.files ?? {});
}

export function lowerMerged(st: DockerSnapshot, c: ContainerRec): LayerFiles {
  return merge(lowerLayers(st, c));
}

/** Lower layers + upper: what `ls /` shows before mounts are added. */
export function rootMerged(st: DockerSnapshot, c: ContainerRec): LayerFiles {
  return merge([...lowerLayers(st, c), c.upper]);
}

/** Read a host directory tree into layer entries (paths relative to `root`, starting with /). */
export function readHostTree(fs: FsApi, root: string): LayerFiles {
  const out: LayerFiles = {};
  const walk = (abs: string, rel: string) => {
    const st = fs.lstat(abs);
    if (!st) return;
    if (st.type === 'd') {
      if (rel) out[rel] = dir({ mode: st.mode & 0o7777, uid: st.uid, gid: st.gid });
      for (const n of fs.readdir(abs)) walk(abs === '/' ? `/${n}` : `${abs}/${n}`, `${rel}/${n}`);
    } else if (st.type === 'l') out[rel] = { t: 'l', mode: 0o777, uid: st.uid, gid: st.gid, size: 0, target: fs.readlink(abs) };
    else if (st.type === 'f') {
      let text = '';
      try {
        text = fs.readFile(abs);
      } catch {
        text = '';
      }
      out[rel] = { t: 'f', mode: st.mode & 0o7777, uid: st.uid, gid: st.gid, size: st.size, text };
    }
  };
  walk(root, '');
  return out;
}

/** Prefix every path of a tree with a mount target. */
function under(target: string, tree: LayerFiles): LayerFiles {
  const out: LayerFiles = {};
  for (const [p, e] of Object.entries(tree)) out[target + p] = e;
  return out;
}

/** The subtree of `files` under `target`, re-rooted at /. */
export function subtree(files: LayerFiles, target: string): LayerFiles {
  const out: LayerFiles = {};
  const pre = target + '/';
  for (const [p, e] of Object.entries(files)) if (p.startsWith(pre)) out[p.slice(target.length)] = e;
  return out;
}

/** The full view with mounts (mount targets hide what the image has there, as mounts do). */
export function containerView(st: DockerSnapshot, c: ContainerRec, hostFs: FsApi): { files: LayerFiles; mountOf: (p: string) => MountRec | undefined } {
  let files = rootMerged(st, c);
  const mounts = [...c.mounts].sort((a, b) => a.target.length - b.target.length);
  for (const m of mounts) {
    const pre = m.target + '/';
    files = Object.fromEntries(Object.entries(files).filter(([p]) => !p.startsWith(pre)));
    let tree: LayerFiles = {};
    if (m.type === 'volume') tree = st.volumes.find((v) => v.name === m.source)?.files ?? {};
    else if (m.type === 'bind') tree = hostFs.exists(m.source) ? readHostTree(hostFs, m.source) : {};
    else tree = c.tmpfsData[m.target] ?? {};
    const rootEntry = m.type === 'bind' && hostFs.stat(m.source) ? hostFs.stat(m.source)! : null;
    files[m.target] = rootEntry ? dir({ mode: rootEntry.mode & 0o7777, uid: rootEntry.uid, gid: rootEntry.gid }) : (files[m.target]?.t === 'd' ? files[m.target] : dir({ mode: m.type === 'tmpfs' ? 0o1777 : 0o755 }));
    Object.assign(files, under(m.target, tree));
  }
  const mountOf = (p: string) => {
    let best: MountRec | undefined;
    for (const m of mounts) if (p === m.target || p.startsWith(m.target + '/')) best = m;
    return best;
  };
  return { files, mountOf };
}

/**
 * Sort a change set (diff of the container view before and after a command)
 * into the upper layer, volumes, bind-mounted host directories and tmpfs.
 * Returns an error text when the change is not allowed (read-only).
 */
export function commitChanges(st: DockerSnapshot, c: ContainerRec, change: LayerFiles, hostFs: FsApi, mountOf: (p: string) => MountRec | undefined): void {
  const toUpper: LayerFiles = {};
  for (const [p, e] of Object.entries(change)) {
    const m = mountOf(p);
    if (!m || p === m.target) {
      if (!m) toUpper[p] = e;
      // chmod/chown of a bind mount's root changes the host directory itself
      else if (m.type === 'bind' && e.t === 'd' && !m.ro) writeHost(hostFs, m.source, e);
      continue;
    }
    const rel = p.slice(m.target.length);
    if (m.type === 'volume') {
      const v = st.volumes.find((x) => x.name === m.source);
      if (!v) continue;
      if (e.t === 'w') for (const k of Object.keys(v.files)) if (k === rel || k.startsWith(rel + '/')) delete v.files[k];
      if (e.t !== 'w') v.files[rel] = e;
    } else if (m.type === 'tmpfs') {
      const t = (c.tmpfsData[m.target] ??= {});
      if (e.t === 'w') {
        for (const k of Object.keys(t)) if (k === rel || k.startsWith(rel + '/')) delete t[k];
      } else t[rel] = e;
    } else writeHost(hostFs, m.source + rel, e);
  }
  if (Object.keys(toUpper).length) c.upper = applyDiff(c.upper, toUpper, lowerMerged(st, c));
}

function writeHost(fs: FsApi, path: string, e: LayerEntry): void {
  try {
    if (e.t === 'w') {
      removeHost(fs, path);
      return;
    }
    if (e.t === 'd') {
      if (!fs.exists(path)) fs.mkdir(path, { parents: true });
      fs.chmod(path, e.mode);
    } else if (e.t === 'l') {
      if (fs.lstat(path)) fs.unlink(path);
      fs.symlink(e.target ?? '', path);
      return;
    } else {
      fs.writeFile(path, e.text ?? '');
      fs.chmod(path, e.mode);
    }
    // a bind mount keeps numeric owners: what uid 1001 creates inside belongs to uid 1001 outside
    fs.chown(path, e.uid, e.gid);
  } catch {
    /* the host refused: nothing to write back */
  }
}

function removeHost(fs: FsApi, path: string): void {
  const st = fs.lstat(path);
  if (!st) return;
  if (st.type === 'd') {
    for (const n of fs.readdir(path)) removeHost(fs, `${path}/${n}`);
    fs.rmdir(path);
  } else fs.unlink(path);
}

/** `docker diff`: A added, C changed, D deleted, relative to the image. */
export function dockerDiff(st: DockerSnapshot, c: ContainerRec): string[] {
  const lower = lowerMerged(st, c);
  const out: string[] = [];
  const ups = Object.keys(c.upper).sort();
  const changedDirs = new Set<string>();
  for (const p of ups) {
    const parts = p.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) changedDirs.add('/' + parts.slice(0, i).join('/'));
  }
  const lines = new Map<string, string>();
  for (const d of changedDirs) if (d in lower) lines.set(d, `C ${d}`);
  for (const p of ups) {
    const e = c.upper[p];
    if (e.t === 'w') lines.set(p, `D ${p}`);
    else if (p in lower) {
      if (e.t !== 'd') lines.set(p, `C ${p}`);
    } else lines.set(p, `A ${p}`);
  }
  for (const k of [...lines.keys()].sort()) out.push(lines.get(k)!);
  return out;
}

export { diff };
