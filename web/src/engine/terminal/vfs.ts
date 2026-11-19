// A virtual file system with inodes, permissions and users, enough for the
// shell lessons: hard links share an inode, a directory needs x to be
// entered and w+x to create or delete in it, the sticky bit protects /tmp,
// root bypasses read/write checks but not the x bit of regular files.

import type { Cred, FileType, FsApi, FsErrorCode, Stat } from '../../core/types';

export const ROOT_CRED: Cred = { uid: 0, gid: 0, groups: [0] };

/**
 * Credentials as the kernel sees them: uid/gid plus the capabilities that let
 * root skip checks (capabilities(7)). A missing flag means "has it" for uid 0,
 * so plain Cred objects keep the old behaviour.
 */
export interface KCred extends Cred {
  /** CAP_DAC_OVERRIDE: skip rwx checks. */
  dac?: boolean;
  /** CAP_DAC_READ_SEARCH: skip read checks on files and read/search checks on directories. */
  dacRead?: boolean;
  /** CAP_FOWNER: chmod and utimes on files of other users. */
  fowner?: boolean;
  /** CAP_CHOWN: change the owner of a file. */
  chown?: boolean;
}

const hasCap = (cred: Cred, cap: 'dac' | 'dacRead' | 'fowner' | 'chown') => cred.uid === 0 && (cred as KCred)[cap] !== false;

/** Character and block devices the simulator knows. `blk:<name>` is a block device. */
export type DevKind = 'null' | 'tty' | 'zero' | 'whiteout' | `blk:${string}`;

/** Major, minor numbers as ls -l prints them. */
export function devNumbers(dev: DevKind | undefined): string {
  switch (dev) {
    case 'null':
      return '1, 3';
    case 'zero':
      return '1, 5';
    case 'tty':
      return '5, 0';
    case 'whiteout':
      return '0, 0';
    default:
      if (dev?.startsWith('blk:')) {
        const name = dev.slice(4);
        const m = /^sd([a-z])(\d*)$/.exec(name);
        if (m) return `8, ${(m[1].charCodeAt(0) - 97) * 16 + Number(m[2] || 0)}`;
        return '7, 0';
      }
      return '0, 0';
  }
}

/** Kernel-side hooks: virtual files (cgroupfs, procfs) validate and react to writes. */
export interface VfsHooks {
  /**
   * Called before a write. Return undefined to write as usual, 'skip' to ignore
   * the write (the truncation step of `>` on a control file), or a string to
   * store instead of `data`. Throw an FsError to reject it.
   */
  beforeWrite?(abs: string, data: string, append: boolean, cred: Cred): string | 'skip' | undefined;
  afterMkdir?(abs: string, cred: Cred): void;
  /** Return true when the hook removed the directory itself. */
  beforeRmdir?(abs: string, cred: Cred): boolean;
}

const MESSAGES: Record<FsErrorCode, string> = {
  ENOENT: 'No such file or directory',
  EACCES: 'Permission denied',
  EPERM: 'Operation not permitted',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  EEXIST: 'File exists',
  ENOTEMPTY: 'Directory not empty',
  EINVAL: 'Invalid argument',
  ELOOP: 'Too many levels of symbolic links',
  EBUSY: 'Device or resource busy',
};

export class FsError extends Error {
  constructor(
    public code: FsErrorCode,
    public path: string,
  ) {
    super(MESSAGES[code]);
  }
  /** The text coreutils print after the path: "No such file or directory". */
  get text(): string {
    return MESSAGES[this.code];
  }
}

export function isFsError(e: unknown): e is FsError {
  return e instanceof FsError;
}

interface Inode {
  ino: number;
  type: FileType;
  mode: number;
  uid: number;
  gid: number;
  mtime: number;
  nlink: number;
  data?: string;
  entries?: Map<string, number>;
  target?: string;
  /** Character devices: 'null' discards writes, 'zero'/'tty' read empty; 'whiteout' marks a deleted overlay file; 'blk:*' is a disk. */
  dev?: DevKind;
}

