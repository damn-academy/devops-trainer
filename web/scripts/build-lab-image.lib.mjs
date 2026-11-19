// Pure helpers of build-lab-image.mjs: everything that turns official Alpine
// packages into a v86 root filesystem without Docker, chroot or a Linux host.
// No network and no file system access here (except through arguments), so
// tests/lab-image.test.ts exercises it with small synthetic inputs.
//
//   APKINDEX   → parseApkIndex, Index (providers, install_if), resolve
//   .apk (v2)  → gzipMembers (signature | control | data), parseTar
//   trust      → verifyIndexSignature (RSA over the control member),
//                apkChecksum (the Q1 SHA-1 an index records for each package)
//   output     → Tree (paths with owner, mode and content), toFsJson (v86 9p
//                index, version 3), cpioNewc (initramfs)

import { createHash, createVerify } from 'node:crypto';
import zlib from 'node:zlib';

// ── APKINDEX ──────────────────────────────────────────────────────────────

/** One record of an APKINDEX (apk v2 text format, one `X:value` per line). */
export function parseApkIndex(text) {
  const out = [];
  for (const block of text.split(/\n\n+/)) {
    if (!block.trim()) continue;
    const r = { deps: [], provides: [], installIf: [] };
    for (const line of block.split('\n')) {
      const k = line[0];
      const v = line.slice(2);
      if (line[1] !== ':') continue;
      switch (k) {
        case 'C': r.checksum = v; break;
        case 'P': r.name = v; break;
        case 'V': r.version = v; break;
        case 'A': r.arch = v; break;
        case 'S': r.size = Number(v); break;
        case 'I': r.isize = Number(v); break;
        case 'T': r.desc = v; break;
        case 'U': r.url = v; break;
        case 'L': r.license = v; break;
        case 'o': r.origin = v; break;
        case 'm': r.maintainer = v; break;
        case 't': r.builddate = Number(v); break;
        case 'c': r.commit = v; break;
        case 'k': r.priority = Number(v); break;
        case 'D': r.deps = v.split(/\s+/).filter(Boolean); break;
        case 'p': r.provides = v.split(/\s+/).filter(Boolean); break;
        case 'i': r.installIf = v.split(/\s+/).filter(Boolean); break;
      }
    }
    if (r.name) out.push(r);
  }
  return out;
}

/** `so:libc.musl-x86.so.1`, `nginx>=1.2`, `!foo`, `cmd:ssh=10.0` → parts. */
export function parseDep(atom) {
  const conflict = atom.startsWith('!');
  const s = conflict ? atom.slice(1) : atom;
  const m = s.match(/^([^<>=~]+)(?:(>=|<=|=|>|<|~)(.*))?$/);
  return { name: m ? m[1] : s, op: m?.[2] ?? null, version: m?.[3] ?? null, conflict };
}

/** Packages of several repositories, searchable by name and by what they provide. */
export class Index {
  constructor() {
    this.byName = new Map();
    this.providers = new Map();
  }

  /** Add the records of one repository (`repo` is remembered for the download URL). */
  add(records, repo) {
    for (const r of records) {
      if (this.byName.has(r.name)) continue; // the first repository wins, like apk with tagged repos
      const p = { ...r, repo };
      this.byName.set(r.name, p);
      for (const atom of r.provides) {
        const { name } = parseDep(atom);
        if (!this.providers.has(name)) this.providers.set(name, []);
        this.providers.get(name).push(p);
      }
    }
    return this;
  }

  /** The package that satisfies a dependency name, preferring ones already chosen. */
  provider(name, chosen = new Set()) {
    const direct = this.byName.get(name);
    if (direct) return direct;
    const list = this.providers.get(name) ?? [];
    if (!list.length) return null;
    const picked = list.find((p) => chosen.has(p.name));
    if (picked) return picked;
    return [...list].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name))[0];
  }
}

