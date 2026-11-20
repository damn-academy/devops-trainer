// The machine as a whole: uname, hostname, uptime, free, nproc, lscpu, dmesg,
// reboot; disks and mounts (lsblk, blkid, mkfs.ext4, mount, umount,
// findmnt); what the machine sees of the network (ip, ss, curl, ping); SSH
// keys and logging in to an account on the same machine (ssh-keygen, ssh,
// ssh-copy-id); crontab; whatis and apropos.

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand } from '../../../core/types';
import { CAP_FULL, HOST_NS, MEM_BASE_USED, MEM_CACHE, MEM_TOTAL, capHex, hasCapHex, type KProc } from '../kernel';
import { KERNEL, type SimMachine } from '../shell';
import { corpus, shortOf } from '../../docs/corpus';
import { ROOT_CRED, normalize } from '../vfs';
import { listening } from './procs';
import { cmdDoc, humanSize, parseArgs, usageError } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;
const hasCap = (ctx: CmdContext, cap: Parameters<typeof hasCapHex>[1]) => {
  const m = M(ctx);
  const p = m.procs.get((ctx as CmdContext & { pid?: number }).pid ?? 0) as KProc | undefined;
  return ctx.user.uid === 0 && hasCapHex(p?.capEff ?? m.shellProc().capEff, cap);
};

