#!/usr/bin/env node
// Builds the trainer's own Linux image for v86 (design 00 §6.13) without
// Docker, chroot or a Linux host: Alpine Linux x86 (32-bit) assembled from the
// official binary packages.
//
//  1. Download APKINDEX.tar.gz of main and community from the official mirror
//     and verify their RSA signatures against Alpine's public key (pinned by
//     SHA-256; fetched from the aports repository).
//  2. Resolve the package lists of the profiles like apk does (dependencies,
//     shared-library providers, install_if), download every .apk once into a
//     cache and check it against the checksum the signed index records.
//  3. Unpack the data segments into one tree per profile, with the owners the
//     packages' own account scripts would create, write apk's database of
//     installed packages, and add the trainer's small overlay (inittab with an
//     autologin on ttyS0, first-boot script, OpenRC runlevels, sshd host key
//     type, a local package repository at /media/cdrom/apks like on the ISO).
//  4. Write the v86 9p index (`<profile>.fs.json`) and content-addressed files
//     (`files/<sha256>.bin` or `.bin.zst`) that the emulator fetches lazily, the
//     kernel `vmlinuz-virt` of linux-virt, and our initramfs (`initramfs-lab`,
//     BusyBox static + the virtio, 9p, network and disk modules) that mounts
//     the 9p root and switches to it.
//  5. Write `manifest.json` with every downloaded artifact (URL, SHA-256,
//     licence) and every generated file.
//
// Everything lands in public/v86/lab/ (git-ignored); downloads are cached in
// .cache/lab-image/. Usage:
//   node scripts/build-lab-image.mjs [--release v3.24] [--mirror URL] [--offline]
//
// The guest-side work apk would do after unpacking (package scripts and
// triggers: BusyBox applet links, CA bundle, man index) runs once on the
// first boot from the initramfs (/usr/libexec/dt/firstboot) and is part of the
// boot snapshot afterwards.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import {
  Index,
  MODE,
  Tree,
  apkChecksum,
  apkFile,
  applyAccountScripts,
  cpioNewc,
  formatAccounts,
  gzipMembers,
  installedRecord,
  moduleOrder,
  parseAccounts,
  parseApkIndex,
  parsePkgInfo,
  parseTar,
  resolve,
  sha256,
  toFsJson,
  verifyIndexSignature,
} from './build-lab-image.lib.mjs';
import { addIac, loadIac } from './iac.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
};
const RELEASE = arg('--release', 'v3.24');
const MIRROR = arg('--mirror', 'https://dl-cdn.alpinelinux.org/alpine').replace(/\/$/, '');
const OFFLINE = argv.includes('--offline');
const ARCH = 'x86';
const REPOS = ['main', 'community'];
const CACHE = join(webRoot, '.cache', 'lab-image', RELEASE);
const OUT = join(webRoot, 'public', 'v86', 'lab');
const FILES = join(OUT, 'files');
/** OpenTofu and the lab provider for profiles with `iac` (set in main). */
let IAC = null;
/** Fixed timestamps keep the output reproducible: the index's newest build date is used. */
let MTIME = 0;

// Alpine's signing key for x86 (published on alpinelinux.org/keys, same as in alpine-keys). Pinned: a different key is never trusted.
const KEYS = [
  {
    name: 'alpine-devel@lists.alpinelinux.org-61666e3f.rsa.pub',
    url: 'https://alpinelinux.org/keys/alpine-devel@lists.alpinelinux.org-61666e3f.rsa.pub',
    sha256: '128d34d4aec39b0daedea8163cd8dc24dff36fd3d848630ab97eeb1d3084bbb3',
    license: 'Public key (alpine-keys, MIT)',
  },
];

// ── profiles ──────────────────────────────────────────────────────────────