/**
 * Close a list of wanted package names over their dependencies and install_if
 * rules (e.g. `nginx-openrc` comes with `nginx` once `openrc` is there), the
 * way apk does for a fresh root. Returns packages in install order:
 * dependencies first (cycles are broken in a stable way).
 */
export function resolve(index, wanted, { exclude = [] } = {}) {
  const chosen = new Map();
  const skip = new Set(exclude);
  const missing = [];
  const want = (name, from) => {
    const { name: dep, conflict } = parseDep(name);
    if (conflict || skip.has(dep)) return;
    const p = index.provider(dep, new Set(chosen.keys()));
    if (!p) {
      missing.push(`${dep} (needed by ${from})`);
      return;
    }
    if (chosen.has(p.name) || skip.has(p.name)) return;
    chosen.set(p.name, p);
    for (const d of p.deps) want(d, p.name);
  };
  for (const w of wanted) want(w, 'the image');
  // install_if: a package is added when every condition is already installed.
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of index.byName.values()) {
      if (!p.installIf.length || chosen.has(p.name) || skip.has(p.name)) continue;
      const ok = p.installIf.every((c) => {
        const { name } = parseDep(c);
        const prov = index.provider(name, new Set(chosen.keys()));
        return prov && chosen.has(prov.name);
      });
      if (ok) {
        want(p.name, 'install_if');
        changed = true;
      }
    }
  }
  if (missing.length) throw new Error(`unresolved dependencies: ${missing.join(', ')}`);

  // Topological order (deps first), depth-first in name order for stability.
  const order = [];
  const state = new Map();
  const visit = (p) => {
    if (state.get(p.name)) return;
    state.set(p.name, 1);
    for (const d of p.deps) {
      const { name, conflict } = parseDep(d);
      if (conflict) continue;
      const q = index.provider(name, new Set(chosen.keys()));
      if (q && chosen.has(q.name)) visit(q);
    }
    order.push(p);
  };
  for (const name of [...chosen.keys()].sort()) visit(chosen.get(name));
  return order;
}

/** File name of a package on the mirror. */
export const apkFile = (p) => `${p.name}-${p.version}.apk`;

// ── .apk files and trust ──────────────────────────────────────────────────

/**
 * Split concatenated gzip streams. An apk v2 package is three of them:
 * the signature, the control segment (.PKGINFO and scripts), the data.
 */
export function gzipMembers(buf) {
  const out = [];
  let off = 0;
  while (off < buf.length) {
    const sub = buf.subarray(off);
    if (sub[0] !== 0x1f || sub[1] !== 0x8b) throw new Error(`not a gzip stream at byte ${off}`);
    let p = 10;
    const flg = sub[3];
    if (flg & 4) p += 2 + (sub[p] | (sub[p + 1] << 8));
    if (flg & 8) while (sub[p++]);
    if (flg & 16) while (sub[p++]);
    if (flg & 2) p += 2;
    const r = zlib.inflateRawSync(sub.subarray(p), { info: true });
    const len = p + r.engine.bytesWritten + 8; // + CRC32 and ISIZE
    out.push({ raw: sub.subarray(0, len), data: r.buffer });
    off += len;
  }
  return out;
}

/** The checksum an APKINDEX stores for a package: Q1 + base64(SHA-1 of the control member). */
export function apkChecksum(controlRaw) {
  return 'Q1' + createHash('sha1').update(controlRaw).digest('base64');
}

/**
 * Verify an APKINDEX.tar.gz (or a package) against Alpine's public keys: the
 * first member holds `.SIGN.RSA.<key>` (PKCS#1 v1.5 over SHA-1) or
 * `.SIGN.RSA256.<key>`, signing the raw bytes of the second member.
 * Returns the key name, or throws.
 */