const uname: ShellCommand = {
  ...cmdDoc({
    name: 'uname',
    summary: bi('показать имя и версию ядра', 'print system information'),
    whatis: 'print system information',
    synopsis: ['uname [OPTION]...'],
    description: 'Print certain system information. With no OPTION, same as -s.',
    options: [
      ['-a, --all', 'print all information, in the following order'],
      ['-s, --kernel-name', 'print the kernel name'],
      ['-n, --nodename', 'print the network node hostname'],
      ['-r, --kernel-release', 'print the kernel release'],
      ['-v, --kernel-version', 'print the kernel version'],
      ['-m, --machine', 'print the machine hardware name'],
      ['-o, --operating-system', 'print the operating system'],
    ],
    seeAlso: 'uname(2), hostname(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'asnrvmpio', long: { all: 'a', 'kernel-name': 's', nodename: 'n', 'kernel-release': 'r', 'kernel-version': 'v', machine: 'm', 'operating-system': 'o' } });
    if (a.error) return usageError(ctx, a.error);
    const m = M(ctx);
    const f = a.flags.has('a') ? new Set(['s', 'n', 'r', 'v', 'm', 'o']) : a.flags.size ? a.flags : new Set(['s']);
    const parts: string[] = [];
    if (f.has('s')) parts.push('Linux');
    if (f.has('n')) parts.push(m.utsHostname());
    if (f.has('r')) parts.push(KERNEL);
    if (f.has('v')) parts.push('#1 SMP PREEMPT_DYNAMIC Debian 6.12.0 (2026-10-01)');
    if (f.has('m')) parts.push('x86_64');
    if (f.has('o')) parts.push('GNU/Linux');
    ctx.out(parts.join(' ') + '\n');
    return 0;
  },
};

const hostname: ShellCommand = {
  ...cmdDoc({
    name: 'hostname',
    summary: bi('показать или задать имя машины', 'show or set the host name'),
    whatis: 'show or set the system\'s host name',
    synopsis: ['hostname [name]'],
    description: 'hostname prints the name of the machine as the kernel knows it (the UTS namespace of the process). With an argument, root sets it until the next boot; the name that survives a reboot is in /etc/hostname (hostnamectl set-hostname changes both).',
    options: [['-I, --all-ip-addresses', 'Display all network addresses of the host.']],
    seeAlso: 'hostname(5), hostnamectl(1), uts_namespaces(7)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    if (args[0] === '-I' || args[0] === '--all-ip-addresses') {
      ctx.out(m.shellProc().ns.net === HOST_NS.net ? '10.0.0.10 \n' : '\n');
      return 0;
    }
    if (!args.length || args[0] === '-s' || args[0] === '-f') {
      ctx.out(m.utsHostname() + '\n');
      return 0;
    }
    if (!hasCap(ctx, 'sys_admin')) {
      ctx.err('hostname: you must be root to change the host name\n');
      return 1;
    }
    m.setUtsHostname(args[0]);
    return 0;
  },
};

const hostnamectl: ShellCommand = {
  ...cmdDoc({
    name: 'hostnamectl',
    summary: bi('показать и задать имя машины навсегда', 'control the system hostname'),
    whatis: 'Control the system hostname',
    synopsis: ['hostnamectl [OPTIONS...] {COMMAND}'],
    description: 'hostnamectl may be used to query and change the system hostname and related settings. set-hostname NAME changes the name now and writes it to /etc/hostname.',
    seeAlso: 'hostname(1), hostname(5)',
    url: 'https://www.freedesktop.org/software/systemd/man/latest/hostnamectl.html',
  }),
  run(ctx) {
    const m = M(ctx);
    const [sub, name] = ctx.argv.slice(1);
    if (sub === 'set-hostname' && name) {
      if (ctx.user.uid !== 0) {
        ctx.err('Could not set static hostname: Access denied\n');
        return 1;
      }
      m.setUtsHostname(name);
      m.vfs.writeFileAs('/etc/hostname', name + '\n', ROOT_CRED);
      return 0;
    }
    ctx.out(` Static hostname: ${m.hostname}\n       Icon name: computer-vm\n         Chassis: vm 🖴\n      Machine ID: 4f1e2a7c9b3d4e8f a1c2b3d4e5f60718\n  Virtualization: kvm\nOperating System: Debian GNU/Linux 13 (trixie)\n          Kernel: Linux ${KERNEL}\n    Architecture: x86-64\n`);
    return 0;
  },
};

const uptime: ShellCommand = {
  ...cmdDoc({
    name: 'uptime',
    summary: bi('сколько машина работает и её нагрузка', 'tell how long the system has been running'),
    whatis: 'tell how long the system has been running',
    synopsis: ['uptime [options]'],
    description: 'uptime gives a one line display of the following information: the current time, how long the system has been running, how many users are currently logged on, and the system load averages for the past 1, 5, and 15 minutes.\nSystem load averages is the average number of processes that are either in a runnable or uninterruptable state. Load averages are not normalized for the number of CPUs in a system, so a load average of 1 means a single CPU system is loaded all the time while on a 4 CPU system it means it was idle 75% of the time.',
    seeAlso: 'top(1), w(1), proc(5)',
  }),
  run(ctx) {
    const m = M(ctx);
    m.syncKernel();
    const load = m.vfs.readFileAs('/proc/loadavg', ROOT_CRED).split(' ').slice(0, 3).join(', ');
    const up = Math.floor((m.now() - m.bootAt) / 60000);
    ctx.out(` ${new Date(m.now()).toISOString().slice(11, 19)} up ${up} min,  1 user,  load average: ${load}\n`);
    return 0;
  },
};

const free: ShellCommand = {
  ...cmdDoc({
    name: 'free',
    summary: bi('показать занятую и доступную память', 'display amount of free and used memory'),
    whatis: 'Display amount of free and used memory in the system',
    synopsis: ['free [options]'],
    description:
      'free displays the total amount of free and used physical and swap memory in the system, as well as the buffers and caches used by the kernel. The information is gathered by parsing /proc/meminfo.\nfree: unused memory. buff/cache: memory the kernel uses for caches and can give back. available: an estimation of how much memory is available for starting new applications, without swapping. Judge the machine by available, not by free.',
    options: [
      ['-h, --human', 'Show all output fields automatically scaled to shortest three digit unit and display the units of print out.'],
      ['-m, --mebi', 'Display the amount of memory in mebibytes.'],
      ['-g, --gibi', 'Display the amount of memory in gibibytes.'],
    ],
    seeAlso: 'top(1), proc(5)',
  }),
  run(ctx) {
    const m = M(ctx);
    const a = parseArgs(ctx.argv.slice(1), { short: 'hmgkbtw', long: { human: 'h', mebi: 'm', gibi: 'g', kibi: 'k' } });
    const used = MEM_BASE_USED + (m.procs.list() as KProc[]).reduce((s, p) => s + p.rss, 0);
    const freeK = Math.max(0, MEM_TOTAL - used - MEM_CACHE);
    const avail = freeK + Math.round(MEM_CACHE * 0.85);
    const fmt = (k: number) => (a.flags.has('h') ? humanSize(k * 1024).replace(/([KMGT])$/, '$1i') : a.flags.has('m') ? String(Math.round(k / 1024)) : a.flags.has('g') ? String(Math.round(k / 1048576)) : String(k));
    const row = (...c: string[]) => c.map((x, i) => (i === 0 ? x.padEnd(7) : x.padStart(11))).join('') + '\n';
    ctx.out(row('', 'total', 'used', 'free', 'shared', 'buff/cache', 'available').replace(/^ {7}/, '       '));
    ctx.out(row('Mem:', fmt(MEM_TOTAL), fmt(used), fmt(freeK), fmt(12_400), fmt(MEM_CACHE), fmt(avail)));
    ctx.out(row('Swap:', fmt(0), fmt(0), fmt(0)));
    return 0;
  },
};

const nproc: ShellCommand = {
  ...cmdDoc({ name: 'nproc', summary: bi('сколько процессоров', 'print the number of processing units'), whatis: 'print the number of processing units available', synopsis: ['nproc [OPTION]...'], description: 'Print the number of processing units available to the current process. This machine has one.', seeAlso: 'lscpu(1)' }),
  run(ctx) {
    ctx.out('1\n');
    return 0;
  },
};

const lscpu: ShellCommand = {
  ...cmdDoc({ name: 'lscpu', summary: bi('Показать устройство процессора.', 'Show CPU architecture.'), whatis: 'display information about CPU architecture', synopsis: ['lscpu'], description: 'Display CPU architecture, logical processor count and model.', seeAlso: 'nproc(1)' }),
  run(ctx) {
    ctx.out('Architecture:             x86_64\nCPU op-mode(s):           32-bit, 64-bit\nCPU(s):                   1\nOn-line CPU(s) list:      0\nThread(s) per core:       1\nCore(s) per socket:       1\nSocket(s):                1\nModel name:               Simulated x86 CPU\n');
    return 0;
  },
};

const dmesg: ShellCommand = {
  ...cmdDoc({
    name: 'dmesg',
    summary: bi('показать сообщения ядра', 'print the kernel ring buffer'),
    whatis: 'print or control the kernel ring buffer',
    synopsis: ['dmesg [options]'],
    description: 'dmesg is used to examine or control the kernel ring buffer: the messages of the kernel (boot, devices, the OOM killer).\nOn Debian kernel.dmesg_restrict is 1, so reading it needs CAP_SYSLOG: run it with sudo.',
    options: [['-T, --ctime', 'Print human-readable timestamps.'], ['-H, --human', 'Enable human-readable output.']],
    seeAlso: 'journalctl(1), syslog(2)',
    url: 'https://man7.org/linux/man-pages/man1/dmesg.1.html',
  }),
  run(ctx) {
    const m = M(ctx);
    if (!hasCap(ctx, 'syslog')) {
      ctx.err('dmesg: read kernel buffer failed: Operation not permitted\n');
      return 1;
    }
    const human = ctx.argv.includes('-T') || ctx.argv.includes('-H');
    for (const d of m.kernel.dmesg) {
      const t = Math.max(0, (d.at - m.bootAt) / 1000);
      ctx.out(human ? `[${new Date(d.at).toUTCString().slice(0, 25)}] ${d.msg}\n` : `[${t.toFixed(6).padStart(12)}] ${d.msg}\n`);
    }
    return 0;
  },
};

const reboot: ShellCommand = {
  ...cmdDoc({
    name: 'reboot',
    section: 8,
    summary: bi('перезагрузить машину', 'reboot the machine'),
    whatis: 'Power off, reboot, or halt the machine',
    synopsis: ['reboot [OPTIONS...]'],
    description: 'reboot asks systemd to restart the machine: every process ends, file systems in memory (tmpfs: /tmp, /run) are emptied, and at boot systemd starts the units that are enabled. A unit that was started but never enabled does not come back.',
    seeAlso: 'systemctl(1), shutdown(8)',
    url: 'https://www.freedesktop.org/software/systemd/man/latest/reboot.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    if (ctx.user.uid !== 0) {
      ctx.err('Call to Reboot failed: Access denied\n');
      return 1;
    }
    ctx.out('\x1b[2mBroadcast message from root@' + m.hostname + ' on pts/0: The system will reboot now!\x1b[0m\n');
    await m.systemd.reboot();
    ctx.out(`\x1b[2m[ the machine rebooted: ${m.hostname} login: learner (automatic login) ]\x1b[0m\n`);
    return 0;
  },
};

// ── disks ──

interface DiskFs {
  dev: string;
  uuid: string;
  type: string;
  ino: number;
}

class Disks {
  fs: DiskFs[] = [];
  parts: Record<string, string[]> = { sda: ['sda1'], sdb: [] };
  snapshot() {
    return { fs: this.fs, parts: this.parts };
  }
  restore(s: unknown) {
    const x = s as { fs: DiskFs[]; parts: Record<string, string[]> };
    this.fs = x.fs.map((f) => ({ ...f }));
    this.parts = { ...x.parts };
  }
}
const disks = (m: SimMachine) => m.ext('disks', () => new Disks());
const SIZES: Record<string, number> = { sda: 8 * 1024, sda1: 8 * 1024 - 1, sdb: 64, sdb1: 63 };

const lsblk: ShellCommand = {
  ...cmdDoc({
    name: 'lsblk',
    section: 8,
    summary: bi('показать диски и разделы', 'list block devices'),
    whatis: 'list block devices',
    synopsis: ['lsblk [options] [device...]'],
    description: 'lsblk lists information about all available block devices (disks and their partitions) and where they are mounted.',
    options: [['-f, --fs', 'Output info about filesystems: FSTYPE, UUID, MOUNTPOINTS.']],
    seeAlso: 'blkid(8), findmnt(8), fdisk(8)',
  }),
  run(ctx) {
    const m = M(ctx);
    const d = disks(m);
    const mounts = m.kernel.visibleMounts();
    const fsOf = (dev: string) => d.fs.find((f) => f.dev === dev) ?? (dev === 'sda1' ? { dev, uuid: '3b8f6c1e-5d1a-4f6e-9a57-2c1f0e7d9a10', type: 'ext4', ino: 0 } : undefined);
    const mp = (dev: string) => mounts.filter((x) => x.source === `/dev/${dev}` || (fsOf(dev) && x.source === `UUID=${fsOf(dev)!.uuid}`)).map((x) => x.target).join(',');
    const fsMode = ctx.argv.includes('-f') || ctx.argv.includes('--fs');
    ctx.out(fsMode ? 'NAME   FSTYPE FSVER LABEL UUID                                 FSAVAIL FSUSE% MOUNTPOINTS\n' : 'NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\n');
    for (const disk of ['sda', 'sdb']) {
      const rows = [disk, ...d.parts[disk]];
      rows.forEach((dev, i) => {
        const name = i === 0 ? dev : `${i === rows.length - 1 ? '└─' : '├─'}${dev}`;
        const size = SIZES[dev] >= 1024 ? `${SIZES[dev] / 1024 >= 7.99 ? '8' : (SIZES[dev] / 1024).toFixed(0)}G` : `${SIZES[dev]}M`;
        const f = fsOf(dev);
        if (fsMode) ctx.out(`${name.padEnd(6)} ${(f?.type ?? '').padEnd(6)} ${f ? '1.0  ' : '     '}       ${(f?.uuid ?? '').padEnd(36)} ${mp(dev) ? '   4.1G    42%' : '              '} ${mp(dev)}\n`);
        else ctx.out(`${name.padEnd(6)} ${`8:${disk === 'sda' ? i : 16 + i}`.padStart(7)}  0 ${size.padStart(4)}  0 ${i === 0 ? 'disk' : 'part'} ${mp(dev)}\n`);
      });
    }
    return 0;
  },
};

const blkid: ShellCommand = {
  ...cmdDoc({
    name: 'blkid',
    section: 8,
    summary: bi('показать UUID и тип файловых систем', 'show UUIDs and types of file systems'),
    whatis: 'locate/print block device attributes',
    synopsis: ['blkid [device...]'],
    description: 'blkid prints the attributes of block devices: the UUID of the file system on them and its TYPE. The UUID belongs to the file system, not to the device name, which is why /etc/fstab should use UUID=.',
    seeAlso: 'lsblk(8), fstab(5)',
  }),
  run(ctx) {
    const m = M(ctx);
    if (ctx.user.uid !== 0) return 2;
    const requested = ctx.argv.slice(1);
    const show = (dev: string) => !requested.length || requested.includes(dev);
    if (show('/dev/sda1')) ctx.out('/dev/sda1: UUID="3b8f6c1e-5d1a-4f6e-9a57-2c1f0e7d9a10" BLOCK_SIZE="4096" TYPE="ext4" PARTUUID="6a2e7c11-01"\n');
    for (const f of disks(m).fs) if (show(`/dev/${f.dev}`)) ctx.out(`/dev/${f.dev}: UUID="${f.uuid}" BLOCK_SIZE="4096" TYPE="${f.type}"\n`);
    return 0;
  },
};

const mkfs: ShellCommand = {
  ...cmdDoc({
    name: 'mkfs.ext4',
    section: 8,
    summary: bi('создать файловую систему ext4', 'create an ext4 file system'),
    whatis: 'create an ext2/ext3/ext4 file system',
    synopsis: ['mkfs.ext4 [-L volume-label] device'],
    description: 'mke2fs is used to create an ext2, ext3, or ext4 file system, usually in a disk partition: a superblock, an inode table and data blocks. Everything that was on the device is lost.',
    seeAlso: 'mount(8), fstab(5), blkid(8)',
    url: 'https://man7.org/linux/man-pages/man8/mke2fs.8.html',
  }),
  run(ctx) {
    const m = M(ctx);
    const dev = ctx.argv.slice(1).find((x) => x.startsWith('/dev/'));
    if (!dev) return usageError(ctx, 'missing device');
    if (ctx.user.uid !== 0) {
      ctx.err(`mke2fs 1.47.2 (1-Jan-2025)\nmkfs.ext4: Permission denied while trying to determine filesystem size\n`);
      return 1;
    }
    const name = dev.slice(5);
    if (!m.vfs.devOf(dev)?.startsWith('blk:')) {
      ctx.err(`mke2fs 1.47.2 (1-Jan-2025)\nThe file ${dev} does not exist and no size was specified.\n`);
      return 1;
    }
    if (m.kernel.visibleMounts().some((x) => x.source === dev)) {
      ctx.err(`mke2fs 1.47.2 (1-Jan-2025)\n${dev} contains a ext4 file system\n\tlast mounted on ${m.kernel.visibleMounts().find((x) => x.source === dev)!.target}\nmkfs.ext4: ${dev} is apparently in use by the system; will not make a filesystem here!\n`);
      return 1;
    }
    const d = disks(m);
    const uuid = `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
    const ino = m.vfs.newDir();
    d.fs = d.fs.filter((f) => f.dev !== name);
    d.fs.push({ dev: name, uuid, type: 'ext4', ino });
    ctx.out(
      `mke2fs 1.47.2 (1-Jan-2025)\nCreating filesystem with ${SIZES[name] * 256} 4k blocks and ${SIZES[name] * 256} inodes\nFilesystem UUID: ${uuid}\nAllocating group tables: done\nWriting inode tables: done\nCreating journal (1024 blocks): done\nWriting superblocks and filesystem accounting information: done\n\n`,
    );
    void ino;
    return 0;
  },
};

let hexSeed = 0x5eed;
function hex(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    hexSeed = (hexSeed * 1103515245 + 12345) & 0x7fffffff;
    s += (hexSeed % 16).toString(16);
  }
  return s;
}

const mount: ShellCommand = {
  ...cmdDoc({
    name: 'mount',
    section: 8,
    summary: bi('подключить файловую систему в точку дерева', 'mount a file system'),
    whatis: 'mount a filesystem',
    synopsis: ['mount [-t fstype] [-o options] device mountpoint', 'mount --bind olddir newdir', 'mount -a', 'mount'],
    description:
      'All files accessible in a Unix system are arranged in one big tree, the file hierarchy, rooted at /. These files can be spread out over several devices. The mount command serves to attach the filesystem found on some device to the big file tree. Conversely, the umount(8) command will detach it again.\nThe previous contents (if any) and owner and mode of dir become invisible, and as long as this filesystem remains mounted, the pathname dir refers to the root of the filesystem on device.\nWithout arguments mount lists what is mounted.',
    options: [
      ['-t, --types fstype', 'The argument following the -t is used to indicate the filesystem type: ext4, tmpfs, proc, overlay.'],
      ['-o, --options opts', 'Use the specified mount options, a comma-separated list: size=64m for tmpfs; lowerdir=…,upperdir=…,workdir=… for overlay; ro, rw.'],
      ['-a, --all', 'Mount all filesystems mentioned in fstab (except those with noauto).'],
      ['--bind', 'Remount a subtree somewhere else (so that its contents are available in both places).'],
    ],
    extra: [
      { id: 'BIND MOUNT OPERATION', body: 'Remount part of the file hierarchy somewhere else. The call is: mount --bind olddir newdir. After this call the same contents are accessible in two places.' },
      { id: 'THE FILES /ETC/FSTAB', body: 'The file /etc/fstab (see fstab(5)) may contain lines describing what devices are usually mounted where, using which options. The command mount -a causes all filesystems mentioned in fstab to be mounted.' },
    ],
    examples: [
      ['mount /dev/sdb1 /data', 'Attach the file system on the first partition of the second disk at /data.'],
      ['mount -t tmpfs -o size=64m tmpfs /mnt/scratch', 'A file system in memory: fast, and empty after a reboot.'],
      ['mount -t overlay overlay -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged', 'An overlay: changes in /lab/merged go to /lab/upper, /lab/lower stays untouched.'],
    ],
    seeAlso: 'umount(8), findmnt(8), fstab(5), mount(2)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    if (!args.length) {
      ctx.out(m.kernel.visibleMounts().map((x) => `${x.source} on ${x.target} type ${x.fstype} (${x.options})`).join('\n') + '\n');
      return 0;
    }
    let type: string | undefined;
    let opts = '';
    let bind = false;
    let all = false;
    const ops: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-t') type = args[++i];
      else if (a === '-o') opts = args[++i] ?? '';
      else if (a === '--bind' || a === '-B') bind = true;
      else if (a === '-a') all = true;
      else if (a === '--make-private' || a === '--make-rprivate') return 0;
      else ops.push(a);
    }
    if (!hasCap(ctx, 'sys_admin')) {
      ctx.err('mount: only root can do that\n');
      return 1;
    }
    const d = disks(m);
    const mnt = m.shellProc().ns.mnt;
    const doMount = (source: string, target: string, fstype: string | undefined, o: string): number => {
      const t = normalize(ctx.fs.resolve(target));
      const root = m.shellProc().root;
      const outer = root === '/' ? t : normalize(root + t);
      const st = m.vfs.statAs(outer, ROOT_CRED);
      if (!st) {
        ctx.err(`mount: ${target}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`);
        return 32;
      }
      if (st.type !== 'd') {
        ctx.err(`mount: ${target}: mount point is not a directory.\n`);
        return 32;
      }
      const rec = { source, target: outer, fstype: fstype ?? 'ext4', options: o || 'rw,relatime', ns: mnt };
      if (bind) {
        const src = normalize(root === '/' ? ctx.fs.resolve(source) : root + ctx.fs.resolve(source));
        const ino = m.vfs.inoOf(src);
        if (ino === undefined) {
          ctx.err(`mount: ${target}: special device ${source} does not exist.\n`);
          return 32;
        }
        m.kernel.attach({ ...rec, source: m.kernel.visibleMounts().find((x) => src.startsWith(x.target))?.source ?? source, fstype: 'none', options: 'rw,bind', ino });
        return 0;
      }
      if (rec.fstype === 'tmpfs') {
        const size = /size=(\d+)([kmg]?)/i.exec(o);
        const kb = size ? Number(size[1]) * ({ k: 1, m: 1024, g: 1048576 }[size[2].toLowerCase()] ?? 1 / 1024) : 1006592;
        m.kernel.attach({ ...rec, ino: m.vfs.newDir(0o1777), size: Math.round(kb), options: `rw,relatime${size ? `,size=${Math.round(kb)}k` : ''}` });
        return 0;
      }
      if (rec.fstype === 'proc') {
        const pidNs = m.shellProc().ns.pid;
        const mntRec = m.kernel.ns.get(mnt);
        if (outer === '/proc') {
          if (mntRec && mnt !== HOST_NS.mnt) mntRec.procPidNs = pidNs;
          m.kernel.attach({ ...rec, source: 'proc', options: 'rw,nosuid,nodev,noexec,relatime' });
          m.syncKernel();
          return 0;
        }
        m.kernel.attach({ ...rec, source: 'proc', ino: m.vfs.inoOf('/proc')!, options: 'rw,nosuid,nodev,noexec,relatime' });
        return 0;
      }
      if (rec.fstype === 'overlay') {
        const kv = Object.fromEntries(o.split(',').map((x) => x.split('=') as [string, string]));
        if (!kv.lowerdir) {
          ctx.err(`mount: ${target}: wrong fs type, bad option, bad superblock on overlay, missing codepage or helper program, or other error.\n       dmesg(1) may have more information after failed mount system call.\n`);
          m.kernel.log('overlayfs: missing \'lowerdir\'');
          return 32;
        }
        const abs = (p: string) => normalize(root === '/' ? ctx.fs.resolve(p) : root + ctx.fs.resolve(p));
        const lower = kv.lowerdir.split(':').map(abs);
        const upper = kv.upperdir ? abs(kv.upperdir) : '';
        for (const p of [...lower, ...(upper ? [upper, abs(kv.workdir ?? '')] : [])]) {
          if (!m.vfs.statAs(p, ROOT_CRED)) {
            ctx.err(`mount: ${target}: special device overlay does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`);
            m.kernel.log(`overlayfs: failed to resolve '${p}': -2`);
            return 32;
          }
        }
        if (upper && !kv.workdir) {
          ctx.err(`mount: ${target}: wrong fs type, bad option, bad superblock on overlay, missing codepage or helper program, or other error.\n`);
          m.kernel.log("overlayfs: missing 'workdir'");
          return 32;
        }
        const merged = m.kernel.overlayMerge(lower, upper);
        m.kernel.attach({ ...rec, source: 'overlay', options: `rw,relatime,lowerdir=${lower.join(':')}${upper ? `,upperdir=${upper},workdir=${abs(kv.workdir)}` : ''}`, ino: merged.ino, overlay: { lower, upper, work: kv.workdir ? abs(kv.workdir) : '', base: merged.base } });
        return 0;
      }
      // a block device
      const devName = source.startsWith('UUID=') ? d.fs.find((f) => f.uuid === source.slice(5))?.dev : source.replace(/^\/dev\//, '');
      if (!devName || !m.vfs.devOf(`/dev/${devName}`)?.startsWith('blk:')) {
        ctx.err(`mount: ${target}: special device ${source} does not exist.\n`);
        return 32;
      }
      const f = d.fs.find((x) => x.dev === devName);
      if (!f) {
        ctx.err(`mount: ${target}: wrong fs type, bad option, bad superblock on /dev/${devName}, missing codepage or helper program, or other error.\n       dmesg(1) may have more information after failed mount system call.\n`);
        return 32;
      }
      if (m.kernel.visibleMounts().some((x) => x.source === `/dev/${devName}` && x.target === outer)) {
        ctx.err(`mount: ${target}: /dev/${devName} already mounted on ${target}.\n`);
        return 32;
      }
      if (!m.vfs.statAs('/dev/null', ROOT_CRED)) return 1;
      const rootDir = f.ino;
      if (!m.vfs.hasIno(rootDir)) return 1;
      m.kernel.attach({ ...rec, source: `/dev/${devName}`, fstype: f.type, ino: rootDir, size: SIZES[devName] * 1024 - 2400 });
      m.kernel.log(`EXT4-fs (${devName}): mounted filesystem ${f.uuid} r/w with ordered data mode. Quota mode: none.`);
      return 0;
    };
    if (all) {
      const fstab = m.vfs.readFileAs('/etc/fstab', ROOT_CRED);
      let exit = 0;
      for (const l of fstab.split('\n')) {
        const parts = l.trim().split(/\s+/);
        if (!l.trim() || l.trim().startsWith('#') || parts.length < 2) continue;
        const [src, tgt, fst, o] = parts;
        if (tgt === '/' || tgt === 'none' || (o ?? '').includes('noauto')) continue;
        if (m.kernel.visibleMounts().some((x) => x.target === normalize(tgt))) continue;
        const r = doMount(src, tgt, fst, o === 'defaults' ? '' : (o ?? ''));
        if (r) exit = r;
      }
      return exit;
    }
    if (ops.length === 1) {
      const fstab = m.vfs.readFileAs('/etc/fstab', ROOT_CRED);
      const line = fstab.split('\n').find((l) => l.trim().split(/\s+/)[1] === ops[0] || l.trim().split(/\s+/)[0] === ops[0]);
      if (!line) {
        ctx.err(`mount: ${ops[0]}: can't find in /etc/fstab.\n`);
        return 1;
      }
      const [src, tgt, fst, o] = line.trim().split(/\s+/);
      return doMount(src, tgt, fst, o === 'defaults' ? '' : (o ?? ''));
    }
    if (ops.length < 2) return usageError(ctx, 'bad usage');
    return doMount(ops[0], ops[1], type, opts);
  },
};