export interface VfsSnapshot {
  next: number;
  inodes: (Omit<Inode, 'entries'> & { entries?: [string, number][] })[];
}

/** Normalise an absolute path: collapse //, ., .. (without resolving symlinks). */
export function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}

export function joinPath(cwd: string, path: string): string {
  return path.startsWith('/') ? path : `${cwd.replace(/\/$/, '')}/${path}`;
}

export function basename(p: string): string {
  const n = normalize(p);
  return n === '/' ? '/' : n.slice(n.lastIndexOf('/') + 1);
}

export function dirname(p: string): string {
  const n = normalize(p);
  const i = n.lastIndexOf('/');
  return i <= 0 ? '/' : n.slice(0, i);
}

export function modeString(type: FileType, mode: number): string {
  const t = type === 'd' ? 'd' : type === 'l' ? 'l' : type === 'c' ? 'c' : '-';
  const bits = 'rwxrwxrwx';
  let s = '';
  for (let i = 0; i < 9; i++) s += mode & (1 << (8 - i)) ? bits[i] : '-';
  const arr = s.split('');
  if (mode & 0o4000) arr[2] = arr[2] === 'x' ? 's' : 'S';
  if (mode & 0o2000) arr[5] = arr[5] === 'x' ? 's' : 'S';
  if (mode & 0o1000) arr[8] = arr[8] === 'x' ? 't' : 'T';
  return t + arr.join('');
}

export function octal(mode: number): string {
  return (mode & 0o7777).toString(8).padStart(4, '0');
}

export class Vfs {
  private inodes = new Map<number, Inode>();
  private next = 2;
  umask = 0o022;
  clock: () => number = () => Date.now();
  hooks: VfsHooks = {};

  constructor() {
    this.inodes.set(1, { ino: 1, type: 'd', mode: 0o755, uid: 0, gid: 0, mtime: this.clock(), nlink: 2, entries: new Map() });
  }

  // ── internals ──
  private node(ino: number): Inode {
    const n = this.inodes.get(ino);
    if (!n) throw new Error(`dangling inode ${ino}`);
    return n;
  }

  private can(n: Inode, cred: Cred, want: 'r' | 'w' | 'x'): boolean {
    if (hasCap(cred, 'dacRead') && (want === 'r' || (want === 'x' && n.type === 'd'))) return true;
    if (hasCap(cred, 'dac')) {
      if (want !== 'x' || n.type === 'd') return true;
      return (n.mode & 0o111) !== 0;
    }
    const shift = cred.uid === n.uid ? 6 : cred.gid === n.gid || cred.groups.includes(n.gid) ? 3 : 0;
    const bit = want === 'r' ? 4 : want === 'w' ? 2 : 1;
    return (n.mode & (bit << shift)) !== 0;
  }