export function verifyIndexSignature(tgz, keys) {
  const members = gzipMembers(tgz);
  if (members.length < 2) throw new Error('unsigned archive');
  const sig = parseTar(members[0].data).find((e) => e.name.startsWith('.SIGN.'));
  if (!sig) throw new Error('no signature entry');
  const m = sig.name.match(/^\.SIGN\.(RSA|RSA256)\.(.+)$/);
  if (!m) throw new Error(`unknown signature ${sig.name}`);
  const pem = keys[m[2]];
  if (!pem) throw new Error(`signed by an unknown key ${m[2]}`);
  const v = createVerify(m[1] === 'RSA' ? 'sha1' : 'sha256');
  v.update(members[1].raw);
  if (!v.verify(pem, sig.data)) throw new Error(`bad signature by ${m[2]}`);
  return { key: m[2], members };
}

// ── tar ───────────────────────────────────────────────────────────────────

const str = (b) => {
  const i = b.indexOf(0);
  return b.subarray(0, i < 0 ? b.length : i).toString('utf8');
};
const oct = (b) => {
  const s = str(b).trim();
  return s ? parseInt(s, 8) : 0;
};

function parsePax(data) {
  const out = {};
  let o = 0;
  while (o < data.length) {
    const sp = data.indexOf(0x20, o);
    if (sp < 0) break;
    const len = Number(data.subarray(o, sp).toString());
    if (!len) break;
    const rec = data.subarray(sp + 1, o + len - 1).toString('utf8');
    const eq = rec.indexOf('=');
    out[rec.slice(0, eq)] = rec.slice(eq + 1);
    o += len;
  }
  return out;
}

/**
 * Entries of a ustar/pax tar. apk segments carry no end-of-archive blocks, so
 * a concatenation of members still parses. Each entry: name, type
 * (f, d, l = symlink, h = hard link, c, b, p), mode, uid, gid, uname, gname,
 * mtime, size, link, data, pax.
 */
export function parseTar(buf) {
  const out = [];
  let o = 0;
  let pax = null;
  let longName = null;
  let longLink = null;
  while (o + 512 <= buf.length) {
    const h = buf.subarray(o, o + 512);
    if (h.every((b) => b === 0)) {
      o += 512;
      continue;
    }
    const size = oct(h.subarray(124, 136));
    const tf = String.fromCharCode(h[156] || 0x30);
    const data = buf.subarray(o + 512, o + 512 + size);
    o += 512 + Math.ceil(size / 512) * 512;
    if (tf === 'x') {
      pax = { ...(pax ?? {}), ...parsePax(data) };
      continue;
    }
    if (tf === 'g') continue;
    if (tf === 'L') {
      longName = str(data);
      continue;
    }
    if (tf === 'K') {
      longLink = str(data);
      continue;
    }
    const prefix = h[257] === 0x75 /* ustar */ ? str(h.subarray(345, 500)) : '';
    let name = longName ?? pax?.path ?? (prefix ? `${prefix}/${str(h.subarray(0, 100))}` : str(h.subarray(0, 100)));
    const link = longLink ?? pax?.linkpath ?? str(h.subarray(157, 257));
    const type = { 0: 'f', 7: 'f', 1: 'h', 2: 'l', 3: 'c', 4: 'b', 5: 'd', 6: 'p' }[tf] ?? 'f';
    name = name.replace(/^\.\//, '').replace(/\/+$/, '');
    out.push({
      name,
      type,
      mode: oct(h.subarray(100, 108)) & 0o7777,
      uid: oct(h.subarray(108, 116)),
      gid: oct(h.subarray(116, 124)),
      uname: str(h.subarray(265, 297)),
      gname: str(h.subarray(297, 329)),
      mtime: Math.floor(Number(pax?.mtime ?? oct(h.subarray(136, 148)))),
      size,
      link,
      data,
      pax: pax ?? {},
    });
    pax = null;
    longName = null;
    longLink = null;
  }
  return out;
}

/** Key/value lines of .PKGINFO (`key = value`, repeated keys collected). */
export function parsePkgInfo(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\w+) = (.*)$/);
    if (!m) continue;
    (out[m[1]] ??= []).push(m[2]);
  }
  return out;
}

// ── the root file system ──────────────────────────────────────────────────

const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;