const umount: ShellCommand = {
  ...cmdDoc({
    name: 'umount',
    section: 8,
    summary: bi('отключить файловую систему', 'unmount a file system'),
    whatis: 'unmount filesystems',
    synopsis: ['umount {directory|device}'],
    description: 'The umount command detaches the mentioned file system from the file hierarchy. What was in the directory before the mount becomes visible again. A file system cannot be unmounted while it is busy: a process has its current directory there or holds a file open.',
    seeAlso: 'mount(8)',
  }),
  run(ctx) {
    const m = M(ctx);
    const target = ctx.argv.slice(1).find((x) => !x.startsWith('-'));
    if (!target) return usageError(ctx, 'bad usage');
    if (!hasCap(ctx, 'sys_admin')) {
      ctx.err(`umount: ${target}: must be superuser to unmount.\n`);
      return 32;
    }
    const root = m.shellProc().root;
    const abs = normalize(target.startsWith('/dev/') ? target : root === '/' ? ctx.fs.resolve(target) : root + ctx.fs.resolve(target));
    const rec = m.kernel.visibleMounts().filter((x) => x.target === abs || x.source === abs).pop();
    if (!rec) {
      ctx.err(`umount: ${target}: not mounted.\n`);
      return 32;
    }
    if (['/', '/proc', '/sys', '/dev', '/run', '/sys/fs/cgroup'].includes(rec.target) && rec.ino === undefined && rec.ns === HOST_NS.mnt) {
      ctx.err(`umount: ${rec.target}: target is busy.\n`);
      return 32;
    }
    const cwd = m.cwd();
    if (cwd === rec.target || cwd.startsWith(rec.target + '/')) {
      ctx.err(`umount: ${rec.target}: target is busy.\n`);
      return 32;
    }
    m.kernel.syncOverlays();
    m.kernel.detach(rec.target);
    return 0;
  },
};