/** What every lab machine has: the administrator's toolbox before containers. */
const NODE_WORLD = [
  'alpine-base', 'linux-virt', 'mkinitfs', 'openrc',
  'bash', 'bash-completion', 'coreutils', 'util-linux', 'util-linux-misc', 'findutils', 'grep', 'sed', 'gawk', 'diffutils', 'procps-ng', 'psmisc', 'shadow', 'sudo', 'less', 'nano', 'vim', 'file', 'tar', 'gzip', 'xz', 'tzdata',
  'sfdisk', 'lsblk', 'blkid', 'parted', 'gptfdisk', 'sgdisk', 'lvm2', 'e2fsprogs', 'e2fsprogs-extra', 'dosfstools', 'mdadm', 'syslinux', 'grub', 'grub-bios',
  'openssh', 'openssh-server', 'openssh-keygen', 'nginx', 'curl', 'wget', 'ca-certificates', 'openssl',
  'iproute2', 'bridge-utils', 'iptables', 'ip6tables', 'nftables', 'dnsmasq', 'tcpdump', 'bind-tools', 'iputils', 'ethtool', 'socat', 'netcat-openbsd', 'iperf3', 'lsof', 'strace', 'rsync',
  'git', 'git-daemon', 'jq',
  'man-pages', 'mandoc', 'mandoc-apropos', 'docs',
];

/**
 * The installer media: a live system with what `setup-alpine` and a manual
 * install need, while the packages for the new system come from the local
 * repository (/media/cdrom/apks), as on the official ISO.
 */
const INSTALLER_WORLD = [
  'alpine-base', 'linux-virt', 'mkinitfs', 'openrc', 'bash', 'less', 'nano',
  'sfdisk', 'lsblk', 'blkid', 'parted', 'gptfdisk', 'lvm2', 'e2fsprogs', 'dosfstools', 'util-linux-misc', 'syslinux', 'grub-bios',
  'openssh', 'curl', 'iproute2', 'man-pages', 'mandoc',
];

/** Packages never installed on the 9p root (firmware blobs are useless in v86). */
const EXCLUDE = ['linux-firmware', 'linux-firmware-any'];

/** Kernel modules loaded by our initramfs before switching to the 9p root. */
const INITRAMFS_MODULES = ['9pnet_virtio', '9p', 'virtio_net', 'sd_mod', 'ata_generic'];

const PROFILES = {
  // iac: OpenTofu (official release) and the provider `lab` in a filesystem mirror, see iac.mjs.
  'lab-node': { world: NODE_WORLD, hostname: 'lab', motd: '', sshd: true, iac: true },
  'lab-installer': { world: INSTALLER_WORLD, hostname: 'localhost', motd: null /* Alpine's own */, sshd: false },
};

// ── downloads ─────────────────────────────────────────────────────────────

const downloaded = [];