/**
 * An in-memory directory tree. Files keep only their content key (the
 * caller stores content by SHA-256), so a whole distribution fits easily.
 */
export class Tree {
  constructor(mtime = 0) {
    this.nodes = new Map([['', { type: 'd', mode: 0o755, uid: 0, gid: 0, mtime }]]);
    this.mtime = mtime;
  }

  static norm(p) {
    return p.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
  }

  get(p) {
    return this.nodes.get(Tree.norm(p));
  }

  has(p) {
    return this.nodes.has(Tree.norm(p));
  }

  /** Make every missing parent directory (root:root 0755). */
  parents(p) {
    const parts = Tree.norm(p).split('/');
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/');
      if (!this.nodes.has(d)) this.nodes.set(d, { type: 'd', mode: 0o755, uid: 0, gid: 0, mtime: this.mtime });
    }
  }

  dir(p, o = {}) {
    p = Tree.norm(p);
    this.parents(p);
    const cur = this.nodes.get(p);
    if (cur?.type === 'd') Object.assign(cur, o);
    else this.nodes.set(p, { type: 'd', mode: 0o755, uid: 0, gid: 0, mtime: this.mtime, ...o });
  }

  /** A regular file: `sha` is the content key, `size` its length. */
  file(p, sha, size, o = {}) {
    p = Tree.norm(p);
    this.parents(p);
    this.nodes.set(p, { type: 'f', mode: 0o644, uid: 0, gid: 0, mtime: this.mtime, ...o, sha, size });
  }

  symlink(p, target, o = {}) {
    p = Tree.norm(p);
    this.parents(p);
    this.nodes.set(p, { type: 'l', mode: 0o777, uid: 0, gid: 0, mtime: this.mtime, ...o, target });
  }

  remove(p) {
    p = Tree.norm(p);
    for (const k of [...this.nodes.keys()]) if (k === p || k.startsWith(p + '/')) this.nodes.delete(k);
  }

  /** Children of every directory, for building nested structures. */
  children() {
    const kids = new Map();
    for (const k of this.nodes.keys()) {
      if (!k) continue;
      const i = k.lastIndexOf('/');
      const parent = i < 0 ? '' : k.slice(0, i);
      if (!kids.has(parent)) kids.set(parent, []);
      kids.get(parent).push(k);
    }
    for (const list of kids.values()) list.sort();
    return kids;
  }

  /** Bytes of all regular files. */
  size() {
    let n = 0;
    for (const v of this.nodes.values()) if (v.type === 'f') n += v.size;
    return n;
  }

  clone() {
    const t = new Tree(this.mtime);
    t.nodes = new Map([...this.nodes].map(([k, v]) => [k, { ...v }]));
    return t;
  }
}

/**
 * The v86 9p index (lib/filesystem.js `load_from_json`, version 3): every
 * entry is [name, size, mtime, mode, uid, gid, children | symlink target |
 * content file name]. Content files are fetched lazily from the base URL.
 * `fileName(node)` maps a regular file to its name in the content store.
 */
export function toFsJson(tree, fileName) {
  const kids = tree.children();
  const entry = (path) => {
    const n = tree.nodes.get(path);
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (n.type === 'd') return [name, 0, n.mtime, S_IFDIR | n.mode, n.uid, n.gid, (kids.get(path) ?? []).map(entry)];
    if (n.type === 'l') return [name, Buffer.byteLength(n.target), n.mtime, S_IFLNK | 0o777, n.uid, n.gid, n.target];
    return [name, n.size, n.mtime, S_IFREG | n.mode, n.uid, n.gid, fileName(n)];
  };
  return { fsroot: (kids.get('') ?? []).map(entry), version: 3, size: tree.size() };
}

// ── initramfs ─────────────────────────────────────────────────────────────