const findmnt: ShellCommand = {
  ...cmdDoc({
    name: 'findmnt',
    section: 8,
    summary: bi('показать, что куда смонтировано', 'find a mounted file system'),
    whatis: 'find a filesystem',
    synopsis: ['findmnt [options] [device|mountpoint]'],
    description: 'findmnt will list all mounted filesystems or search for a filesystem: TARGET, SOURCE, FSTYPE, OPTIONS.',
    options: [['--verify', 'Check mount table content: the /etc/fstab file is parsed and verified.'], ['-t, --types list', 'Limit the set of printed filesystems.']],
    seeAlso: 'mount(8), fstab(5)',
  }),
  run(ctx) {
    const m = M(ctx);
    let list = m.kernel.visibleMounts();
    const args = ctx.argv.slice(1);
    const ti = args.indexOf('-t');
    if (ti >= 0) list = list.filter((x) => (args[ti + 1] ?? '').split(',').includes(x.fstype));
    const target = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-t');
    if (target) list = list.filter((x) => x.target === normalize(ctx.fs.resolve(target)) || x.source === target);
    if (!list.length) return 1;
    const w = Math.max(6, ...list.map((x) => x.target.length));
    const ws = Math.max(6, ...list.map((x) => x.source.length));
    ctx.out(`${'TARGET'.padEnd(w)} ${'SOURCE'.padEnd(ws)} FSTYPE   OPTIONS\n`);
    for (const x of list) ctx.out(`${x.target.padEnd(w)} ${x.source.padEnd(ws)} ${x.fstype.padEnd(8)} ${x.options}\n`);
    return 0;
  },
};