  /**
   * Walk an absolute path. Returns the inode (or undefined for a missing last
   * component), its parent directory and the final name.
   */
  private walk(abs: string, cred: Cred, follow: boolean, depth = 0): { node?: Inode; parent: Inode; name: string; path: string } {
    if (depth > 40) throw new FsError('ELOOP', abs);
    const parts = normalize(abs).split('/').filter(Boolean);
    let dir = this.node(1);
    let parent = dir;
    let curPath = '';
    if (parts.length === 0) return { node: dir, parent: dir, name: '/', path: '/' };
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const last = i === parts.length - 1;
      if (dir.type !== 'd') throw new FsError('ENOTDIR', curPath || '/');
      if (!this.can(dir, cred, 'x')) throw new FsError('EACCES', curPath + '/' + name);
      parent = dir;
      const ino = dir.entries!.get(name);
      curPath += '/' + name;
      if (ino === undefined) {
        if (!last) throw new FsError('ENOENT', curPath);
        return { node: undefined, parent, name, path: curPath };
      }
      let n = this.node(ino);
      if (n.type === 'l' && (!last || follow)) {
        const target = joinPath(dirname(curPath), n.target!);
        const rest = parts.slice(i + 1).join('/');
        return this.walk(rest ? `${target}/${rest}` : target, cred, follow, depth + 1);
      }
      if (last) return { node: n, parent, name, path: curPath };
      dir = n;
    }
    return { node: dir, parent, name: parts[parts.length - 1], path: curPath };
  }

  private need(abs: string, cred: Cred, follow = true): Inode {
    const r = this.walk(abs, cred, follow);
    if (!r.node) throw new FsError('ENOENT', abs);
    return r.node;
  }

  private alloc(n: Omit<Inode, 'ino'>): Inode {
    const ino = this.next++;
    const node = { ino, ...n };
    this.inodes.set(ino, node);
    return node;
  }

  private checkSticky(parent: Inode, child: Inode, cred: Cred, path: string): void {
    if (parent.mode & 0o1000 && !hasCap(cred, 'fowner') && cred.uid !== child.uid && cred.uid !== parent.uid) throw new FsError('EPERM', path);
  }

  private dropLink(n: Inode): void {
    n.nlink -= n.type === 'd' ? 2 : 1;
    if (n.nlink <= 0) this.inodes.delete(n.ino);
  }

  // ── public API with explicit credentials and absolute paths ──

  statAs(abs: string, cred: Cred, follow = true): Stat | null {
    try {
      const n = this.need(abs, cred, follow);
      return this.toStat(n);
    } catch (e) {
      if (isFsError(e) && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return null;
      throw e;
    }
  }

  private toStat(n: Inode): Stat & { rdev?: string; dev?: DevKind } {
    const st: Stat & { rdev?: string; dev?: DevKind } = { ino: n.ino, type: n.type, mode: n.mode, uid: n.uid, gid: n.gid, size: this.size(n), nlink: n.nlink, mtime: n.mtime, target: n.target };
    if (n.type === 'c') {
      st.rdev = devNumbers(n.dev);
      st.dev = n.dev;
    }
    return st;
  }

  private size(n: Inode): number {
    if (n.type === 'd') return 4096;
    if (n.type === 'l') return n.target!.length;
    if (n.type === 'c') return 0;
    return new TextEncoder().encode(n.data ?? '').length;
  }

  readFileAs(abs: string, cred: Cred): string {
    const n = this.need(abs, cred);
    if (n.type === 'd') throw new FsError('EISDIR', abs);
    if (!this.can(n, cred, 'r')) throw new FsError('EACCES', abs);
    if (n.type === 'c') return '';
    return n.data ?? '';
  }

  writeFileAs(abs: string, data: string, cred: Cred, opts: { append?: boolean; mode?: number } = {}): void {
    const r = this.walk(abs, cred, true);
    const hooked = this.hooks.beforeWrite?.(normalize(r.path ?? abs), data, !!opts.append, cred);
    if (hooked === 'skip') return;
    if (hooked !== undefined) {
      data = hooked;
      opts = { ...opts, append: false };
    }
    if (r.node) {
      if (r.node.type === 'd') throw new FsError('EISDIR', abs);
      if (!this.can(r.node, cred, 'w')) throw new FsError('EACCES', abs);
      if (r.node.type === 'c') return;
      r.node.data = opts.append ? (r.node.data ?? '') + data : data;
      r.node.mtime = this.clock();
      return;
    }
    if (r.parent.type !== 'd') throw new FsError('ENOTDIR', abs);
    if (!this.can(r.parent, cred, 'w')) throw new FsError('EACCES', abs);
    const mode = (opts.mode ?? 0o666) & ~this.umask;
    // A setgid directory gives new files its own group (chmod(1), "SETUID AND SETGID BITS").
    const gid = r.parent.mode & 0o2000 ? r.parent.gid : cred.gid;
    const n = this.alloc({ type: 'f', mode, uid: cred.uid, gid, mtime: this.clock(), nlink: 1, data });
    r.parent.entries!.set(r.name, n.ino);
    r.parent.mtime = this.clock();
  }

  mkdirAs(abs: string, cred: Cred, opts: { parents?: boolean; mode?: number } = {}): void {
    const norm = normalize(abs);
    if (opts.parents) {
      const parts = norm.split('/').filter(Boolean);
      let p = '';
      for (const part of parts) {
        p += '/' + part;
        const st = this.statAs(p, cred);
        if (st) {
          if (st.type !== 'd') throw new FsError('ENOTDIR', p);
          continue;
        }
        this.mkdirAs(p, cred, { mode: opts.mode });
      }
      return;
    }
    const r = this.walk(norm, cred, false);
    if (r.node) throw new FsError('EEXIST', abs);
    if (!this.can(r.parent, cred, 'w')) throw new FsError('EACCES', abs);
    const sgid = r.parent.mode & 0o2000;
    const mode = ((opts.mode ?? 0o777) & ~this.umask) | sgid;
    const n = this.alloc({ type: 'd', mode, uid: cred.uid, gid: sgid ? r.parent.gid : cred.gid, mtime: this.clock(), nlink: 2, entries: new Map() });
    r.parent.entries!.set(r.name, n.ino);
    r.parent.nlink++;
    r.parent.mtime = this.clock();
    this.hooks.afterMkdir?.(norm, cred);
  }

  readdirAs(abs: string, cred: Cred): string[] {
    const n = this.need(abs, cred);
    if (n.type !== 'd') throw new FsError('ENOTDIR', abs);
    if (!this.can(n, cred, 'r')) throw new FsError('EACCES', abs);
    return [...n.entries!.keys()].sort();
  }

  unlinkAs(abs: string, cred: Cred): void {
    const r = this.walk(abs, cred, false);
    if (!r.node) throw new FsError('ENOENT', abs);
    if (r.node.type === 'd') throw new FsError('EISDIR', abs);
    if (!this.can(r.parent, cred, 'w') || !this.can(r.parent, cred, 'x')) throw new FsError('EACCES', abs);
    this.checkSticky(r.parent, r.node, cred, abs);
    r.parent.entries!.delete(r.name);
    r.parent.mtime = this.clock();
    this.dropLink(r.node);
  }

  rmdirAs(abs: string, cred: Cred): void {
    const r = this.walk(abs, cred, false);
    if (!r.node) throw new FsError('ENOENT', abs);
    if (r.node.ino === 1) throw new FsError('EBUSY', abs);
    if (r.node.type !== 'd') throw new FsError('ENOTDIR', abs);
    if (this.hooks.beforeRmdir?.(normalize(abs), cred)) return;
    if (r.node.entries!.size) throw new FsError('ENOTEMPTY', abs);
    if (!this.can(r.parent, cred, 'w')) throw new FsError('EACCES', abs);
    this.checkSticky(r.parent, r.node, cred, abs);
    r.parent.entries!.delete(r.name);
    r.parent.nlink--;
    this.inodes.delete(r.node.ino);
  }

  renameAs(from: string, to: string, cred: Cred): void {
    const a = this.walk(from, cred, false);
    if (!a.node) throw new FsError('ENOENT', from);
    let b = this.walk(to, cred, false);
    if (b.node?.type === 'd') b = this.walk(`${normalize(to)}/${a.name}`, cred, false);
    if (!this.can(a.parent, cred, 'w') || !this.can(b.parent, cred, 'w')) throw new FsError('EACCES', from);
    this.checkSticky(a.parent, a.node, cred, from);
    if (b.node) {
      if (b.node.type === 'd') throw new FsError('EISDIR', to);
      this.dropLink(b.node);
    }
    a.parent.entries!.delete(a.name);
    b.parent.entries!.set(b.name, a.node.ino);
    if (a.node.type === 'd' && a.parent !== b.parent) {
      a.parent.nlink--;
      b.parent.nlink++;
    }
  }

  symlinkAs(target: string, abs: string, cred: Cred): void {
    const r = this.walk(abs, cred, false);
    if (r.node) throw new FsError('EEXIST', abs);
    if (!this.can(r.parent, cred, 'w')) throw new FsError('EACCES', abs);
    const n = this.alloc({ type: 'l', mode: 0o777, uid: cred.uid, gid: cred.gid, mtime: this.clock(), nlink: 1, target });
    r.parent.entries!.set(r.name, n.ino);
  }

  linkAs(existing: string, abs: string, cred: Cred): void {
    const src = this.need(existing, cred, false);
    if (src.type === 'd') throw new FsError('EPERM', existing);
    const r = this.walk(abs, cred, false);
    if (r.node) throw new FsError('EEXIST', abs);
    if (!this.can(r.parent, cred, 'w')) throw new FsError('EACCES', abs);
    r.parent.entries!.set(r.name, src.ino);
    src.nlink++;
  }

  readlinkAs(abs: string, cred: Cred): string {
    const n = this.need(abs, cred, false);
    if (n.type !== 'l') throw new FsError('EINVAL', abs);
    return n.target!;
  }

  chmodAs(abs: string, mode: number, cred: Cred): void {
    const n = this.need(abs, cred);
    if (!hasCap(cred, 'fowner') && cred.uid !== n.uid) throw new FsError('EPERM', abs);
    n.mode = mode & 0o7777;
  }

  chownAs(abs: string, uid: number, gid: number, cred: Cred): void {
    const n = this.need(abs, cred);
    if (!hasCap(cred, 'chown')) {
      // An owner may change the group to one of their own groups; changing the owner needs root.
      if (uid !== n.uid || cred.uid !== n.uid || !(cred.gid === gid || cred.groups.includes(gid))) throw new FsError('EPERM', abs);
    }
    n.uid = uid;
    n.gid = gid;
  }

  utimesAs(abs: string, mtime: number, cred: Cred): void {
    const n = this.need(abs, cred);
    if (!hasCap(cred, 'fowner') && cred.uid !== n.uid && !this.can(n, cred, 'w')) throw new FsError('EACCES', abs);
    n.mtime = mtime;
  }

  accessAs(abs: string, mode: 'r' | 'w' | 'x', cred: Cred): boolean {
    try {
      return this.can(this.need(abs, cred), cred, mode);
    } catch {
      return false;
    }
  }

  /** Create a device node: /dev/null, /dev/tty, /dev/zero, a disk ('blk:sdb') or an overlay whiteout. */
  mknod(abs: string, dev: DevKind, opts: { mode?: number; uid?: number; gid?: number } = {}): void {
    const r = this.walk(abs, ROOT_CRED, false);
    if (r.node) return;
    const mode = opts.mode ?? (dev === 'whiteout' ? 0 : dev.startsWith('blk:') ? 0o660 : 0o666);
    const n = this.alloc({ type: 'c', mode, uid: opts.uid ?? 0, gid: opts.gid ?? 0, mtime: this.clock(), nlink: 1, dev });
    r.parent.entries!.set(r.name, n.ino);
  }

  /** The device kind of a node, without following a symlink. */
  devOf(abs: string): DevKind | undefined {
    try {
      return this.need(abs, ROOT_CRED, false).dev;
    } catch {
      return undefined;
    }
  }

  // ── mounting: a mount replaces the directory entry of the mount point ──

  /** Inode number a path resolves to (following symlinks), or undefined. */
  inoOf(abs: string): number | undefined {
    try {
      return this.need(abs, ROOT_CRED, true).ino;
    } catch {
      return undefined;
    }
  }

  /** A fresh, detached, empty directory (the root of a new file system). */
  newDir(mode = 0o755, uid = 0, gid = 0): number {
    return this.alloc({ type: 'd', mode, uid, gid, mtime: this.clock(), nlink: 2, entries: new Map() }).ino;
  }

  /** Whether an inode still exists (detached trees stay alive while a mount table refers to them). */
  hasIno(ino: number): boolean {
    return this.inodes.has(ino);
  }

  /**
   * Put the directory `ino` in place of the directory at `abs` and return the
   * inode that was there. The old tree is hidden, not deleted.
   */
  swapDir(abs: string, ino: number): number {
    const norm = normalize(abs);
    if (norm === '/') throw new FsError('EBUSY', abs);
    const r = this.walk(norm, ROOT_CRED, true);
    if (!r.node) throw new FsError('ENOENT', abs);
    if (r.node.type !== 'd') throw new FsError('ENOTDIR', abs);
    const parentPath = dirname(r.path);
    const parent = this.need(parentPath, ROOT_CRED, true);
    const old = r.node.ino;
    parent.entries!.set(basename(r.path), ino);
    return old;
  }

  /** Deep copy of a tree into a new detached tree (used to materialise an overlay). */
  cloneTree(ino: number): number {
    const src = this.node(ino);
    const copy = this.alloc({ type: src.type, mode: src.mode, uid: src.uid, gid: src.gid, mtime: src.mtime, nlink: src.type === 'd' ? 2 : 1, data: src.data, target: src.target, dev: src.dev, entries: src.type === 'd' ? new Map() : undefined });
    if (src.type === 'd') for (const [name, child] of src.entries!) copy.entries!.set(name, this.cloneTree(child));
    return copy.ino;
  }

  /** Every path below a directory inode, relative to it, with stats and text. */
  listFrom(ino: number): { rel: string; stat: Stat & { dev?: DevKind }; text?: string }[] {
    const out: { rel: string; stat: Stat & { dev?: DevKind }; text?: string }[] = [];
    const visit = (i: number, rel: string) => {
      const n = this.node(i);
      if (rel) out.push({ rel, stat: this.toStat(n), text: n.type === 'f' ? n.data : undefined });
      if (n.type === 'd') for (const [name, child] of n.entries!) visit(child, rel ? `${rel}/${name}` : name);
    };
    visit(ino, '');
    return out;
  }

  /** Total size of the files under a path, as du counts it (4 KiB blocks per file). */
  usage(abs: string): number {
    const ino = this.inoOf(abs);
    if (ino === undefined) return 0;
    let total = 0;
    const seen = new Set<number>();
    const visit = (i: number) => {
      if (seen.has(i)) return;
      seen.add(i);
      const n = this.node(i);
      total += n.type === 'd' ? 4096 : Math.ceil(this.size(n) / 4096) * 4096;
      if (n.type === 'd') for (const child of n.entries!.values()) visit(child);
    };
    visit(ino);
    return total;
  }

  /** Every path with its inode, for facts and `find`. Does not follow symlinks. */
  list(): { path: string; stat: Stat; text?: string }[] {
    const out: { path: string; stat: Stat; text?: string }[] = [];
    const visit = (ino: number, path: string) => {
      const n = this.node(ino);
      out.push({ path, stat: this.toStat(n), text: n.type === 'f' ? n.data : undefined });
      if (n.type === 'd') for (const [name, child] of n.entries!) visit(child, path === '/' ? `/${name}` : `${path}/${name}`);
    };
    visit(1, '/');
    return out;
  }

  /** A view bound to a user and a working directory: what a command gets as ctx.fs. */
  view(cred: Cred, cwd: () => string, root: () => string = () => '/'): FsApi {
    const inner = (p: string) => normalize(joinPath(cwd(), p));
    const r0 = root();
    if (r0 !== '/') return this.chrootView(cred, inner, r0);
    const abs = inner;
    return {
      resolve: abs,
      exists: (p) => this.statAs(abs(p), cred, false) !== null,
      stat: (p) => this.statAs(abs(p), cred, true),
      lstat: (p) => this.statAs(abs(p), cred, false),
      readFile: (p) => this.readFileAs(abs(p), cred),
      writeFile: (p, d, o) => this.writeFileAs(abs(p), d, cred, o),
      mkdir: (p, o) => this.mkdirAs(abs(p), cred, o),
      readdir: (p) => this.readdirAs(abs(p), cred),
      unlink: (p) => this.unlinkAs(abs(p), cred),
      rmdir: (p) => this.rmdirAs(abs(p), cred),
      rename: (a, b) => this.renameAs(abs(a), abs(b), cred),
      symlink: (t, p) => this.symlinkAs(t, abs(p), cred),
      link: (a, b) => this.linkAs(abs(a), abs(b), cred),
      readlink: (p) => this.readlinkAs(abs(p), cred),
      chmod: (p, m) => this.chmodAs(abs(p), m, cred),
      chown: (p, u, g) => this.chownAs(abs(p), u, g, cred),
      utimes: (p, t) => this.utimesAs(abs(p), t, cred),
      access: (p, m) => this.accessAs(abs(p), m, cred),
    };
  }

  /** A view whose "/" is `root` (chroot): paths are inner, errors name inner paths. */
  private chrootView(cred: Cred, inner: (p: string) => string, root: string): FsApi {
    const outer = (p: string) => normalize(root + inner(p));
    const strip = (e: unknown) => {
      if (isFsError(e) && e.path.startsWith(root)) e.path = e.path.slice(root.length) || '/';
      throw e;
    };
    const wrap =
      <A extends unknown[], R>(fn: (...a: A) => R) =>
      (...a: A): R => {
        try {
          return fn(...a);
        } catch (e) {
          return strip(e);
        }
      };
    return {
      resolve: inner,
      exists: wrap((p) => this.statAs(outer(p), cred, false) !== null),
      stat: wrap((p) => this.statAs(outer(p), cred, true)),
      lstat: wrap((p) => this.statAs(outer(p), cred, false)),
      readFile: wrap((p) => this.readFileAs(outer(p), cred)),
      writeFile: wrap((p, d, o) => this.writeFileAs(outer(p), d, cred, o)),
      mkdir: wrap((p, o) => this.mkdirAs(outer(p), cred, o)),
      readdir: wrap((p) => this.readdirAs(outer(p), cred)),
      unlink: wrap((p) => this.unlinkAs(outer(p), cred)),
      rmdir: wrap((p) => this.rmdirAs(outer(p), cred)),
      rename: wrap((a, b) => this.renameAs(outer(a), outer(b), cred)),
      symlink: wrap((t, p) => this.symlinkAs(t, outer(p), cred)),
      link: wrap((a, b) => this.linkAs(outer(a), outer(b), cred)),
      readlink: wrap((p) => this.readlinkAs(outer(p), cred)),
      chmod: wrap((p, m) => this.chmodAs(outer(p), m, cred)),
      chown: wrap((p, u, g) => this.chownAs(outer(p), u, g, cred)),
      utimes: wrap((p, t) => this.utimesAs(outer(p), t, cred)),
      access: (p, m) => this.accessAs(outer(p), m, cred),
    };
  }

  snapshot(): VfsSnapshot {
    return {
      next: this.next,
      inodes: [...this.inodes.values()].map((n) => ({ ...n, entries: n.entries ? [...n.entries] : undefined })),
    };
  }

  restore(s: VfsSnapshot): void {
    this.inodes = new Map(s.inodes.map((n) => [n.ino, { ...n, entries: n.entries ? new Map(n.entries) : undefined }]));
    this.next = s.next;
  }
}