/** A newc cpio archive (what the kernel unpacks as an initramfs). Entries: {name, mode (with type bits), data?}. */
export function cpioNewc(entries, mtime = 0) {
  const parts = [];
  let ino = 1;
  const pad4 = (n) => (4 - (n % 4)) % 4;
  const add = (name, mode, data) => {
    const nameBuf = Buffer.from(name + '\0');
    const hex = (n) => n.toString(16).padStart(8, '0');
    const fields = [ino++, mode, 0, 0, (mode & 0o170000) === S_IFDIR ? 2 : 1, mtime, data.length, 0, 0, 0, 0, nameBuf.length, 0];
    const head = Buffer.from('070701' + fields.map(hex).join(''));
    parts.push(head, nameBuf, Buffer.alloc(pad4(head.length + nameBuf.length)), data, Buffer.alloc(pad4(data.length)));
  };
  for (const e of entries) add(e.name.replace(/^\/+/, ''), e.mode, e.data ? Buffer.from(e.data) : Buffer.alloc(0));
  add('TRAILER!!!', 0, Buffer.alloc(0));
  return Buffer.concat(parts);
}

export const MODE = { dir: S_IFDIR, file: S_IFREG, link: S_IFLNK };

/** Module load order for `want` from a modules.dep text (dependencies first). */
export function moduleOrder(modulesDep, want) {
  const deps = new Map();
  const byName = new Map();
  for (const line of modulesDep.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const path = line.slice(0, i).trim();
    deps.set(path, line.slice(i + 1).trim().split(/\s+/).filter(Boolean));
    byName.set(path.split('/').pop().replace(/\.ko(\.\w+)?$/, '').replace(/-/g, '_'), path);
  }
  const out = [];
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    // modules.dep lists the full closure; load in reverse (deepest first).
    for (const d of [...(deps.get(path) ?? [])].reverse()) visit(d);
    out.push(path);
  };
  for (const w of want) {
    const p = byName.get(w.replace(/-/g, '_'));
    if (!p) throw new Error(`kernel module ${w} is not in modules.dep`);
    visit(p);
  }
  return out;
}

// ── users created by package scripts ──────────────────────────────────────

/**
 * Apply the `addgroup -S` / `adduser -S` lines of apk pre/post-install scripts
 * to passwd and group texts, choosing ids like BusyBox does for system
 * accounts (the first free id from 100). Ownership of package files then
 * resolves to the same numbers the guest would get from running the scripts.
 */