// ── what the machine sees of the network ──

const ip: ShellCommand = {
  ...cmdDoc({
    name: 'ip',
    section: 8,
    summary: bi('показать сетевые интерфейсы и маршруты машины', 'show network interfaces and routes'),
    whatis: 'show / manipulate routing, network devices, interfaces and tunnels',
    synopsis: ['ip [ OPTIONS ] OBJECT { COMMAND | help }', 'ip address show', 'ip route show'],
    description: 'ip shows the network setup of the machine as the kernel (the network namespace of the process) sees it. OBJECT: address (a), link (l), route (r). The models behind the output are the subject of the Networks block.',
    seeAlso: 'ip-address(8), ip-route(8), ss(8)',
  }),
  run(ctx) {
    const m = M(ctx);
    const [obj = '', sub = 'show', ...rest] = ctx.argv.slice(1);
    const inNs = m.shellProc().ns.net !== HOST_NS.net;
    const nsRec = m.kernel.ns.get(m.shellProc().ns.net);
    const loUp = !inNs || !!nsRec?.loUp;
    if (/^l(ink)?$/.test(obj) && sub === 'set' && rest[0] === 'lo' && rest[1] === 'up') {
      if (!hasCap(ctx, 'net_admin')) {
        ctx.err('RTNETLINK answers: Operation not permitted\n');
        return 2;
      }
      if (nsRec) nsRec.loUp = true;
      return 0;
    }
    if (/^a(ddr(ess)?)?$/.test(obj) || /^l(ink)?$/.test(obj)) {
      const link = /^l/.test(obj);
      ctx.out(`1: lo: <LOOPBACK${loUp ? ',UP,LOWER_UP' : ''}> mtu 65536 qdisc ${loUp ? 'noqueue' : 'noop'} state ${loUp ? 'UNKNOWN' : 'DOWN'} group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n`);
      if (!link && loUp) ctx.out('    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n');
      if (!inNs) {
        ctx.out('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff\n');
        if (!link) ctx.out('    inet 10.0.0.10/24 brd 10.0.0.255 scope global eth0\n       valid_lft forever preferred_lft forever\n');
      }
      return 0;
    }
    if (/^r(oute)?$/.test(obj)) {
      if (!inNs) ctx.out('default via 10.0.0.1 dev eth0 proto static\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.10\n');
      return 0;
    }
    if (obj === 'netns') return 0;
    ctx.err(`Object "${obj}" is unknown, try "ip help".\n`);
    return 255;
  },
};