async function fetchCached(url, file, check) {
  const path = join(CACHE, file);
  if (existsSync(path)) {
    const buf = readFileSync(path);
    if (!check || check(buf)) return buf;
    console.warn(`lab-image: ${file} in the cache does not verify, downloading again`);
  }
  if (OFFLINE) throw new Error(`${file} is not cached and --offline is set`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (check && !check(buf)) throw new Error(`${url}: verification failed`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return buf;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ── content store ─────────────────────────────────────────────────────────

const stored = new Map(); // sha256 → file name in files/

/** Store content once by SHA-256; compressible files are kept as zstd (v86 decompresses them). */
function store(buf) {
  const sum = sha256(buf);
  const known = stored.get(sum);
  if (known) return { sha: known, sum };
  // A previous build already wrote this content: skip compressing it again (large binaries).
  for (const name of [`${sum}.bin.zst`, `${sum}.bin`])
    if (existsSync(join(FILES, name))) {
      stored.set(sum, name);
      return { sha: name, sum };
    }
  let name = `${sum}.bin`;
  let data = buf;
  if (buf.length >= 512) {
    const z = zlib.zstdCompressSync(buf, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } });
    if (z.length < buf.length * 0.85) {
      name = `${sum}.bin.zst`;
      data = z;
    }
  }
  const path = join(FILES, name);
  if (!existsSync(path)) writeFileSync(path, data);
  stored.set(sum, name);
  return { sha: name, sum };
}

const text = (s) => Buffer.from(s, 'utf8');

// ── packages ──────────────────────────────────────────────────────────────

/** Parsed package: index record + control files + data entries. */
function unpack(p, buf) {
  const members = gzipMembers(buf);
  const control = parseTar(members[1].data);
  const data = members.length > 2 ? parseTar(members[2].data) : [];
  const info = parsePkgInfo(control.find((e) => e.name === '.PKGINFO')?.data.toString() ?? '');
  const scripts = {};
  for (const e of control) {
    const m = e.name.match(/^\.(pre-install|post-install|trigger)$/);
    if (m) scripts[m[1]] = e.data.toString();
  }
  return { p, info, scripts, data, triggers: (info.triggers?.[0] ?? '').split(/\s+/).filter(Boolean) };
}

function buildTree(profile, pkgs, repoPkgs, apkBytes) {
  const conf = PROFILES[profile];
  const tree = new Tree(MTIME);
  // Accounts: alpine-baselayout-data's passwd/group, then every package's account scripts in order.
  const base = pkgs.find((u) => u.p.name === 'alpine-baselayout-data');
  const read = (u, path) => u.data.find((e) => e.name === path)?.data.toString() ?? '';
  const db = parseAccounts(read(base, 'etc/passwd'), read(base, 'etc/group'));
  for (const u of pkgs) for (const ph of ['pre-install', 'post-install']) if (u.scripts[ph]) applyAccountScripts(u.scripts[ph], db);
  const uidOf = (e) => db.users.get(e.uname)?.uid ?? e.uid;
  const gidOf = (e) => db.groups.get(e.gname)?.gid ?? e.gid;

  let installed = '';
  const hardlinks = [];
  for (const u of pkgs) {
    const owned = [];
    for (const e of u.data) {
      if (!e.name || e.name.startsWith('.')) continue;
      const o = { mode: e.mode, uid: uidOf(e), gid: gidOf(e), mtime: e.mtime || MTIME };
      if (e.type === 'd') tree.dir(e.name, o);
      else if (e.type === 'l') tree.symlink(e.name, e.link, o);
      else if (e.type === 'h') hardlinks.push([e.name, e.link, o]);
      else if (e.type === 'f') {
        const { sha } = store(e.data);
        tree.file(e.name, sha, e.data.length, o);
      } else continue; // device nodes: devtmpfs provides them
      owned.push({ ...e, uid: o.uid, gid: o.gid });
    }
    installed += installedRecord(u.p, owned);
  }
  for (const [name, target, o] of hardlinks) {
    const t = tree.get(target);
    if (t?.type === 'f') tree.file(name, t.sha, t.size, { ...o, mode: t.mode });
  }

  // ── overlay ──
  const put = (path, content, mode = 0o644) => {
    const buf = typeof content === 'string' ? text(content) : content;
    const { sha } = store(buf);
    tree.file(path, sha, buf.length, { mode });
  };
  const link = (path, target) => tree.symlink(path, target);

  // Root and the learner account use bash; the learner's password is set on first boot.
  db.users.get('root').shell = '/bin/bash';
  if (!db.users.has('learner')) {
    db.groups.set('learner', { gid: 1000, members: [] });
    db.users.set('learner', { uid: 1000, gid: 1000, gecos: 'Learner', home: '/home/learner', shell: '/bin/bash' });
    for (const g of ['wheel']) db.groups.get(g)?.members.push('learner');
    tree.dir('home/learner', { uid: 1000, gid: 1000, mode: 0o755 });
  }
  const { passwd, group } = formatAccounts(db);
  put('etc/passwd', passwd);
  put('etc/group', group);
  const shadowBase = read(base, 'etc/shadow');
  const known = new Set(shadowBase.split('\n').map((l) => l.split(':')[0]));
  const shadow = shadowBase.replace(/^root:[^:]*:/m, 'root::') + [...db.users.keys()].filter((n) => !known.has(n)).map((n) => `${n}:!::0:::::\n`).join('');
  put('etc/shadow', shadow, 0o640);
  tree.get('etc/shadow').gid = db.groups.get('shadow')?.gid ?? 42;

  put('etc/hostname', `${conf.hostname}\n`);
  put('etc/hosts', `127.0.0.1\t${conf.hostname} localhost localhost.localdomain\n::1\t\tlocalhost localhost.localdomain\n`);
  put('etc/network/interfaces', 'auto lo\niface lo inet loopback\n');
  if (conf.motd !== null) put('etc/motd', conf.motd);
  put(
    'etc/inittab',
    [
      '# /etc/inittab of the trainer\'s lab image (BusyBox init + OpenRC, like Alpine).',
      '::sysinit:/sbin/openrc sysinit',
      '::sysinit:/sbin/openrc boot',
      '::wait:/sbin/openrc default',
      '',
      '# The learner\'s console is the first serial port, logged in as root.',
      'ttyS0::respawn:/sbin/getty -n -l /usr/libexec/dt/autologin 115200 ttyS0 vt100',
      '',
      '::ctrlaltdel:/sbin/reboot',
      '::shutdown:/sbin/openrc shutdown',
      '',
    ].join('\n'),
  );
  put('usr/libexec/dt/autologin', '#!/bin/sh\nexec /bin/login -f root\n', 0o755);
  put('etc/securetty', 'console\ntty1\nttyS0\nttyS1\n');
  // sshd: only an Ed25519 host key (RSA key generation takes long in emulation).
  put('etc/conf.d/sshd', '# Host key types generated on the first start of sshd.\nkey_types_to_generate="ed25519"\n');
  put('etc/ssh/sshd_config.d/10-lab.conf', '# Lab machines: root may log in with a key, users with a password or a key.\nPermitRootLogin prohibit-password\nUseDNS no\n');
  put('etc/sudoers.d/wheel', '%wheel ALL=(ALL:ALL) ALL\n', 0o440);
  put('etc/profile.d/lab.sh', 'export PAGER=less\nexport EDITOR=nano\n');

  // OpenRC runlevels: what a freshly installed Alpine enables, minus hardware-only services.
  const runlevels = {
    sysinit: ['devfs', 'dmesg', 'hwdrivers'],
    boot: ['bootmisc', 'hostname', 'modules', 'sysctl', 'networking', 'urandom', 'seedrng'],
    default: conf.sshd ? ['sshd'] : [],
    shutdown: ['killprocs', 'mount-ro', 'savecache'],
  };
  for (const [level, services] of Object.entries(runlevels)) {
    tree.dir(`etc/runlevels/${level}`);
    for (const s of services) if (tree.has(`etc/init.d/${s}`)) link(`etc/runlevels/${level}/${s}`, `/etc/init.d/${s}`);
  }

  // apk: database of what is installed, the world, the local repository.
  put('lib/apk/db/installed', installed);
  put('lib/apk/db/triggers', '');
  put('lib/apk/db/lock', '', 0o600);
  put('etc/apk/world', [...conf.world].sort().join('\n') + '\n');
  put('etc/apk/arch', `${ARCH}\n`);
  put('etc/apk/repositories', REPOS.map((r) => `/media/cdrom/apks/${r}`).join('\n') + '\n');
  for (const r of REPOS) {
    const idx = store(readFileSync(join(CACHE, r, 'APKINDEX.tar.gz')));
    tree.file(`media/cdrom/apks/${r}/${ARCH}/APKINDEX.tar.gz`, idx.sha, statSync(join(CACHE, r, 'APKINDEX.tar.gz')).size);
  }
  for (const p of repoPkgs) {
    const buf = apkBytes.get(p.name);
    const { sha } = store(buf);
    tree.file(`media/cdrom/apks/${p.repo}/${ARCH}/${apkFile(p)}`, sha, buf.length);
  }
  put('media/cdrom/.alpine-release', `alpine-virt ${RELEASE.slice(1)} ${ARCH} (dt-lab)\n`);

  // First boot: what apk would run after unpacking, in install order.
  const order = [];
  for (const u of pkgs) {
    for (const ph of ['pre-install', 'post-install']) if (u.scripts[ph]) put(`usr/libexec/dt/apk-scripts/${u.p.name}.${ph}`, u.scripts[ph], 0o755);
    if (u.scripts['pre-install'] || u.scripts['post-install']) order.push(`${u.p.name} ${u.p.version}`);
  }
  const triggers = [];
  for (const u of pkgs) {
    // mkinitfs, grub and syslinux prepare booting from a disk; the 9p root boots our initramfs instead.
    if (!u.scripts.trigger || DISK_BOOT_TRIGGERS.includes(u.p.name)) continue;
    put(`usr/libexec/dt/apk-scripts/${u.p.name}.trigger`, u.scripts.trigger, 0o755);
    triggers.push(`${u.p.name} ${u.triggers.join(' ')}`);
  }
  put('usr/libexec/dt/apk-scripts/order', order.join('\n') + '\n');
  put('usr/libexec/dt/apk-scripts/triggers', triggers.join('\n') + '\n');
  put('usr/libexec/dt/firstboot', FIRSTBOOT, 0o755);
  if (conf.iac)
    addIac(IAC, {
      put,
      file: (path, content, mode, uid, gid) => {
        const buf = typeof content === 'string' ? text(content) : content;
        tree.file(path, store(buf).sha, buf.length, { mode, uid, gid });
      },
    });
  put('etc/dt/image', JSON.stringify({ profile, release: RELEASE, arch: ARCH, packages: pkgs.length, ...(conf.iac ? { tofu: IAC.tofu.version, providers: IAC.providers.map((x) => `${x.name} ${x.version}`) } : {}) }) + '\n');
  return tree;
}

/** Triggers that only make sense on an installed system booting from its own disk. */
const DISK_BOOT_TRIGGERS = ['mkinitfs', 'grub', 'syslinux'];

const FIRSTBOOT = `#!/bin/busybox sh
# First boot of a dt-lab image, run once by the initramfs, chrooted into the
# root file system: what apk does after unpacking packages on a real
# install (package scripts in install order, then triggers).
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
log=/var/log/dt-firstboot.log
/bin/busybox --install -s
s=/usr/libexec/dt/apk-scripts
# apk runs package scripts from the root directory.
cd / || exit 1
{
  while read -r pkg ver; do
    for ph in pre-install post-install; do
      [ -f "$s/$pkg.$ph" ] || continue
      echo "== $pkg.$ph"
      /bin/sh "$s/$pkg.$ph" "$ver"
    done
  done < "$s/order"
  while read -r pkg globs; do
    dirs=
    for g in $globs; do for d in $g; do [ -d "$d" ] && dirs="$dirs $d"; done; done
    [ -n "$dirs" ] || continue
    echo "== $pkg.trigger$dirs"
    /bin/sh "$s/$pkg.trigger" $dirs
  done < "$s/triggers"
  echo 'learner:learner' | chpasswd
  [ -s /etc/machine-id ] || cat /proc/sys/kernel/random/uuid | tr -d - > /etc/machine-id
} > "$log" 2>&1
touch /etc/dt/firstboot.done
`;

const INIT = (modules) => `#!/bin/busybox sh
# Initramfs of the dt-lab image: load virtio, 9p, network and disk drivers,
# mount the root file system the emulator shares over 9p, run the first-boot
# script once, switch to the real init.
/bin/busybox mkdir -p /proc /sys /dev /newroot
/bin/busybox --install -s /bin
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
for m in ${modules.join(' ')}; do insmod /lib/modules/$m || echo "dt-init: cannot load $m"; done
if ! mount -t 9p -o trans=virtio,version=9p2000.L,cache=loose,rw host9p /newroot; then
  echo "dt-init: the root file system (9p) did not mount"; exec sh
fi
if [ ! -e /newroot/etc/dt/firstboot.done ]; then
  echo "dt-init: first boot, finishing the package installation"
  mount --bind /dev /newroot/dev; mount --bind /proc /newroot/proc; mount --bind /sys /newroot/sys
  chroot /newroot /usr/libexec/dt/firstboot
  umount -l /newroot/sys; umount -l /newroot/proc; umount -l /newroot/dev
fi
mount --move /dev /newroot/dev
mount --move /proc /newroot/proc
mount --move /sys /newroot/sys
exec switch_root /newroot /sbin/init
`;

function buildInitramfs(units) {
  const kernel = units.get('linux-virt');
  const bb = units.get('busybox-static');
  const depText = kernel.data.find((e) => e.name.endsWith('/modules.dep')).data.toString();
  const modDir = kernel.data.find((e) => e.name.endsWith('/modules.dep')).name.replace(/\/modules\.dep$/, '');
  const order = moduleOrder(depText, INITRAMFS_MODULES);
  const entries = [
    { name: 'bin', mode: MODE.dir | 0o755 },
    { name: 'lib', mode: MODE.dir | 0o755 },
    { name: 'lib/modules', mode: MODE.dir | 0o755 },
    { name: 'bin/busybox', mode: MODE.file | 0o755, data: bb.data.find((e) => e.name === 'bin/busybox.static').data },
    { name: 'init', mode: MODE.file | 0o755, data: text(INIT(order.map((m) => m.split('/').pop().replace(/\.gz$/, '')))) },
  ];
  for (const m of order) {
    const e = kernel.data.find((x) => x.name === `${modDir}/${m}`);
    if (!e) throw new Error(`module ${m} missing from linux-virt`);
    entries.push({ name: `lib/modules/${m.split('/').pop().replace(/\.gz$/, '')}`, mode: MODE.file | 0o644, data: m.endsWith('.gz') ? zlib.gunzipSync(e.data) : e.data });
  }
  return { cpio: zlib.gzipSync(cpioNewc(entries, MTIME), { level: 9 }), modules: order };
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(FILES, { recursive: true });

  const keys = {};
  for (const k of KEYS) {
    const buf = await fetchCached(k.url, `keys/${k.name}`, (b) => sha256(b) === k.sha256);
    keys[k.name] = buf.toString();
    downloaded.push({ file: `keys/${k.name}`, url: k.url, sha256: k.sha256, size: buf.length, license: k.license });
  }

  const index = new Index();
  for (const r of REPOS) {
    const url = `${MIRROR}/${RELEASE}/${r}/${ARCH}/APKINDEX.tar.gz`;
    // The index changes on the mirror; a cached copy is reused only offline or when it still verifies.
    const path = join(CACHE, r, 'APKINDEX.tar.gz');
    let buf;
    if (!OFFLINE) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, buf);
    } else buf = readFileSync(path);
    const { key, members } = verifyIndexSignature(buf, keys);
    const tar = parseTar(members[1].data);
    const records = parseApkIndex(tar.find((e) => e.name === 'APKINDEX').data.toString());
    for (const rec of records) MTIME = Math.max(MTIME, rec.builddate ?? 0);
    index.add(records, r);
    downloaded.push({ file: `${r}/APKINDEX.tar.gz`, url, sha256: sha256(buf), size: buf.length, license: 'index metadata', signedBy: key });
    console.log(`lab-image: ${r} index verified (${records.length} packages, key ${key})`);
  }

  const closures = {};
  for (const [name, conf] of Object.entries(PROFILES)) closures[name] = resolve(index, conf.world, { exclude: EXCLUDE });
  const extra = resolve(index, ['busybox-static'], { exclude: EXCLUDE });
  const all = new Map();
  for (const list of [...Object.values(closures), extra]) for (const p of list) all.set(p.name, p);

  const apkBytes = new Map();
  const units = new Map();
  let fetched = 0;
  await pool([...all.values()], 8, async (p) => {
    const url = `${MIRROR}/${RELEASE}/${p.repo}/${ARCH}/${apkFile(p)}`;
    const buf = await fetchCached(url, `apk/${apkFile(p)}`, (b) => apkChecksum(gzipMembers(b)[1].raw) === p.checksum);
    apkBytes.set(p.name, buf);
    fetched += buf.length;
    downloaded.push({ file: `apk/${apkFile(p)}`, url, sha256: sha256(buf), size: buf.length, license: p.license, origin: p.origin, checksum: p.checksum });
  });
  for (const p of all.values()) units.set(p.name, unpack(p, apkBytes.get(p.name)));
  console.log(`lab-image: ${all.size} packages verified (${(fetched / 1048576).toFixed(0)} MiB)`);

  const outputs = {};
  const writeOut = (name, buf, extra = {}) => {
    writeFileSync(join(OUT, name), buf);
    outputs[name] = { size: buf.length, sha256: sha256(buf), ...extra };
  };

  IAC = await loadIac(ARCH);
  downloaded.push(...IAC.downloads);
  console.log(`lab-image: OpenTofu ${IAC.tofu.version} and provider ${IAC.providers.map((x) => `${x.name} ${x.version}`).join(', ')} verified`);

  const repoPkgs = [...all.values()].sort((a, b) => a.name.localeCompare(b.name));
  const profiles = {};
  for (const [name, list] of Object.entries(closures)) {
    const pkgs = list.map((p) => units.get(p.name));
    const tree = buildTree(name, pkgs, repoPkgs, apkBytes);
    const json = Buffer.from(JSON.stringify(toFsJson(tree, (n) => n.sha)));
    writeOut(`${name}.fs.json`, json, { files: tree.nodes.size });
    profiles[name] = {
      fsJson: `${name}.fs.json`,
      packages: list.map((p) => `${p.name}-${p.version}`),
      world: PROFILES[name].world,
      rootBytes: tree.size(),
      entries: tree.nodes.size,
    };
    console.log(`lab-image: ${name}: ${list.length} packages, ${tree.nodes.size} paths, ${(tree.size() / 1048576).toFixed(0)} MiB in the root`);
  }

  const kernel = units.get('linux-virt');
  const vmlinuz = kernel.data.find((e) => e.name === 'boot/vmlinuz-virt').data;
  writeOut('vmlinuz-virt', vmlinuz, { from: `linux-virt-${kernel.p.version}`, license: kernel.p.license });
  const { cpio, modules } = buildInitramfs(units);
  writeOut('initramfs-lab', cpio, { modules, busybox: `busybox-static-${units.get('busybox-static').p.version}`, license: 'GPL-2.0-only (BusyBox, Linux modules)' });

  // Drop content files no profile refers to any more (from an older build).
  const live = new Set(stored.values());
  let removed = 0;
  for (const f of readdirSync(FILES)) {
    if (!live.has(f)) {
      rmSync(join(FILES, f));
      removed++;
    }
  }
  let storeBytes = 0;
  for (const f of live) storeBytes += statSync(join(FILES, f)).size;

  const manifest = {
    schema: 'dt.v86-lab-image/v1',
    distro: { name: 'Alpine Linux', release: RELEASE, arch: ARCH, mirror: MIRROR },
    kernel: { file: 'vmlinuz-virt', version: kernel.p.version, package: 'linux-virt' },
    initrd: { file: 'initramfs-lab' },
    filesBase: 'files/',
    cmdline: 'rw root=host9p rootfstype=9p console=ttyS0 tsc=reliable mitigations=off random.trust_cpu=on',
    builtAt: new Date().toISOString(),
    store: { files: live.size, bytes: storeBytes },
    profiles,
    outputs,
    iac: IAC && { platform: IAC.platform, tofu: IAC.tofu.version, providers: IAC.providers.map((x) => `${x.name} ${x.version}`), built: IAC.built },
    downloads: downloaded.sort((a, b) => a.file.localeCompare(b.file)),
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`lab-image: content store ${live.size} files, ${(storeBytes / 1048576).toFixed(0)} MiB${removed ? `, ${removed} stale removed` : ''}; done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

main().catch((e) => {
  console.error(`lab-image: ${e.stack ?? e.message}`);
  process.exit(1);
});
