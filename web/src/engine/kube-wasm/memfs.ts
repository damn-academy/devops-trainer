// A minimal in-memory file system with the Node.js callback API that Go's
// GOOS=js runtime (syscall/fs_js.go) calls through globalThis.fs. The control
// plane keeps its PKI files here and kubectl its discovery cache; everything
// lives only as long as the tab.

type Cb<T = unknown> = (err: Error | null, value?: T) => void;

interface Node {
  dir: boolean;
  mode: number;
  data: Uint8Array;
  size: number;
  mtimeMs: number;
  ino: number;
  children?: Map<string, Node>;
}

interface Fd {
  node: Node;
  pos: number;
  append: boolean;
}

const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const constants = { O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_EXCL: 128, O_TRUNC: 512, O_APPEND: 1024, O_DIRECTORY: 65536 };

function fsError(code: string, path = ''): Error {
  const e = new Error(`${code}: ${path}`) as Error & { code: string };
  e.code = code;
  return e;
}

export interface MemFs {
  fs: Record<string, unknown>;
  readFile(path: string): Uint8Array | undefined;
}

export function createMemFs(onOutput: (fd: number, text: string) => void): MemFs {
  let inoSeq = 1;
  const mk = (dir: boolean, mode: number): Node => ({
    dir, mode, data: new Uint8Array(0), size: 0, mtimeMs: Date.now(), ino: inoSeq++,
    children: dir ? new Map() : undefined,
  });
  const root = mk(true, 0o755);
  const fds = new Map<number, Fd>();
  let fdSeq = 100;
  const decoders = new Map<number, { dec: TextDecoder; buf: string }>();

  const split = (p: string) => p.split('/').filter((s) => s && s !== '.');
  function lookup(p: string): Node | undefined {
    let n: Node | undefined = root;
    for (const part of split(p)) {
      if (!n?.dir) return undefined;
      n = part === '..' ? n : n.children!.get(part);
    }
    return n;
  }
  function parent(p: string): [Node, string] {
    const parts = split(p);
    const name = parts.pop();
    const dir = lookup('/' + parts.join('/'));
    if (!name || !dir) throw fsError('ENOENT', p);
    if (!dir.dir) throw fsError('ENOTDIR', p);
    return [dir, name];
  }
  const stat = (n: Node) => ({
    dev: 1, ino: n.ino, mode: (n.dir ? S_IFDIR : S_IFREG) | n.mode, nlink: 1, uid: 0, gid: 0, rdev: 0,
    size: n.size, blksize: 4096, blocks: Math.ceil(n.size / 512),
    atimeMs: n.mtimeMs, mtimeMs: n.mtimeMs, ctimeMs: n.mtimeMs,
    isDirectory: () => n.dir,
  });
  function grow(n: Node, need: number) {
    if (need <= n.data.length) return;
    const next = new Uint8Array(Math.max(need, n.data.length * 2, 256));
    next.set(n.data.subarray(0, n.size));
    n.data = next;
  }
  function emit(fd: number, bytes: Uint8Array) {
    let d = decoders.get(fd);
    if (!d) decoders.set(fd, (d = { dec: new TextDecoder(), buf: '' }));
    d.buf += d.dec.decode(bytes, { stream: true });
    const nl = d.buf.lastIndexOf('\n');
    if (nl >= 0) {
      onOutput(fd, d.buf.slice(0, nl));
      d.buf = d.buf.slice(nl + 1);
    }
  }
  // Runs a synchronous body and reports through a Node-style callback.
  const wrap = <T>(cb: Cb<T>, body: () => T) => {
    let v: T;
    try {
      v = body();
    } catch (e) {
      cb(e as Error);
      return;
    }
    cb(null, v);
  };

  function write(fd: number, buf: Uint8Array, off: number, len: number, pos: number | null): number {
    const chunk = buf.subarray(off, off + len);
    if (fd === 1 || fd === 2) {
      emit(fd, chunk);
      return len;
    }
    const f = fds.get(fd);
    if (!f) throw fsError('EBADF');
    const n = f.node;
    let at = pos ?? (f.append ? n.size : f.pos);
    grow(n, at + len);
    n.data.set(chunk, at);
    at += len;
    if (at > n.size) n.size = at;
    if (pos === null) f.pos = at;
    n.mtimeMs = Date.now();
    return len;
  }

  const fs = {
    constants,
    writeSync(fd: number, buf: Uint8Array) {
      return write(fd, buf, 0, buf.length, null);
    },
    write(fd: number, buf: Uint8Array, off: number, len: number, pos: number | null, cb: Cb<number>) {
      wrap(cb, () => write(fd, buf, off, len, pos));
    },
    read(fd: number, buf: Uint8Array, off: number, len: number, pos: number | null, cb: Cb<number>) {
      wrap(cb, () => {
        const f = fds.get(fd);
        if (!f) throw fsError('EBADF');
        const at = pos ?? f.pos;
        const n = Math.max(0, Math.min(len, f.node.size - at));
        buf.set(f.node.data.subarray(at, at + n), off);
        if (pos === null) f.pos = at + n;
        return n;
      });
    },
    open(path: string, flags: number, mode: number, cb: Cb<number>) {
      wrap(cb, () => {
        let n = lookup(path);
        if (n && flags & constants.O_CREAT && flags & constants.O_EXCL) throw fsError('EEXIST', path);
        if (!n) {
          if (!(flags & constants.O_CREAT)) throw fsError('ENOENT', path);
          const [dir, name] = parent(path);
          n = mk(false, mode & 0o777);
          dir.children!.set(name, n);
        }
        if (flags & constants.O_DIRECTORY && !n.dir) throw fsError('ENOTDIR', path);
        if (flags & constants.O_TRUNC && !n.dir) n.size = 0;
        const fd = fdSeq++;
        fds.set(fd, { node: n, pos: 0, append: !!(flags & constants.O_APPEND) });
        return fd;
      });
    },
    close(fd: number, cb: Cb) {
      wrap(cb, () => void fds.delete(fd));
    },
    fstat(fd: number, cb: Cb) {
      wrap(cb, () => {
        const f = fds.get(fd);
        if (!f) throw fsError('EBADF');
        return stat(f.node);
      });
    },
    stat(path: string, cb: Cb) {
      wrap(cb, () => {
        const n = lookup(path);
        if (!n) throw fsError('ENOENT', path);
        return stat(n);
      });
    },
    lstat(path: string, cb: Cb) {
      fs.stat(path, cb);
    },
    mkdir(path: string, mode: number, cb: Cb) {
      wrap(cb, () => {
        if (lookup(path)) throw fsError('EEXIST', path);
        const [dir, name] = parent(path);
        dir.children!.set(name, mk(true, mode & 0o777));
      });
    },
    readdir(path: string, cb: Cb<string[]>) {
      wrap(cb, () => {
        const n = lookup(path);
        if (!n) throw fsError('ENOENT', path);
        if (!n.dir) throw fsError('ENOTDIR', path);
        return [...n.children!.keys()];
      });
    },
    unlink(path: string, cb: Cb) {
      wrap(cb, () => {
        const [dir, name] = parent(path);
        const n = dir.children!.get(name);
        if (!n) throw fsError('ENOENT', path);
        if (n.dir) throw fsError('EISDIR', path);
        dir.children!.delete(name);
      });
    },
    rmdir(path: string, cb: Cb) {
      wrap(cb, () => {
        const [dir, name] = parent(path);
        const n = dir.children!.get(name);
        if (!n) throw fsError('ENOENT', path);
        if (!n.dir) throw fsError('ENOTDIR', path);
        if (n.children!.size) throw fsError('ENOTEMPTY', path);
        dir.children!.delete(name);
      });
    },
    rename(from: string, to: string, cb: Cb) {
      wrap(cb, () => {
        const [fdir, fname] = parent(from);
        const n = fdir.children!.get(fname);
        if (!n) throw fsError('ENOENT', from);
        const [tdir, tname] = parent(to);
        fdir.children!.delete(fname);
        tdir.children!.set(tname, n);
      });
    },
    ftruncate(fd: number, len: number, cb: Cb) {
      wrap(cb, () => {
        const f = fds.get(fd);
        if (!f) throw fsError('EBADF');
        grow(f.node, len);
        f.node.size = len;
      });
    },
    truncate(path: string, len: number, cb: Cb) {
      wrap(cb, () => {
        const n = lookup(path);
        if (!n) throw fsError('ENOENT', path);
        grow(n, len);
        n.size = len;
      });
    },
    chmod(path: string, mode: number, cb: Cb) {
      wrap(cb, () => {
        const n = lookup(path);
        if (!n) throw fsError('ENOENT', path);
        n.mode = mode & 0o777;
      });
    },
    fchmod(fd: number, mode: number, cb: Cb) {
      wrap(cb, () => {
        const f = fds.get(fd);
        if (!f) throw fsError('EBADF');
        f.node.mode = mode & 0o777;
      });
    },
    chown: (_p: string, _u: number, _g: number, cb: Cb) => cb(null),
    fchown: (_fd: number, _u: number, _g: number, cb: Cb) => cb(null),
    lchown: (_p: string, _u: number, _g: number, cb: Cb) => cb(null),
    utimes(path: string, _a: number, m: number, cb: Cb) {
      wrap(cb, () => {
        const n = lookup(path);
        if (!n) throw fsError('ENOENT', path);
        n.mtimeMs = m * 1000;
      });
    },
    fsync: (_fd: number, cb: Cb) => cb(null),
    readlink: (path: string, cb: Cb) => cb(fsError('EINVAL', path)),
    symlink: (_t: string, path: string, cb: Cb) => cb(fsError('ENOSYS', path)),
    link: (_t: string, path: string, cb: Cb) => cb(fsError('ENOSYS', path)),
  };

  return {
    fs,
    readFile(path) {
      const n = lookup(path);
      return n && !n.dir ? n.data.slice(0, n.size) : undefined;
    },
  };
}