const ss: ShellCommand = {
  ...cmdDoc({
    name: 'ss',
    section: 8,
    summary: bi('какие программы ждут подключений', 'show which programs wait for connections'),
    whatis: 'another utility to investigate sockets',
    synopsis: ['ss [options] [ FILTER ]'],
    description: 'ss is used to dump socket statistics. ss -ltnp lists the programs that listen (-l) on TCP (-t) with numbers (-n) and the process (-p) that owns each socket; seeing the process of another user needs root.',
    options: [
      ['-l, --listening', 'Display only listening sockets.'],
      ['-t, --tcp', 'Display TCP sockets.'],
      ['-n, --numeric', 'Do not try to resolve service names.'],
      ['-p, --processes', 'Show process using socket.'],
    ],
    seeAlso: 'ip(8), lsof(8)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1).join('');
    const showP = args.includes('p');
    const inNs = m.shellProc().ns.net !== HOST_NS.net;
    ctx.out('State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\n');
    if (inNs) return 0;
    for (const { port, p } of listening(m).sort((a, b) => a.port - b.port)) {
      const vis = showP && (ctx.user.uid === 0 || p.uid === ctx.user.uid);
      const proc = vis ? `users:(("${p.cmd}",pid=${p.pid},fd=${port === 22 ? 3 : 6}))` : '';
      ctx.out(`LISTEN 0      ${String(p.cmd === 'nginx' ? 511 : 128).padEnd(6)} ${`0.0.0.0:${port}`.padStart(18)} ${'0.0.0.0:*'.padStart(17)} ${proc}\n`);
    }
    return 0;
  },
};

const curl: ShellCommand = {
  ...cmdDoc({
    name: 'curl',
    summary: bi('сделать HTTP-запрос', 'transfer a URL'),
    whatis: 'transfer a URL',
    synopsis: ['curl [options] [URL...]'],
    description: 'curl is a tool for transferring data from or to a server using URLs. This machine reaches only itself (localhost, 127.0.0.1, 10.0.0.10): what answers is the program that listens on the number in the URL.',
    options: [
      ['-I, --head', 'Fetch the headers only.'],
      ['-i, --include', 'Include the HTTP response headers in the output.'],
      ['-s, --silent', 'Silent or quiet mode. Do not show progress meter or error messages.'],
      ['-o, --output <file>', 'Write output to <file> instead of stdout.'],
      ['-f, --fail', 'Fail fast with no output at all on server errors.'],
    ],
    exit: '6  Couldn\'t resolve host.\n7  Failed to connect to host.\n22 HTTP page not retrieved (with --fail).',
    seeAlso: 'wget(1)',
    url: 'https://curl.se/docs/manpage.html',
  }),
  run(ctx) {
    const m = M(ctx);
    const a = parseArgs(ctx.argv.slice(1), { short: 'IisfLkv', withValue: 'oXHd', long: { head: 'I', include: 'i', silent: 's', fail: 'f', location: 'L', output: 'o', request: 'X', header: 'H', data: 'd', insecure: 'k', verbose: 'v' } });
    if (a.error) return usageError(ctx, a.error);
    const url = a.operands[0];
    if (!url) {
      ctx.err("curl: try 'curl --help' or 'curl --manual' for more information\n");
      return 2;
    }
    const u = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/.exec(url);
    if (!u) {
      ctx.err(`curl: (3) URL rejected: Malformed input to a URL function\n`);
      return 3;
    }
    const host = u[2];
    const port = Number(u[3] ?? (u[1] === 'https' ? 443 : 80));
    const path = u[4] ?? '/';
    const inNs = m.shellProc().ns.net !== HOST_NS.net;
    if (!['localhost', '127.0.0.1', '10.0.0.10', m.hostname].includes(host)) {
      if (!a.flags.has('s')) ctx.err(`curl: (6) Could not resolve host: ${host}\n`);
      return 6;
    }
    const l = inNs ? undefined : listening(m).find((x) => x.port === port);
    if (!l) {
      if (!a.flags.has('s')) ctx.err(`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server\n`);
      return 7;
    }
    let status = 200;
    let body = '';
    let server = '';
    if (l.p.cmd === 'nginx') {
      server = 'nginx/1.26.3';
      let root = '/var/www/html';
      try {
        root = /root\s+([^;]+);/.exec(m.vfs.readFileAs('/etc/nginx/nginx.conf', ROOT_CRED))?.[1] ?? root;
      } catch {
        /* default */
      }
      const file = normalize(`${root}/${path === '/' ? 'index.html' : path}`);
      const www = m.users.find((x) => x.name === 'www-data')!;
      const fs = m.fsFor(www, () => '/', '/', '0');
      try {
        body = fs.readFile(file);
      } catch (e) {
        const code = (e as { code?: string }).code;
        status = code === 'EACCES' ? 403 : 404;
        body = `<html>\n<head><title>${status} ${status === 403 ? 'Forbidden' : 'Not Found'}</title></head>\n<body>\n<center><h1>${status} ${status === 403 ? 'Forbidden' : 'Not Found'}</h1></center>\n<hr><center>nginx/1.26.3</center>\n</body>\n</html>\n`;
        try {
          m.vfs.writeFileAs('/var/log/nginx/error.log', `${new Date(m.now()).toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '/')} [error] ${l.p.pid}#${l.p.pid}: *1 open() "${file}" failed (${status === 403 ? '13: Permission denied' : '2: No such file or directory'}), client: 127.0.0.1, server: _, request: "GET ${path} HTTP/1.1", host: "${host}"\n`, ROOT_CRED, { append: true });
        } catch {
          /* no log dir */
        }
      }
      try {
        m.vfs.writeFileAs('/var/log/nginx/access.log', `127.0.0.1 - - [${new Date(m.now()).toUTCString()}] "GET ${path} HTTP/1.1" ${status} ${body.length} "-" "curl/8.14.1"\n`, ROOT_CRED, { append: true });
      } catch {
        /* no log dir */
      }
    } else if (l.p.cmd === 'sshd') {
      ctx.err('curl: (1) Received HTTP/0.9 when not allowed\n');
      return 1;
    } else {
      server = l.p.cmd;
      body = path === '/health' ? 'ok\n' : `hello from ${l.p.cmd} on ${m.hostname}:${port} (pid ${l.p.pid})\n`;
    }
    const reason = status === 200 ? 'OK' : status === 403 ? 'Forbidden' : 'Not Found';
    const headers = `HTTP/1.1 ${status} ${reason}\r\nServer: ${server}\r\nContent-Type: text/${body.startsWith('<') ? 'html' : 'plain'}\r\nContent-Length: ${body.length}\r\n\r\n`;
    if (a.flags.has('f') && status >= 400) {
      if (!a.flags.has('s')) ctx.err(`curl: (22) The requested URL returned error: ${status}\n`);
      return 22;
    }
    const out = a.flags.has('I') ? headers : (a.flags.has('i') ? headers : '') + body;
    if (a.values.o) ctx.fs.writeFile(a.values.o, out);
    else ctx.out(out.replace(/\r/g, ''));
    return 0;
  },
};

const ping: ShellCommand = {
  ...cmdDoc({
    name: 'ping',
    summary: bi('проверить, отвечает ли машина', 'check that a host answers'),
    whatis: 'send ICMP ECHO_REQUEST to network hosts',
    synopsis: ['ping [-c count] destination'],
    description: 'ping sends a few small packets to the destination and prints the answers. On this machine only the machine itself answers.',
    options: [['-c count', 'Stop after sending count ECHO_REQUEST packets.']],
    seeAlso: 'ip(8), ss(8)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    const ci = args.indexOf('-c');
    const n = ci >= 0 ? Number(args[ci + 1]) : 4;
    const host = args.filter((x, i) => !x.startsWith('-') && args[i - 1] !== '-c')[0];
    if (!host) {
      ctx.err('ping: usage error: Destination address required\n');
      return 1;
    }
    const addr = host === 'localhost' ? '127.0.0.1' : host;
    const inNs = m.shellProc().ns.net !== HOST_NS.net;
    if (!['127.0.0.1', '10.0.0.10', m.hostname].includes(addr) || (inNs && !m.kernel.ns.get(m.shellProc().ns.net)?.loUp)) {
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(addr)) {
        ctx.err(`ping: ${host}: Temporary failure in name resolution\n`);
        return 2;
      }
      ctx.err(inNs ? 'ping: connect: Network is unreachable\n' : '');
      if (!inNs) ctx.out(`PING ${addr} (${addr}) 56(84) bytes of data.\n\n--- ${addr} ping statistics ---\n${n} packets transmitted, 0 received, 100% packet loss, time ${n * 1000 - 1000}ms\n\n`);
      return 1;
    }
    ctx.out(`PING ${host} (${addr}) 56(84) bytes of data.\n`);
    for (let i = 1; i <= n; i++) ctx.out(`64 bytes from ${addr}: icmp_seq=${i} ttl=64 time=0.0${4 + (i % 3)} ms\n`);
    ctx.out(`\n--- ${host} ping statistics ---\n${n} packets transmitted, ${n} received, 0% packet loss, time ${n * 1000 - 1000}ms\nrtt min/avg/max/mdev = 0.041/0.050/0.061/0.007 ms\n`);
    m.advance(n * 1000);
    return 0;
  },
};

// ── SSH: keys and logging in to an account on this machine ──

function fakeKey(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = 'AAAAC3NzaC1lZDI1NTE5AAAAI';
  for (let i = 0; i < 43; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    s += chars[h % 64];
  }
  return s;
}

const sshKeygen: ShellCommand = {
  ...cmdDoc({
    name: 'ssh-keygen',
    summary: bi('создать пару ключей SSH', 'generate an SSH key pair'),
    whatis: 'OpenSSH authentication key utility',
    synopsis: ['ssh-keygen [-t ed25519] [-N new_passphrase] [-C comment] [-f output_keyfile]'],
    description: 'ssh-keygen generates a key pair: the private key (id_ed25519) stays with you and must be readable only by you (mode 600); the public key (id_ed25519.pub) is the one you give to servers, in ~/.ssh/authorized_keys.',
    options: [
      ['-t ed25519 | rsa', 'Specifies the type of key to create.'],
      ['-f filename', 'Specifies the filename of the key file.'],
      ['-N new_passphrase', 'Provides the new passphrase ("" for none).'],
      ['-C comment', 'Provides a new comment.'],
      ['-l', 'Show fingerprint of specified public key file.'],
    ],
    seeAlso: 'ssh(1), ssh-copy-id(1), sshd(8)',
    url: 'https://man.openbsd.org/ssh-keygen',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'ql', withValue: 'tfNCb', long: {} });
    if (a.error) return usageError(ctx, a.error);
    const home = ctx.env.HOME ?? ctx.user.home;
    if (a.flags.has('l')) {
      const f = a.values.f ?? `${home}/.ssh/id_ed25519.pub`;
      try {
        const k = ctx.fs.readFile(f).split(' ');
        ctx.out(`256 SHA256:${btoa(k[1]?.slice(0, 32) ?? '').slice(0, 43)} ${k[2]?.trim() ?? ''} (ED25519)\n`);
        return 0;
      } catch {
        ctx.err(`${f}: No such file or directory\n`);
        return 1;
      }
    }
    const type = a.values.t ?? 'ed25519';
    const file = a.values.f ?? `${home}/.ssh/id_${type}`;
    const comment = a.values.C ?? `${ctx.user.name}@${M(ctx).utsHostname()}`;
    const dir = file.slice(0, file.lastIndexOf('/')) || '.';
    if (!ctx.fs.exists(dir)) {
      ctx.fs.mkdir(dir);
      ctx.fs.chmod(dir, 0o700);
    }
    if (ctx.fs.exists(file)) {
      ctx.err(`${file} already exists.\nOverwrite (y/n)? n\n`);
      return 1;
    }
    const key = fakeKey(file + comment + M(ctx).now());
    ctx.out(`Generating public/private ${type} key pair.\n`);
    ctx.fs.writeFile(file, `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n${key}\n-----END OPENSSH PRIVATE KEY-----\n`);
    ctx.fs.chmod(file, 0o600);
    ctx.fs.writeFile(`${file}.pub`, `ssh-${type} ${key} ${comment}\n`);
    ctx.fs.chmod(`${file}.pub`, 0o644);
    ctx.out(`Your identification has been saved in ${file}\nYour public key has been saved in ${file}.pub\nThe key fingerprint is:\nSHA256:${btoa(key.slice(0, 32)).slice(0, 43)} ${comment}\n`);
    return 0;
  },
};