export function applyAccountScripts(script, db) {
  for (const raw of script.split('\n')) {
    const line = raw.replace(/\s*2>\s*\/dev\/null/g, '').replace(/\|\|.*$/, '').trim();
    const words = line.split(/\s+/);
    const cmd = words[0];
    if (cmd !== 'addgroup' && cmd !== 'adduser') continue;
    const opts = {};
    const args = [];
    for (let i = 1; i < words.length; i++) {
      const w = words[i];
      if (/^-[A-Za-z]+$/.test(w)) {
        for (const f of w.slice(1)) {
          if ('hgsGuk'.includes(f)) opts[f] = words[++i];
          else opts[f] = true;
        }
      } else args.push(w.replace(/^["']|["']$/g, ''));
    }
    if (cmd === 'addgroup') {
      if (args.length === 2) addMember(db, args[1], args[0]);
      else if (args.length === 1 && !db.groups.has(args[0])) db.groups.set(args[0], { gid: opts.g ? Number(opts.g) : freeId(db.groups, 'gid'), members: [] });
    } else if (args.length >= 2 && !opts.S && !opts.D) {
      addMember(db, args[1], args[0]); // `adduser user group`
    } else if (args.length >= 1 && !db.users.has(args[0])) {
      const name = args[0];
      const gname = opts.G ?? null;
      if (gname && !db.groups.has(gname)) db.groups.set(gname, { gid: freeId(db.groups, 'gid'), members: [] });
      const uid = opts.u ? Number(opts.u) : freeId(db.users, 'uid');
      let gid;
      if (gname) gid = db.groups.get(gname).gid;
      else if (db.groups.has(name)) gid = db.groups.get(name).gid;
      else {
        gid = db.groups.has('nogroup') ? db.groups.get('nogroup').gid : 65533;
      }
      db.users.set(name, { uid, gid, gecos: typeof opts.g === 'string' ? opts.g : name, home: opts.h ?? `/home/${name}`, shell: opts.s ?? '/bin/sh' });
    }
  }
}

function addMember(db, group, user) {
  const g = db.groups.get(group);
  if (g && !g.members.includes(user)) g.members.push(user);
}

function freeId(map, key) {
  const used = new Set([...map.values()].map((v) => v[key]));
  for (let id = 100; id < 1000; id++) if (!used.has(id)) return id;
  throw new Error('no free system id');
}

export function parseAccounts(passwd, group) {
  const users = new Map();
  for (const l of passwd.split('\n')) {
    const f = l.split(':');
    if (f.length >= 7) users.set(f[0], { uid: Number(f[2]), gid: Number(f[3]), gecos: f[4], home: f[5], shell: f[6] });
  }
  const groups = new Map();
  for (const l of group.split('\n')) {
    const f = l.split(':');
    if (f.length >= 4) groups.set(f[0], { gid: Number(f[2]), members: f[3] ? f[3].split(',') : [] });
  }
  return { users, groups };
}

export function formatAccounts(db) {
  const passwd = [...db.users].map(([n, u]) => `${n}:x:${u.uid}:${u.gid}:${u.gecos}:${u.home}:${u.shell}`).join('\n') + '\n';
  const group = [...db.groups].map(([n, g]) => `${n}:x:${g.gid}:${g.members.join(',')}`).join('\n') + '\n';
  return { passwd, group };
}

// ── apk's database of installed packages ──────────────────────────────────

/** `Z:` value from the hex SHA-1 apk stores in each data entry's pax header. */
export const q1FromHex = (hex) => 'Q1' + Buffer.from(hex, 'hex').toString('base64');

/**
 * One record of /lib/apk/db/installed: the index fields followed by the
 * package's directories (F:, M:) and files (R:, a:, Z:).
 */
export function installedRecord(p, entries) {
  const lines = [`C:${p.checksum}`, `P:${p.name}`, `V:${p.version}`, `A:${p.arch}`, `S:${p.size}`, `I:${p.isize}`, `T:${p.desc ?? ''}`, `U:${p.url ?? ''}`, `L:${p.license ?? ''}`];
  if (p.origin) lines.push(`o:${p.origin}`);
  if (p.maintainer) lines.push(`m:${p.maintainer}`);
  if (p.builddate) lines.push(`t:${p.builddate}`);
  if (p.commit) lines.push(`c:${p.commit}`);
  if (p.deps.length) lines.push(`D:${p.deps.join(' ')}`);
  if (p.provides.length) lines.push(`p:${p.provides.join(' ')}`);
  if (p.installIf.length) lines.push(`i:${p.installIf.join(' ')}`);
  const dirs = new Map();
  for (const e of entries) {
    if (e.type === 'd') dirs.set(e.name, { e, files: [] });
  }
  for (const e of entries) {
    if (e.type === 'd') continue;
    const i = e.name.lastIndexOf('/');
    const d = i < 0 ? '' : e.name.slice(0, i);
    if (!dirs.has(d)) dirs.set(d, { e: null, files: [] });
    dirs.get(d).files.push(e);
  }
  for (const [d, { e, files }] of [...dirs].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`F:${d}`);
    if (e && (e.uid || e.gid || e.mode !== 0o755)) lines.push(`M:${e.uid}:${e.gid}:${e.mode.toString(8)}`);
    for (const f of files) {
      lines.push(`R:${f.name.slice(f.name.lastIndexOf('/') + 1)}`);
      if (f.uid || f.gid || (f.type === 'f' && f.mode !== 0o644)) lines.push(`a:${f.uid}:${f.gid}:${f.mode.toString(8)}`);
      const hex = f.pax['APK-TOOLS.checksum.SHA1'];
      if (hex) lines.push(`Z:${q1FromHex(hex)}`);
    }
  }
  return lines.join('\n') + '\n\n';
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