/** What sshd checks before it trusts authorized_keys (StrictModes yes, sshd_config(5)). */
export function strictModesProblem(m: SimMachine, home: string, uid: number): string | null {
  for (const p of [home, `${home}/.ssh`, `${home}/.ssh/authorized_keys`]) {
    const st = m.vfs.statAs(p, ROOT_CRED);
    if (!st) return p.endsWith('authorized_keys') ? 'missing' : null;
    if ((st.uid !== uid && st.uid !== 0) || st.mode & 0o022) return `Authentication refused: bad ownership or modes for ${p.endsWith('authorized_keys') ? 'file' : 'directory'} ${p}`;
  }
  return null;
}

const ssh: ShellCommand = {
  ...cmdDoc({
    name: 'ssh',
    summary: bi('войти на машину по SSH', 'log in to a machine over SSH'),
    whatis: 'OpenSSH remote login client',
    synopsis: ['ssh [-i identity_file] [-p port] [user@]hostname [command]'],
    description:
      'ssh (SSH client) is a program for logging into a remote machine and for executing commands on it. It opens an encrypted channel to sshd on the server (port 22) and starts your shell there.\nThe server checks your key: it looks for your public key in ~/.ssh/authorized_keys of the account and asks the client to prove it has the matching private key. The password is not sent.\nOn this simulated machine there is no second machine: ssh user@localhost logs in to another account of this same machine, which is enough to see how keys work.',
    options: [
      ['-i identity_file', 'Selects a file from which the identity (private key) for public key authentication is read. The default is ~/.ssh/id_ed25519 and the other key types.'],
      ['-p port', 'Port to connect to on the remote host.'],
      ['-v', 'Verbose mode: print debugging messages about its progress.'],
    ],
    extra: [{ id: 'FILES', body: '~/.ssh/known_hosts\n       Contains a list of host keys for all hosts the user has logged into.\n~/.ssh/id_ed25519, ~/.ssh/id_ed25519.pub\n       The private and the public key of the user. The private key must be readable only by the user.\n~/.ssh/authorized_keys\n       Lists the public keys that can be used for logging in as this user. It must not be writable by other users (sshd StrictModes).\n~/.ssh/config\n       The per-user configuration file: Host, HostName, User, IdentityFile.' }],
    seeAlso: 'ssh-keygen(1), ssh-copy-id(1), sshd(8), sshd_config(5)',
    url: 'https://man.openbsd.org/ssh',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let identity: string | undefined;
    let verbose = false;
    const ops: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-i') identity = args[++i];
      else if (args[i] === '-p') i++;
      else if (args[i] === '-v') verbose = true;
      else if (args[i] === '-o') i++;
      else ops.push(args[i]);
    }
    const dest = ops[0];
    if (!dest) {
      ctx.err('usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-i identity_file] [-p port] destination [command [argument ...]]\n');
      return 255;
    }
    const at = dest.indexOf('@');
    const user = at >= 0 ? dest.slice(0, at) : ctx.user.name;
    const host = at >= 0 ? dest.slice(at + 1) : dest;
    if (!['localhost', '127.0.0.1', m.hostname, '10.0.0.10'].includes(host)) {
      ctx.err(`ssh: Could not resolve hostname ${host}: Name or service not known\n`);
      return 255;
    }
    if (!listening(m).some((l) => l.port === 22)) {
      ctx.err(`ssh: connect to host ${host} port 22: Connection refused\n`);
      return 255;
    }
    const known = `${ctx.env.HOME ?? ctx.user.home}/.ssh/known_hosts`;
    let knownText = '';
    try {
      knownText = ctx.fs.readFile(known);
    } catch {
      /* first time */
    }
    if (!knownText.includes(host)) {
      ctx.err(`The authenticity of host '${host} (127.0.0.1)' can't be established.\nED25519 key fingerprint is SHA256:Xq3w9bG1tYqv1rJ4u0n8b4yQ6uKc2mPz9w0AqL7sT1E.\nThis key is not known by any other names.\nWarning: Permanently added '${host}' (ED25519) to the list of known hosts.\n`);
      try {
        const dir = `${ctx.env.HOME ?? ctx.user.home}/.ssh`;
        if (!ctx.fs.exists(dir)) {
          ctx.fs.mkdir(dir);
          ctx.fs.chmod(dir, 0o700);
        }
        ctx.fs.writeFile(known, `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHostKeyOfTheTrainerMachine\n`, { append: true });
      } catch {
        /* cannot write known_hosts */
      }
    }
    const tu = m.users.find((u) => u.name === user);
    const keyFiles = identity ? [identity] : ['id_ed25519', 'id_rsa'].map((k) => `${ctx.env.HOME ?? ctx.user.home}/.ssh/${k}`);
    let pubs: string[] = [];
    for (const k of keyFiles) {
      try {
        const st = ctx.fs.stat(k);
        if (st && st.mode & 0o077) {
          ctx.err(`@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\nPermissions 0${(st.mode & 0o777).toString(8)} for '${k}' are too open.\nIt is required that your private key files are NOT accessible by others.\nThis private key will be ignored.\nLoad key "${k}": bad permissions\n`);
          continue;
        }
        const priv = ctx.fs.readFile(k);
        const body = priv.split('\n')[2] ?? '';
        if (body) pubs.push(body);
      } catch {
        /* no such key */
      }
    }
    pubs = pubs.filter(Boolean);
    const deny = () => {
      ctx.err(`${user}@${host}: Permission denied (publickey).\n`);
      return 255;
    };
    if (!tu || !/(bash|sh)$/.test(tu.shell)) return deny();
    const problem = strictModesProblem(m, tu.home, tu.uid);
    let authorized = '';
    try {
      authorized = m.vfs.readFileAs(`${tu.home}/.ssh/authorized_keys`, ROOT_CRED);
    } catch {
      authorized = '';
    }
    if (verbose) ctx.err(`debug1: Connecting to ${host} [127.0.0.1] port 22.\ndebug1: Offering public key: ${keyFiles[0]} ED25519\n`);
    const ok = pubs.some((k) => authorized.includes(k)) && !problem;
    if (problem && problem !== 'missing') m.systemd.log('sshd', 22, `${problem}`, { unit: 'ssh.service', prio: 3 });
    if (!ok) {
      m.systemd.log('sshd', 22, `Connection closed by authenticating user ${user} 127.0.0.1 port 51022 [preauth]`, { unit: 'ssh.service' });
      return deny();
    }
    m.systemd.log('sshd', 22, `Accepted publickey for ${user} from 127.0.0.1 port 51022 ssh2: ED25519 SHA256:${btoa(pubs[0].slice(0, 32)).slice(0, 43)}`, { unit: 'ssh.service' });
    const as = { user: tu, capEff: capHex(tu.uid === 0 ? CAP_FULL : 0n) };
    if (ops.length > 1) return m.runLineAs(ops.slice(1).join(' '), as, { out: ctx.out, err: ctx.err, cwd: tu.home });
    ctx.out(`Linux ${m.hostname} ${KERNEL} #1 SMP PREEMPT_DYNAMIC Debian 6.12.0 x86_64\n\nThe programs included with the Debian GNU/Linux system are free software.\n`);
    m.pushShell({ user: tu.name, login: true, label: 'bash' });
    return 0;
  },
};

const sshCopyId: ShellCommand = {
  ...cmdDoc({
    name: 'ssh-copy-id',
    summary: bi('положить свой открытый ключ на сервер', 'install your public key on a server'),
    whatis: 'use locally available keys to authorise logins on a remote machine',
    synopsis: ['ssh-copy-id [-i [identity_file]] [user@]hostname'],
    description: "ssh-copy-id is a script that uses ssh(1) to log into a remote machine (presumably using a login password) and appends your public key to the remote account's ~/.ssh/authorized_keys, creating ~/.ssh and the file with safe permissions if needed.\nOn this machine password logins are off (PasswordAuthentication no), as on most servers: put the key with sudo, as an administrator would.",
    seeAlso: 'ssh(1), ssh-keygen(1), sshd(8)',
    url: 'https://man.openbsd.org/ssh-copy-id',
  }),
  run(ctx) {
    ctx.err('/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n/usr/bin/ssh-copy-id: ERROR: Permission denied (publickey).\n\x1b[2m(password logins are disabled on this machine; append the .pub file to the account\'s ~/.ssh/authorized_keys with sudo)\x1b[0m\n');
    return 1;
  },
};

// ── cron ──

function cronFieldOk(v: string, min: number, max: number): boolean {
  return v.split(',').every((part) => {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) return false;
    if (m[1] === '*') return true;
    const [a, b] = m[1].split('-').map(Number);
    return a >= min && a <= max && (b === undefined || (b >= a && b <= max));
  });
}

export function crontabError(text: string): string | null {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.startsWith('#') || /^[A-Za-z_]\w*\s*=/.test(l)) continue;
    if (/^@(reboot|yearly|annually|monthly|weekly|daily|midnight|hourly)\s+\S/.test(l)) continue;
    if (l.startsWith('@')) return `"-":${i + 1}: bad time specifier`;
    const f = l.split(/\s+/);
    if (f.length < 6) return `"-":${i + 1}: bad command`;
    const names = ['minute', 'hour', 'day-of-month', 'month', 'day-of-week'];
    const ranges: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    for (let k = 0; k < 5; k++) if (!cronFieldOk(f[k], ranges[k][0], ranges[k][1]) && !(k >= 3 && /^[a-z]{3}$/i.test(f[k]))) return `"-":${i + 1}: bad ${names[k]}`;
  }
  return null;
}

const crontab: ShellCommand = {
  ...cmdDoc({
    name: 'crontab',
    summary: bi('посмотреть и поставить задачи по расписанию', 'maintain crontab files for individual users'),
    whatis: 'maintain crontab files for individual users',
    synopsis: ['crontab [-u user] file', 'crontab [-u user] { -l | -r | -e }'],
    description:
      'crontab is the program used to install, deinstall or list the tables used to drive the cron(8) daemon. Each user can have their own crontab. crontab file installs the table from a file; crontab -l lists it; crontab -r removes it; crontab -e opens an editor (on this machine: write the table to a file and install it with crontab file).\nA line is five time fields and a command: minute hour day-of-month month day-of-week command. The command runs without your interactive environment: a short PATH, no ~/.bashrc; write full paths and redirect output to a file.',
    options: [['-l', 'Display the current crontab on standard output.'], ['-r', 'Remove the current crontab.'], ['-u user', 'Specify the name of the user whose crontab is to be used (root only).']],
    extra: [{ id: 'SEE ALSO crontab(5)', body: 'The format of the table: man 5 crontab.' }],
    seeAlso: 'crontab(5), cron(8)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let user = ctx.user.name;
    const ui = args.indexOf('-u');
    if (ui >= 0) {
      if (ctx.user.uid !== 0) {
        ctx.err('must be privileged to use -u\n');
        return 1;
      }
      user = args[ui + 1];
      args.splice(ui, 2);
    }
    const path = `/var/spool/cron/crontabs/${user}`;
    if (args[0] === '-l') {
      try {
        ctx.out(m.vfs.readFileAs(path, ROOT_CRED));
        return 0;
      } catch {
        ctx.err(`no crontab for ${user}\n`);
        return 1;
      }
    }
    if (args[0] === '-r') {
      try {
        m.vfs.unlinkAs(path, ROOT_CRED);
        return 0;
      } catch {
        ctx.err(`no crontab for ${user}\n`);
        return 1;
      }
    }
    if (args[0] === '-e') {
      ctx.err('crontab: no editor on this simulated machine: write the table to a file and run crontab FILE (crontab -l > my.cron to start from the current one)\n');
      return 1;
    }
    const file = args[0] ?? '-';
    let text: string;
    try {
      text = file === '-' ? ctx.stdin : ctx.fs.readFile(file);
    } catch {
      ctx.err(`crontab: ${file}: No such file or directory\n`);
      return 1;
    }
    const bad = crontabError(text);
    if (bad) {
      ctx.err(`${bad}\nerrors in crontab file, can't install.\n`);
      return 1;
    }
    m.vfs.writeFileAs(path, text.endsWith('\n') ? text : text + '\n', ROOT_CRED);
    const u = m.users.find((x) => x.name === user);
    if (u) m.vfs.chownAs(path, u.uid, u.gid, ROOT_CRED);
    m.vfs.chmodAs(path, 0o600, ROOT_CRED);
    m.systemd.log('crontab', m.procs.next, `(${user}) REPLACE (${user})`, { unit: 'cron.service' });
    return 0;
  },
};

// ── whatis / apropos ──

const whatis: ShellCommand = {
  ...cmdDoc({ name: 'whatis', summary: bi('одна строка о команде', 'display one-line manual page descriptions'), whatis: 'display one-line manual page descriptions', synopsis: ['whatis name ...'], description: 'Each manual page has a short description available within it. whatis searches the manual page names and displays the manual page descriptions of any name matched.', seeAlso: 'apropos(1), man(1)' }),
  run(ctx) {
    let exit = 0;
    for (const n of ctx.argv.slice(1)) {
      const pages = corpus.all().filter((p) => p.source === 'man' && p.id.startsWith(`man/${n}.`));
      if (!pages.length) {
        ctx.out(`${n}: nothing appropriate.\n`);
        exit = 16;
      }
      for (const p of pages) ctx.out(`${p.title.replace('(', ' (').padEnd(20)} - ${shortOf(p)}\n`);
    }
    return exit;
  },
};

const apropos: ShellCommand = {
  ...cmdDoc({ name: 'apropos', summary: bi('найти страницу руководства по слову', 'search the manual page names and descriptions'), whatis: 'search the manual page names and descriptions', synopsis: ['apropos keyword ...'], description: 'Each manual page has a short description available within it. apropos searches the descriptions for instances of keyword. Same as man -k.', seeAlso: 'whatis(1), man(1)' }),
  run(ctx) {
    const kw = (ctx.argv[1] ?? '').toLowerCase();
    if (!kw) {
      ctx.err('apropos what?\n');
      return 1;
    }
    const hits = corpus.all().filter((p) => p.source === 'man' && (p.title.toLowerCase().includes(kw) || shortOf(p).toLowerCase().includes(kw)));
    if (!hits.length) {
      ctx.out(`${kw}: nothing appropriate.\n`);
      return 16;
    }
    for (const p of hits.sort((a, b) => a.title.localeCompare(b.title))) ctx.out(`${p.title.replace('(', ' (').padEnd(20)} - ${shortOf(p)}\n`);
    return 0;
  },
};

export const SYSTEM_COMMANDS: ShellCommand[] = [uname, hostname, hostnamectl, uptime, free, nproc, lscpu, dmesg, reboot, lsblk, blkid, mkfs, mount, umount, findmnt, ip, ss, curl, ping, sshKeygen, ssh, sshCopyId, crontab, whatis, apropos];
