// File commands of the Linux block: copy, move, link, inspect, find, change
// modes and owners, measure usage, archive and fingerprint. Behaviour and
// messages follow GNU coreutils 9, findutils 4.10, tar 1.35, gzip 1.13.

import { bi } from '../../../core/i18n';
import type { CmdContext, FsApi, ShellCommand, Stat } from '../../../core/types';
import type { SimMachine } from '../shell';
import { basename, dirname, isFsError, joinPath, modeString, normalize } from '../vfs';
import { cmdDoc, fsErr, humanSize, lines, lsTime, parseArgs, readInputs, usageError } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;

/** Join a directory and a name the way coreutils prints it. */
const under = (dir: string, name: string) => (dir.endsWith('/') ? dir + name : `${dir}/${name}`);

/** Copy a file or a tree. Returns false on error (already reported). */
function copyTree(ctx: CmdContext, src: string, dst: string, o: { recursive: boolean; noDereference?: boolean; preserve: boolean; verbose: boolean; noClobber: boolean }): boolean {
  const fs = ctx.fs;
  let st: Stat | null;
  try {
    st = o.noDereference ? fs.lstat(src) : fs.stat(src);
  } catch (e) {
    fsErr(ctx, e, src, 'cannot stat');
    return false;
  }
  if (!st) {
    ctx.err(`cp: cannot stat '${src}': No such file or directory\n`);
    return false;
  }
  if (st.type === 'd') {
    if (!o.recursive) {
      ctx.err(`cp: -r not specified; omitting directory '${src}'\n`);
      return false;
    }
    if (normalize(fs.resolve(dst)).startsWith(normalize(fs.resolve(src)) + '/')) {
      ctx.err(`cp: cannot copy a directory, '${src}', into itself, '${dst}'\n`);
      return false;
    }
    try {
      if (!fs.exists(dst)) fs.mkdir(dst);
      if (o.verbose) ctx.out(`'${src}' -> '${dst}'\n`);
      for (const n of fs.readdir(src)) if (!copyTree(ctx, under(src, n), under(dst, n), o)) return false;
      if (o.preserve) fs.chmod(dst, st.mode);
    } catch (e) {
      fsErr(ctx, e, dst, 'cannot create directory');
      return false;
    }
    return true;
  }
  try {
    const exists = fs.stat(dst);
    if (exists && o.noClobber) return true;
    if (exists?.type === 'd') {
      ctx.err(`cp: cannot overwrite directory '${dst}' with non-directory\n`);
      return false;
    }
    if (st.type === 'l' && o.noDereference) {
      if (exists) fs.unlink(dst);
      fs.symlink(fs.readlink(src), dst);
      return true;
    }
    const data = fs.readFile(src);
    fs.writeFile(dst, data, { mode: st.mode & 0o777 });
    if (o.preserve) {
      fs.chmod(dst, st.mode);
      fs.utimes(dst, st.mtime);
      try {
        fs.chown(dst, st.uid, st.gid);
      } catch {
        /* not root: owner stays */
      }
    }
    if (o.verbose) ctx.out(`'${src}' -> '${dst}'\n`);
  } catch (e) {
    if (isFsError(e) && e.code === 'EACCES' && !fs.access(src, 'r')) fsErr(ctx, e, src, 'cannot open');
    else fsErr(ctx, e, dst, 'cannot create regular file');
    return false;
  }
  return true;
}

const cp: ShellCommand = {
  ...cmdDoc({
    name: 'cp',
    summary: bi('скопировать файлы и каталоги', 'copy files and directories'),
    whatis: 'copy files and directories',
    synopsis: ['cp [OPTION]... [-T] SOURCE DEST', 'cp [OPTION]... SOURCE... DIRECTORY', 'cp [OPTION]... -t DIRECTORY SOURCE...'],
    description: 'Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.\nMandatory arguments to long options are mandatory for short options too.',
    options: [
      ['-a, --archive', 'same as -dR --preserve=all'],
      ['-n, --no-clobber', 'do not overwrite an existing file'],
      ['-p', 'same as --preserve=mode,ownership,timestamps'],
      ['-R, -r, --recursive', 'copy directories recursively'],
      ['-t, --target-directory=DIRECTORY', 'copy all SOURCE arguments into DIRECTORY'],
      ['-T, --no-target-directory', 'treat DEST as a normal file'],
      ['-v, --verbose', 'explain what is being done'],
    ],
    examples: [
      ['cp nginx.conf nginx.conf.bak', 'Make a copy of a file next to it before editing.'],
      ['cp -r site/ /srv/www/', 'Copy a directory with everything in it.'],
    ],
    seeAlso: 'mv(1), install(1), rsync(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'aRrpvnTfiP', withValue: 't', long: { archive: 'a', recursive: 'r', verbose: 'v', 'no-clobber': 'n', 'target-directory': 't', 'no-target-directory': 'T', preserve: 'p', force: 'f', interactive: 'i' } });
    if (a.error) return usageError(ctx, a.error);
    const o = { noDereference: ['P', 'r', 'R', 'a'].some(f => a.flags.has(f)), recursive: a.flags.has('r') || a.flags.has('R') || a.flags.has('a'), preserve: a.flags.has('p') || a.flags.has('a'), verbose: a.flags.has('v'), noClobber: a.flags.has('n') };
    let srcs = a.operands;
    let target = a.values.t;
    if (!target) {
      if (srcs.length < 2) return usageError(ctx, srcs.length ? `missing destination file operand after '${srcs[0]}'` : 'missing file operand');
      target = srcs[srcs.length - 1];
      srcs = srcs.slice(0, -1);
    }
    const tst = ctx.fs.stat(target);
    if (srcs.length > 1 && tst?.type !== 'd') {
      ctx.err(`cp: target '${target}': Not a directory\n`);
      return 1;
    }
    let exit = 0;
    for (const s of srcs) {
      const dst = tst?.type === 'd' && !a.flags.has('T') ? under(target, basename(s)) : target;
      if (normalize(ctx.fs.resolve(s)) === normalize(ctx.fs.resolve(dst))) {
        ctx.err(`cp: '${s}' and '${dst}' are the same file\n`);
        exit = 1;
        continue;
      }
      if (!copyTree(ctx, s, dst, o)) exit = 1;
    }
    return exit;
  },
};

const mv: ShellCommand = {
  ...cmdDoc({
    name: 'mv',
    summary: bi('переместить или переименовать', 'move or rename files'),
    whatis: 'move (rename) files',
    synopsis: ['mv [OPTION]... [-T] SOURCE DEST', 'mv [OPTION]... SOURCE... DIRECTORY', 'mv [OPTION]... -t DIRECTORY SOURCE...'],
    description: 'Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.\nWithin one file system mv only changes names: the data stays where it is, which is why moving a large file is instant.',
    options: [
      ['-f, --force', 'do not prompt before overwriting'],
      ['-n, --no-clobber', 'do not overwrite an existing file'],
      ['-t, --target-directory=DIRECTORY', 'move all SOURCE arguments into DIRECTORY'],
      ['-T, --no-target-directory', 'treat DEST as a normal file'],
      ['-v, --verbose', 'explain what is being done'],
    ],
    seeAlso: 'rename(2), cp(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'fnvTi', withValue: 't', long: { force: 'f', 'no-clobber': 'n', verbose: 'v', 'target-directory': 't', 'no-target-directory': 'T', interactive: 'i' } });
    if (a.error) return usageError(ctx, a.error);
    let srcs = a.operands;
    let target = a.values.t;
    if (!target) {
      if (srcs.length < 2) return usageError(ctx, srcs.length ? `missing destination file operand after '${srcs[0]}'` : 'missing file operand');
      target = srcs[srcs.length - 1];
      srcs = srcs.slice(0, -1);
    }
    const tst = ctx.fs.stat(target);
    if (srcs.length > 1 && tst?.type !== 'd') {
      ctx.err(`mv: target '${target}': Not a directory\n`);
      return 1;
    }
    let exit = 0;
    for (const s of srcs) {
      try {
        if (!ctx.fs.lstat(s)) {
          ctx.err(`mv: cannot stat '${s}': No such file or directory\n`);
          exit = 1;
          continue;
        }
        const dst = tst?.type === 'd' && !a.flags.has('T') ? under(target, basename(s)) : target;
        if (a.flags.has('n') && ctx.fs.exists(dst)) continue;
        if (normalize(ctx.fs.resolve(dst)).startsWith(normalize(ctx.fs.resolve(s)) + '/')) {
          ctx.err(`mv: cannot move '${s}' to a subdirectory of itself, '${dst}'\n`);
          exit = 1;
          continue;
        }
        ctx.fs.rename(s, dst);
        if (a.flags.has('v')) ctx.out(`renamed '${s}' -> '${dst}'\n`);
      } catch (e) {
        exit = fsErr(ctx, e, s, 'cannot move');
      }
    }
    return exit;
  },
};

const ln: ShellCommand = {
  ...cmdDoc({
    name: 'ln',
    summary: bi('создать ссылку на файл', 'make links between files'),
    whatis: 'make links between files',
    synopsis: ['ln [OPTION]... [-T] TARGET LINK_NAME', 'ln [OPTION]... TARGET', 'ln [OPTION]... TARGET... DIRECTORY'],
    description: 'Create hard links by default, symbolic links with --symbolic.\nA hard link is a second name for the same inode: the data is shared and lives until the last name is removed. A symbolic link is a small file that holds a path; it breaks when the target is moved or deleted.',
    options: [
      ['-f, --force', 'remove existing destination files'],
      ['-n, --no-dereference', 'treat LINK_NAME as a normal file if it is a symbolic link to a directory'],
      ['-r, --relative', 'with -s, create links relative to link location'],
      ['-s, --symbolic', 'make symbolic links instead of hard links'],
      ['-v, --verbose', 'print name of each linked file'],
    ],
    examples: [
      ['ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app', 'Enable a site the Debian way: a symbolic link.'],
      ['ln report.txt report-copy.txt', 'A second name for the same file (same inode, link count 2).'],
    ],
    seeAlso: 'link(2), symlink(2), readlink(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'sfnvrT', long: { symbolic: 's', force: 'f', 'no-dereference': 'n', verbose: 'v', relative: 'r' } });
    if (a.error) return usageError(ctx, a.error);
    if (!a.operands.length) return usageError(ctx, 'missing file operand');
    const target = a.operands[0];
    let link = a.operands[1] ?? basename(target);
    const lst = ctx.fs.stat(link);
    if (lst?.type === 'd' && !(a.flags.has('n') && ctx.fs.lstat(link)?.type === 'l')) link = under(link, basename(target));
    try {
      if (ctx.fs.lstat(link)) {
        if (!a.flags.has('f')) {
          ctx.err(`ln: failed to create ${a.flags.has('s') ? 'symbolic ' : 'hard '}link '${link}': File exists\n`);
          return 1;
        }
        ctx.fs.unlink(link);
      }
      if (a.flags.has('s')) ctx.fs.symlink(target, link);
      else {
        const st = ctx.fs.stat(target);
        if (!st) {
          ctx.err(`ln: failed to access '${target}': No such file or directory\n`);
          return 1;
        }
        if (st.type === 'd') {
          ctx.err(`ln: ${target}: hard link not allowed for directory\n`);
          return 1;
        }
        ctx.fs.link(target, link);
      }
      if (a.flags.has('v')) ctx.out(`'${link}' -> '${target}'\n`);
    } catch (e) {
      return fsErr(ctx, e, link, `failed to create ${a.flags.has('s') ? 'symbolic' : 'hard'} link`);
    }
    return 0;
  },
};

const rmdir: ShellCommand = {
  ...cmdDoc({
    name: 'rmdir',
    summary: bi('удалить пустой каталог', 'remove empty directories'),
    whatis: 'remove empty directories',
    synopsis: ['rmdir [OPTION]... DIRECTORY...'],
    description: 'Remove the DIRECTORY(ies), if they are empty.',
    options: [
      ['-p, --parents', "remove DIRECTORY and its ancestors; e.g., 'rmdir -p a/b' is similar to 'rmdir a/b a'"],
      ['-v, --verbose', 'output a diagnostic for every directory processed'],
    ],
    seeAlso: 'rm(1), rmdir(2)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'pv', long: { parents: 'p', verbose: 'v', 'ignore-fail-on-non-empty': 'ignore' } });
    if (a.error) return usageError(ctx, a.error);
    if (!a.operands.length) return usageError(ctx, 'missing operand');
    let exit = 0;
    for (const d of a.operands) {
      const chain = [d];
      if (a.flags.has('p')) for (let p = dirname(d); p !== '.' && p !== '/' && d.includes('/'); p = dirname(p)) chain.push(p);
      for (const p of chain) {
        try {
          ctx.fs.rmdir(p);
          if (a.flags.has('v')) ctx.out(`rmdir: removing directory, '${p}'\n`);
        } catch (e) {
          if (isFsError(e) && e.code === 'ENOTEMPTY' && a.flags.has('ignore')) break;
          exit = fsErr(ctx, e, p, 'failed to remove');
          break;
        }
      }
    }
    return exit;
  },
};

function typeWord(st: Stat): string {
  const dev = (st as Stat & { dev?: string }).dev;
  if (st.type === 'd') return 'directory';
  if (st.type === 'l') return 'symbolic link';
  if (st.type === 'c') return dev?.startsWith('blk:') ? 'block special file' : 'character special file';
  return st.size === 0 ? 'regular empty file' : 'regular file';
}

function isoTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}000000 +0000`;
}

const stat: ShellCommand = {
  ...cmdDoc({
    name: 'stat',
    summary: bi('показать подробности о файле', 'display file status'),
    whatis: 'display file or file system status',
    synopsis: ['stat [OPTION]... FILE...'],
    description: 'Display file or file system status: the inode, the type, the permission bits in octal and symbolic form, the owner and group by id and name, the number of hard links and the times.',
    options: [
      ['-c  --format=FORMAT', "use the specified FORMAT instead of the default; output a newline after each use of FORMAT"],
      ['-L, --dereference', 'follow links'],
    ],
    extra: [
      {
        id: 'FORMAT SEQUENCES',
        body: '%a     permission bits in octal\n%A     permission bits and file type in human readable form\n%F     file type\n%g     group ID of owner\n%G     group name of owner\n%h     number of hard links\n%i     inode number\n%n     file name\n%s     total size, in bytes\n%u     user ID of owner\n%U     user name of owner\n%y     time of last data modification',
      },
    ],
    examples: [["stat -c '%a %U:%G %n' /etc/shadow", 'The mode in octal, the owner and the group of a file on one line.']],
    seeAlso: 'stat(2), ls(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'Lt', withValue: 'c', long: { format: 'c', dereference: 'L', printf: 'c' } });
    if (a.error) return usageError(ctx, a.error);
    if (!a.operands.length) return usageError(ctx, 'missing operand');
    const m = M(ctx);
    let exit = 0;
    for (const f of a.operands) {
      let st: Stat | null;
      try {
        st = a.flags.has('L') ? ctx.fs.stat(f) : ctx.fs.lstat(f);
      } catch (e) {
        exit = fsErr(ctx, e, f, 'cannot statx');
        continue;
      }
      if (!st) {
        ctx.err(`stat: cannot statx '${f}': No such file or directory\n`);
        exit = 1;
        continue;
      }
      const uname = m.userName_(st.uid);
      const gname = m.groupName_(st.gid);
      if (a.values.c !== undefined) {
        const out = a.values.c.replace(/%([aAFgGhinsuUy%])/g, (_x, k: string) =>
          ({
            a: (st!.mode & 0o7777).toString(8),
            A: modeString(st!.type, st!.mode),
            F: typeWord(st!),
            g: String(st!.gid),
            G: gname,
            h: String(st!.nlink),
            i: String(st!.ino),
            n: f,
            s: String(st!.size),
            u: String(m.displayUid(st!.uid)),
            U: uname,
            y: isoTime(st!.mtime),
            '%': '%',
          })[k] ?? '',
        );
        ctx.out(out.replace(/\\n/g, '\n') + '\n');
        continue;
      }
      const shownName = st.type === 'l' ? `${f} -> ${st.target}` : f;
      ctx.out(
        `  File: ${shownName}\n  Size: ${String(st.size).padEnd(15)}Blocks: ${String(Math.ceil(st.size / 512) * (st.size ? 1 : 0)).padEnd(10)} IO Block: 4096   ${typeWord(st)}\n` +
          `Device: 8,1\tInode: ${String(st.ino).padEnd(11)} Links: ${st.nlink}\n` +
          `Access: (${(st.mode & 0o7777).toString(8).padStart(4, '0')}/${modeString(st.type, st.mode)})  Uid: (${String(m.displayUid(st.uid)).padStart(5)}/${uname.padStart(8)})   Gid: (${String(st.gid).padStart(5)}/${gname.padStart(8)})\n` +
          `Access: ${isoTime(st.mtime)}\nModify: ${isoTime(st.mtime)}\nChange: ${isoTime(st.mtime)}\n Birth: ${isoTime(st.mtime)}\n`,
      );
    }
    return exit;
  },
};

function fileKind(ctx: CmdContext, path: string, st: Stat): string {
  const dev = (st as Stat & { dev?: string }).dev;
  if (st.type === 'd') return st.mode & 0o1000 ? 'sticky, directory' : 'directory';
  if (st.type === 'l') return `symbolic link to ${st.target}`;
  if (st.type === 'c') return dev?.startsWith('blk:') ? `block special (${(st as Stat & { rdev?: string }).rdev?.replace(', ', '/')})` : `character special (${(st as Stat & { rdev?: string }).rdev?.replace(', ', '/')})`;
  let text = '';
  try {
    text = ctx.fs.readFile(path);
  } catch {
    return 'regular file, no read permission';
  }
  if (!text) return 'empty';
  if (text.startsWith('#!/usr/bin/sim')) return 'ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, stripped';
  if (text.startsWith('\u001f\u008b')) return 'gzip compressed data, original size modulo 2^32 ' + (text.length * 3);
  if (text.startsWith(TAR_MAGIC)) return 'POSIX tar archive (GNU)';
  const sb = /^#!\s*(\S+)(?:\s+(\S+))?/.exec(text);
  if (sb) {
    const interp = basename(sb[1]) === 'env' ? sb[2] : basename(sb[1]);
    const name = interp === 'bash' ? 'Bourne-Again shell script' : interp === 'sh' ? 'POSIX shell script' : interp?.startsWith('python') ? 'Python script' : `${interp} script`;
    return `${name}, ASCII text executable`;
  }
  if (/^\s*[{[]/.test(text)) {
    try {
      JSON.parse(text);
      return 'JSON text data';
    } catch {
      /* not json */
    }
  }
  if (/^\[(Unit|Service|Install)\]/m.test(text)) return 'ASCII text';
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7f]/.test(text) ? 'Unicode text, UTF-8 text' : 'ASCII text';
}

const file: ShellCommand = {
  ...cmdDoc({
    name: 'file',
    summary: bi('определить тип файла по содержимому', 'determine file type from the contents'),
    whatis: 'determine file type',
    synopsis: ['file [-bL] file ...'],
    description: 'file tests each argument in an attempt to classify it. It looks at the contents (magic numbers, the #! line), not at the name: an extension is only part of a name.',
    options: [
      ['-b, --brief', 'Do not prepend filenames to output lines (brief mode).'],
      ['-L, --dereference', 'option causes symlinks to be followed.'],
    ],
    seeAlso: 'magic(4), hexdump(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'bL', long: { brief: 'b', dereference: 'L' } });
    if (a.error) return usageError(ctx, a.error);
    if (!a.operands.length) {
      ctx.err('Usage: file [-bcdEhikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding] [--mime-type] [-e <testname>] [-F <separator>]  [-f <namefile>] [-m <magicfiles>] [-P <parameter=value>] [--exclude-quiet] <file> ...\n');
      return 1;
    }
    for (const f of a.operands) {
      const st = a.flags.has('L') ? ctx.fs.stat(f) : ctx.fs.lstat(f);
      const what = st ? fileKind(ctx, f, st) : `cannot open \`${f}' (No such file or directory)`;
      ctx.out(a.flags.has('b') ? `${what}\n` : `${f}: ${what}\n`);
    }
    return 0;
  },
};

// ── find ──

interface FindTest {
  (path: string, st: Stat, depth: number): boolean;
}

function sizeTest(spec: string): ((size: number) => boolean) | null {
  const m = /^([+-]?)(\d+)([cwbkMG]?)$/.exec(spec);
  if (!m) return null;
  const unit = { c: 1, w: 2, b: 512, k: 1024, M: 1024 ** 2, G: 1024 ** 3, '': 512 }[m[3]]!;
  const n = Number(m[2]);
  return (size) => {
    const units = Math.ceil(size / unit);
    return m[1] === '+' ? units > n : m[1] === '-' ? units < n : units === n;
  };
}

const find: ShellCommand = {
  ...cmdDoc({
    name: 'find',
    summary: bi('найти файлы по свойствам', 'search for files by their properties'),
    whatis: 'search for files in a directory hierarchy',
    synopsis: ['find [starting-point...] [expression]'],
    description:
      'find searches the directory tree rooted at each given starting-point by evaluating the given expression from left to right, until the outcome is known, at which point find moves on to the next file name. If no starting-point is specified, `.` is assumed.\nThe expression is made up of options, tests and actions joined by operators; two tests next to each other are joined by -a (and).',
    options: [
      ['-maxdepth levels', 'Descend at most levels (a non-negative integer) levels of directories below the starting-points.'],
      ['-mindepth levels', 'Do not apply any tests or actions at levels less than levels.'],
    ],
    extra: [
      {
        id: 'TESTS',
        body: "-name pattern\n       Base of file name matches shell pattern pattern. Quote the pattern so that the shell does not expand it: -name '*.log'.\n-iname pattern\n       Like -name, but the match is case insensitive.\n-path pattern\n       File name (the whole path) matches shell pattern pattern.\n-type c\n       File is of type c: b block, c character, d directory, f regular file, l symbolic link.\n-size n[cwbkMG]\n       File uses less than, more than or exactly n units of space, rounding up: +n means more than n, -n less than n. Units: c bytes, k kibibytes, M mebibytes, G gibibytes.\n-user uname\n       File is owned by user uname (numeric user ID allowed).\n-group gname\n       File belongs to group gname.\n-perm mode\n       File's permission bits are exactly mode (octal). -perm -mode: all of the bits are set. -perm /mode: any of the bits are set.\n-newer reference\n       Time of the last data modification of the current file is more recent than that of the last data modification of the reference file.\n-mtime n\n       File's data was last modified less than, more than or exactly n*24 hours ago.\n-empty\n       File is empty and is either a regular file or a directory.",
      },
      {
        id: 'ACTIONS',
        body: "-print\n       True; print the full file name on the standard output, followed by a newline. The default when there is no other action.\n-delete\n       Delete files or directories; true if removal succeeded.\n-exec command ;\n       Execute command; true if 0 status is returned. The string `{}' is replaced by the current file name. The ; must be escaped (\\;) or quoted to protect it from the shell.\n-exec command {} +\n       Run command once with as many file names as possible.",
      },
      { id: 'OPERATORS', body: '! expr     True if expr is false.\nexpr1 -a expr2, expr1 expr2     And; expr2 is not evaluated if expr1 is false.\nexpr1 -o expr2     Or; expr2 is not evaluated if expr1 is true.' },
    ],
    examples: [
      ["find /var/log -name '*.log' -size +1M", 'Log files bigger than one mebibyte.'],
      ['find ~ -type f -newer /etc/passwd', 'Your files changed after /etc/passwd was.'],
      ["find /tmp -user learner -name '*.tmp' -delete", 'Remove your temporary files under /tmp.'],
      ['find . -name "*.sh" -exec chmod +x {} \\;', 'Make every script below the current directory executable.'],
    ],
    exit: 'find exits with status 0 if all files are processed successfully, greater than 0 if errors occur.',
    seeAlso: 'locate(1), xargs(1), glob(7)',
  }),
  async run(ctx) {
    const args = ctx.argv.slice(1);
    const starts: string[] = [];
    while (args.length && !args[0].startsWith('-') && args[0] !== '!' && args[0] !== '(') starts.push(args.shift()!);
    if (!starts.length) starts.push('.');
    let maxdepth = Infinity;
    let mindepth = 0;
    const m = M(ctx);
    type Node = { kind: 'test'; fn: FindTest } | { kind: 'and' | 'or'; a: Node; b: Node } | { kind: 'not'; a: Node } | { kind: 'act'; fn: (p: string, st: Stat) => Promise<boolean> | boolean };
    let hasAction = false;
    const execBatches: { cmd: string[]; files: string[] }[] = [];
    let pos = 0;
    const err = (msg: string): never => {
      throw new Error(msg);
    };
    const primary = (): Node => {
      const t = args[pos++];
      if (t === undefined) err('expected an expression');
      if (t === '!' || t === '-not') return { kind: 'not', a: primary() };
      if (t === '(') {
        const e = orExpr();
        if (args[pos++] !== ')') err("invalid expression; I was expecting to find a ')' somewhere but did not see one.");
        return e;
      }
      const need = () => {
        const v = args[pos++];
        if (v === undefined) err(`missing argument to \`${t}'`);
        return v;
      };
      switch (t) {
        case '-name':
        case '-iname': {
          const v = need();
          const re = globRe(v, t === '-iname');
          return { kind: 'test', fn: (p) => re.test(basename(p)) };
        }
        case '-path': {
          const re = globRe(need(), false, true);
          return { kind: 'test', fn: (p) => re.test(p) };
        }
        case '-type': {
          const v = need();
          return {
            kind: 'test',
            fn: (_p, st) => {
              const dev = (st as Stat & { dev?: string }).dev;
              return v.split(',').some((c) => (c === 'f' ? st.type === 'f' : c === 'd' ? st.type === 'd' : c === 'l' ? st.type === 'l' : c === 'b' ? !!dev?.startsWith('blk:') : c === 'c' ? st.type === 'c' && !dev?.startsWith('blk:') : false));
            },
          };
        }
        case '-size': {
          const v = need();
          const fn = sizeTest(v) ?? err(`invalid -size argument \`${v}'`);
          return { kind: 'test', fn: (_p, st) => st.type !== 'd' && fn(st.size) };
        }
        case '-user': {
          const v = need();
          const u = m.users.find((x) => x.name === v)?.uid ?? (/^\d+$/.test(v) ? Number(v) : err(`'${v}' is not the name of a known user`));
          return { kind: 'test', fn: (_p, st) => st.uid === u };
        }
        case '-group': {
          const v = need();
          const g = m.groups.find((x) => x.name === v)?.gid ?? (/^\d+$/.test(v) ? Number(v) : err(`'${v}' is not the name of an existing group`));
          return { kind: 'test', fn: (_p, st) => st.gid === g };
        }
        case '-perm': {
          const v = need();
          const mode = parseInt(v.replace(/^[-/]/, ''), 8);
          if (Number.isNaN(mode)) err(`invalid mode '${v}'`);
          return { kind: 'test', fn: (_p, st) => (v.startsWith('-') ? (st.mode & mode) === mode : v.startsWith('/') ? (st.mode & mode) !== 0 : (st.mode & 0o7777) === mode) };
        }
        case '-newer': {
          const v = need();
          const ref = ctx.fs.stat(v) ?? err(`'${v}': No such file or directory`);
          return { kind: 'test', fn: (_p, st) => st.mtime > ref.mtime };
        }
        case '-mtime':
        case '-mmin': {
          const v = need();
          const n = Number(v.replace(/^[+-]/, ''));
          const unit = t === '-mtime' ? 86400000 : 60000;
          const now = m.now();
          return {
            kind: 'test',
            fn: (_p, st) => {
              const age = Math.floor((now - st.mtime) / unit);
              return v.startsWith('+') ? age > n : v.startsWith('-') ? age < n : age === n;
            },
          };
        }
        case '-empty':
          return { kind: 'test', fn: (p, st) => (st.type === 'f' ? st.size === 0 : st.type === 'd' ? ctx.fs.readdir(p).length === 0 : false) };
        case '-maxdepth':
          maxdepth = Number(need());
          return { kind: 'test', fn: () => true };
        case '-mindepth':
          mindepth = Number(need());
          return { kind: 'test', fn: () => true };
        case '-print':
          hasAction = true;
          return {
            kind: 'act',
            fn: (p) => {
              ctx.out(p + '\n');
              return true;
            },
          };
        case '-delete':
          hasAction = true;
          return {
            kind: 'act',
            fn: (p, st) => {
              try {
                if (st.type === 'd') ctx.fs.rmdir(p);
                else ctx.fs.unlink(p);
                return true;
              } catch (e) {
                if (isFsError(e)) ctx.err(`find: cannot delete '${p}': ${e.text}\n`);
                return false;
              }
            },
          };
        case '-exec':
        case '-ok': {
          hasAction = true;
          const cmd: string[] = [];
          while (pos < args.length && args[pos] !== ';' && !(args[pos] === '+' && cmd[cmd.length - 1] === '{}')) cmd.push(args[pos++]);
          if (pos >= args.length) err(`missing argument to \`${t}'`);
          const plus = args[pos++] === '+';
          if (plus) {
            const batch = { cmd: cmd.slice(0, -1), files: [] as string[] };
            execBatches.push(batch);
            return {
              kind: 'act',
              fn: (p) => {
                batch.files.push(p);
                return true;
              },
            };
          }
          return {
            kind: 'act',
            fn: async (p) => {
              const line = cmd.map((c) => shq(c.replace(/\{\}/g, p))).join(' ');
              const r = await ctx.shell.run(line);
              ctx.out(r.out);
              ctx.err(r.err);
              return r.exit === 0;
            },
          };
        }
        default:
          return err(t.startsWith('-') ? `unknown predicate \`${t}'` : `paths must precede expression: \`${t}'`);
      }
    };
    const andExpr = (): Node => {
      let left = primary();
      while (pos < args.length && args[pos] !== '-o' && args[pos] !== '-or' && args[pos] !== ')') {
        if (args[pos] === '-a' || args[pos] === '-and') pos++;
        left = { kind: 'and', a: left, b: primary() };
      }
      return left;
    };
    const orExpr = (): Node => {
      let left = andExpr();
      while (args[pos] === '-o' || args[pos] === '-or') {
        pos++;
        left = { kind: 'or', a: left, b: andExpr() };
      }
      return left;
    };
    let expr: Node | null = null;
    try {
      if (args.length) expr = orExpr();
    } catch (e) {
      ctx.err(`find: ${(e as Error).message}\n`);
      return 1;
    }
    const evalNode = async (n: Node, p: string, st: Stat, depth: number): Promise<boolean> => {
      switch (n.kind) {
        case 'test':
          return n.fn(p, st, depth);
        case 'act':
          return n.fn(p, st);
        case 'not':
          return !(await evalNode(n.a, p, st, depth));
        case 'and':
          return (await evalNode(n.a, p, st, depth)) && evalNode(n.b, p, st, depth);
        case 'or':
          return (await evalNode(n.a, p, st, depth)) || evalNode(n.b, p, st, depth);
      }
    };
    let exit = 0;
    const visit = async (p: string, depth: number): Promise<void> => {
      let st: Stat | null;
      try {
        st = ctx.fs.lstat(p);
      } catch (e) {
        if (isFsError(e)) ctx.err(`find: '${p}': ${e.text}\n`);
        exit = 1;
        return;
      }
      if (!st) {
        ctx.err(`find: '${p}': No such file or directory\n`);
        exit = 1;
        return;
      }
      const isDelete = args.includes('-delete');
      const evalHere = async () => {
        if (depth < mindepth) return;
        const ok = expr ? await evalNode(expr, p, st!, depth) : true;
        if (ok && !hasAction) ctx.out(p + '\n');
      };
      if (!isDelete) await evalHere();
      if (st.type === 'd' && depth < maxdepth) {
        let names: string[] = [];
        try {
          names = ctx.fs.readdir(p);
        } catch (e) {
          if (isFsError(e)) ctx.err(`find: '${p}': ${e.text}\n`);
          exit = 1;
        }
        for (const n of names) await visit(under(p, n), depth + 1);
      }
      if (isDelete) await evalHere();
    };
    for (const s of starts) await visit(s, 0);
    for (const b of execBatches) {
      if (!b.files.length) continue;
      const r = await ctx.shell.run([...b.cmd, ...b.files].map(shq).join(' '));
      ctx.out(r.out);
      ctx.err(r.err);
    }
    return exit;
  },
};

export function shq(a: string): string {
  return /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;
}

function globRe(glob: string, icase: boolean, path = false): RegExp {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') re += path ? '.*' : '[^/]*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const end = glob.indexOf(']', i + 1);
      if (end < 0) re += '\\[';
      else {
        re += '[' + glob.slice(i + 1, end).replace(/^!/, '^') + ']';
        i = end;
      }
    } else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(re + '$', icase ? 'i' : '');
}

const tree: ShellCommand = {
  ...cmdDoc({
    name: 'tree',
    summary: bi('показать каталоги деревом', 'list contents of directories in a tree-like format'),
    whatis: 'list contents of directories in a tree-like format',
    synopsis: ['tree [-adf] [-L level] [--noreport] [directory ...]'],
    description: 'Tree is a recursive directory listing program that produces a depth indented listing of files. With no arguments, tree lists the files in the current directory. Upon completion of listing all files/directories found, tree returns the total number of files and/or directories listed.',
    options: [
      ['-a', 'All files are printed. By default tree does not print hidden files (those beginning with a dot).'],
      ['-d', 'List directories only.'],
      ['-f', 'Prints the full path prefix for each file.'],
      ['-L level', 'Max display depth of the directory tree.'],
      ['--noreport', 'Omits printing of the file and directory report at the end of the tree listing.'],
    ],
    seeAlso: 'ls(1), find(1)',
    url: 'https://manpages.debian.org/trixie/tree/tree.1.en.html',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'adf', withValue: 'L', long: { noreport: 'noreport' } });
    if (a.error) return usageError(ctx, a.error);
    const max = a.values.L !== undefined ? Number(a.values.L) : Infinity;
    let dirs = 0;
    let files = 0;
    const walk = (p: string, prefix: string, depth: number) => {
      if (depth >= max) return;
      let names: string[];
      try {
        names = ctx.fs.readdir(p);
      } catch (e) {
        if (isFsError(e)) ctx.out(`${prefix}[error opening dir]\n`);
        return;
      }
      names = names.filter((n) => a.flags.has('a') || !n.startsWith('.'));
      const entries = names.map((n) => ({ n, st: ctx.fs.lstat(under(p, n)) })).filter((e) => !a.flags.has('d') || e.st?.type === 'd');
      entries.forEach((e, i) => {
        const lastOne = i === entries.length - 1;
        const full = under(p, e.n);
        const shown = a.flags.has('f') ? full : e.n;
        const color = ctx.isatty && e.st?.type === 'd' ? `\x1b[1;34m${shown}\x1b[0m` : ctx.isatty && e.st?.type === 'l' ? `\x1b[1;36m${shown}\x1b[0m` : shown;
        ctx.out(`${prefix}${lastOne ? '└── ' : '├── '}${color}${e.st?.type === 'l' ? ` -> ${e.st.target}` : ''}\n`);
        if (e.st?.type === 'd') {
          dirs++;
          walk(full, prefix + (lastOne ? '    ' : '│   '), depth + 1);
        } else files++;
      });
    };
    const roots = a.operands.length ? a.operands : ['.'];
    for (const r of roots) {
      const st = ctx.fs.stat(r);
      if (!st) {
        ctx.out(`${r}  [error opening dir]\n`);
        continue;
      }
      ctx.out((ctx.isatty ? `\x1b[1;34m${r}\x1b[0m` : r) + '\n');
      walk(r, '', 0);
    }
    if (!a.flags.has('noreport')) ctx.out(`\n${dirs} director${dirs === 1 ? 'y' : 'ies'}${a.flags.has('d') ? '' : `, ${files} file${files === 1 ? '' : 's'}`}\n`);
    return 0;
  },
};

// ── modes and owners ──

/** Apply a chmod mode (octal or symbolic) to a current mode. Returns null if the mode is invalid. */
export function applyMode(spec: string, cur: number, isDir: boolean, umask = 0o022): number | null {
  if (/^[0-7]{1,4}$/.test(spec)) {
    const v = parseInt(spec, 8);
    // Like GNU chmod, a short octal mode on a directory keeps setgid/setuid unless given.
    return spec.length <= 3 && isDir ? (cur & 0o6000) | v : v;
  }
  let mode = cur & 0o7777;
  for (const clause of spec.split(',')) {
    const m = /^([ugoa]*)([-+=][rwxXst]*|[-+=][ugo])+$/.exec(clause);
    if (!m) return null;
    const who = m[1] || 'a';
    const actions = clause.slice(m[1].length).match(/[-+=][rwxXstugo]*/g) ?? [];
    for (const act of actions) {
      const op = act[0];
      const perms = act.slice(1);
      let bits = 0;
      const masks: Record<string, number> = { u: 0o4700, g: 0o2070, o: 0o1007 };
      const whoMask = [...(who === 'a' ? 'ugo' : who)].reduce((s, w) => s | masks[w], 0);
      if (/^[ugo]$/.test(perms)) {
        const src = perms;
        const shift = { u: 6, g: 3, o: 0 }[src as 'u' | 'g' | 'o'];
        const tri = (mode >> shift) & 7;
        for (const w of who === 'a' ? 'ugo' : who) bits |= tri << { u: 6, g: 3, o: 0 }[w as 'u' | 'g' | 'o'];
      } else {
        for (const p of perms) {
          if (p === 'r') bits |= 0o444;
          if (p === 'w') bits |= 0o222;
          if (p === 'x') bits |= 0o111;
          if (p === 'X' && (isDir || cur & 0o111)) bits |= 0o111;
          if (p === 's') bits |= 0o6000;
          if (p === 't') bits |= 0o1000;
        }
        bits &= whoMask;
        if (!m[1]) bits &= ~(umask & 0o777) | 0o7000;
      }
      if (op === '+') mode |= bits;
      else if (op === '-') mode &= ~bits;
      else mode = (mode & ~whoMask) | bits;
    }
  }
  return mode;
}

const chmod: ShellCommand = {
  ...cmdDoc({
    name: 'chmod',
    summary: bi('изменить права доступа', 'change file mode bits'),
    whatis: 'change file mode bits',
    synopsis: ['chmod [OPTION]... MODE[,MODE]... FILE...', 'chmod [OPTION]... OCTAL-MODE FILE...'],
    description:
      "chmod changes the file mode bits of each given file according to mode, which can be either a symbolic representation of changes to make, or an octal number representing the bit pattern for the new mode bits.\nThe format of a symbolic mode is [ugoa...][[-+=][perms...]...], where perms is either zero or more letters from the set rwxXst, or a single letter from the set ugo.\nA combination of the letters ugoa controls which users' access to the file will be changed: the user who owns it (u), other users in the file's group (g), other users not in the file's group (o), or all users (a).\nThe operator + causes the selected file mode bits to be added to the existing file mode bits of each file; - causes them to be removed; and = causes them to be added and causes unmentioned bits to be removed.\nThe letters rwxXst select file mode bits for the affected users: read (r), write (w), execute (or search for directories) (x), execute/search only if the file is a directory or already has execute permission for some user (X), set user or group ID on execution (s), restricted deletion flag or sticky bit (t).\nA numeric mode is from one to four octal digits (0-7), derived by adding up the bits with values 4, 2, and 1. Omitted digits are assumed to be leading zeros. The first digit selects the set user ID (4) and set group ID (2) and restricted deletion or sticky (1) attributes. The second digit selects permissions for the user who owns the file: read (4), write (2), and execute (1); the third selects permissions for other users in the file's group, with the same values; and the fourth for other users not in the file's group, with the same values.",
    options: [
      ['-R, --recursive', 'change files and directories recursively'],
      ['-v, --verbose', 'output a diagnostic for every file processed'],
      ['-c, --changes', 'like verbose but report only when a change is made'],
      ['--reference=RFILE', "use RFILE's mode instead of specifying MODE values"],
    ],
    extra: [
      { id: 'RESTRICTED DELETION FLAG OR STICKY BIT', body: 'The restricted deletion flag or sticky bit is a single bit, whose interpretation depends on the file type. For directories, it prevents unprivileged users from removing or renaming a file in the directory unless they own the file or the directory; this is called the restricted deletion flag for the directory, and is commonly found on world-writable directories like /tmp.' },
      { id: 'SETUID AND SETGID BITS', body: 'chmod clears the set-group-ID bit of a regular file if the file\'s group ID does not match the user\'s effective group ID. For directories, the set-group-ID bit makes new files created in the directory inherit the group of the directory.' },
    ],
    examples: [
      ['chmod 750 report.sh', 'Owner: read, write, run; group: read and run; others: nothing.'],
      ['chmod u+x deploy.sh', 'Add the execute bit for the owner only.'],
      ['chmod g+s /srv/team', 'New files in /srv/team get the group of the directory.'],
    ],
    seeAlso: 'chmod(2), chown(1), umask(2), stat(1)',
  }),
  run(ctx) {
    const args = ctx.argv.slice(1);
    const flags = new Set<string>();
    const rest: string[] = [];
    let reference: string | undefined;
    for (const x of args) {
      if (x.startsWith('--reference=')) reference = x.slice(12);
      else if (x === '-R' || x === '--recursive') flags.add('R');
      else if (x === '-v' || x === '--verbose') flags.add('v');
      else if (x === '-c' || x === '--changes') flags.add('c');
      else if (/^-[Rvc]+$/.test(x)) for (const c of x.slice(1)) flags.add(c);
      else rest.push(x);
    }
    let mode = rest.shift();
    if (reference) {
      const st = ctx.fs.stat(reference);
      if (!st) {
        ctx.err(`chmod: failed to get attributes of '${reference}': No such file or directory\n`);
        return 1;
      }
      rest.unshift(...(mode ? [mode] : []));
      mode = (st.mode & 0o7777).toString(8);
    }
    if (!mode) return usageError(ctx, 'missing operand');
    if (!rest.length) return usageError(ctx, `missing operand after '${mode}'`);
    let exit = 0;
    const apply = (p: string) => {
      let st: Stat | null;
      try {
        st = ctx.fs.stat(p);
      } catch (e) {
        exit = fsErr(ctx, e, p, 'cannot access');
        return;
      }
      if (!st) {
        ctx.err(`chmod: cannot access '${p}': No such file or directory\n`);
        exit = 1;
        return;
      }
      const next = applyMode(mode!, st.mode, st.type === 'd');
      if (next === null) {
        ctx.err(`chmod: invalid mode: '${mode}'\nTry 'chmod --help' for more information.\n`);
        exit = 1;
        return;
      }
      try {
        ctx.fs.chmod(p, next);
        if (flags.has('v') || (flags.has('c') && next !== (st.mode & 0o7777))) {
          ctx.out(
            next === (st.mode & 0o7777)
              ? `mode of '${p}' retained as ${(st.mode & 0o7777).toString(8).padStart(4, '0')} (${modeString(st.type, st.mode).slice(1)})\n`
              : `mode of '${p}' changed from ${(st.mode & 0o7777).toString(8).padStart(4, '0')} (${modeString(st.type, st.mode).slice(1)}) to ${next.toString(8).padStart(4, '0')} (${modeString(st.type, next).slice(1)})\n`,
          );
        }
      } catch (e) {
        exit = fsErr(ctx, e, p, 'changing permissions of');
        return;
      }
      if (flags.has('R') && st.type === 'd') {
        try {
          for (const n of ctx.fs.readdir(p)) {
            if (ctx.fs.lstat(under(p, n))?.type === 'l') continue;
            apply(under(p, n));
          }
        } catch (e) {
          exit = fsErr(ctx, e, p, 'cannot read directory');
        }
      }
    };
    if (applyMode(mode, 0o644, false) === null) {
      ctx.err(`chmod: invalid mode: '${mode}'\nTry 'chmod --help' for more information.\n`);
      return 1;
    }
    for (const p of rest) apply(p);
    return exit;
  },
};

function chownLike(name: 'chown' | 'chgrp'): ShellCommand {
  const isChown = name === 'chown';
  return {
    ...cmdDoc({
      name,
      summary: isChown ? bi('сменить владельца и группу файла', 'change file owner and group') : bi('сменить группу файла', 'change group ownership'),
      whatis: isChown ? 'change file owner and group' : 'change group ownership',
      synopsis: isChown ? ['chown [OPTION]... [OWNER][:[GROUP]] FILE...', 'chown [OPTION]... --reference=RFILE FILE...'] : ['chgrp [OPTION]... GROUP FILE...'],
      description: isChown
        ? "chown changes the user and/or group ownership of each given file. If only an owner (a user name or numeric user ID) is given, that user is made the owner of each given file, and the files' group is not changed. If the owner is followed by a colon and a group name (or numeric group ID), with no spaces between them, the group ownership of the files is changed as well. If a colon but no group name follows the user name, that user is made the owner of the files and the group of the files is changed to that user's login group. If the colon and group are given, but the owner is omitted, only the group of the files is changed.\nOnly a privileged process (CAP_CHOWN) may change the owner of a file. The owner of a file may change its group to any group of which that owner is a member."
        : 'Change the group of each FILE to GROUP. The owner of a file may change its group to any group they are a member of; anything else needs root.',
      options: [
        ['-R, --recursive', 'operate on files and directories recursively'],
        ['-v, --verbose', 'output a diagnostic for every file processed'],
        ['-h, --no-dereference', 'affect symbolic links instead of any referenced file'],
      ],
      examples: isChown ? [['chown www-data:www-data /srv/www/index.html', 'Give the file to the web server user and group.'], ['chown :dev report.txt', 'Change only the group.']] : [['chgrp dev /srv/team', 'The directory now belongs to group dev.']],
      seeAlso: isChown ? 'chown(2), chgrp(1), chmod(1)' : 'chown(1), chown(2)',
    }),
    run(ctx) {
      const a = parseArgs(ctx.argv.slice(1), { short: 'Rvhcf', long: { recursive: 'R', verbose: 'v', 'no-dereference': 'h', changes: 'c', silent: 'f', quiet: 'f' } });
      if (a.error) return usageError(ctx, a.error);
      const [spec, ...paths] = a.operands;
      if (!spec) return usageError(ctx, 'missing operand');
      if (!paths.length) return usageError(ctx, `missing operand after '${spec}'`);
      const m = M(ctx);
      let uid: number | undefined;
      let gid: number | undefined;
      let ownerPart = isChown ? spec : '';
      let groupPart = isChown ? undefined : spec;
      if (isChown && /[:.]/.test(spec)) {
        const i = spec.search(/[:.]/);
        ownerPart = spec.slice(0, i);
        groupPart = spec.slice(i + 1);
      }
      if (ownerPart) {
        const u = m.users.find((x) => x.name === ownerPart) ?? (/^\d+$/.test(ownerPart) ? { uid: Number(ownerPart), gid: Number(ownerPart) } : undefined);
        if (!u) {
          ctx.err(`chown: invalid user: '${spec}'\n`);
          return 1;
        }
        uid = u.uid;
        if (groupPart === '') gid = (u as { gid: number }).gid;
      }
      if (groupPart) {
        const g = m.groups.find((x) => x.name === groupPart) ?? (/^\d+$/.test(groupPart) ? { gid: Number(groupPart) } : undefined);
        if (!g) {
          ctx.err(isChown ? `chown: invalid group: '${spec}'\n` : `chgrp: invalid group: '${spec}'\n`);
          return 1;
        }
        gid = g.gid;
      }
      let exit = 0;
      const apply = (p: string) => {
        const st = ctx.fs.stat(p);
        if (!st) {
          ctx.err(`${name}: cannot access '${p}': No such file or directory\n`);
          exit = 1;
          return;
        }
        try {
          ctx.fs.chown(p, uid ?? st.uid, gid ?? st.gid);
          if (a.flags.has('v')) ctx.out(`ownership of '${p}' retained as ${m.userName_(uid ?? st.uid)}:${m.groupName_(gid ?? st.gid)}\n`);
        } catch (e) {
          if (isFsError(e) && e.code === 'EPERM') ctx.err(isChown ? `chown: changing ownership of '${p}': Operation not permitted\n` : `chgrp: changing group of '${p}': Operation not permitted\n`);
          else fsErr(ctx, e, p);
          exit = 1;
          return;
        }
        if (a.flags.has('R') && st.type === 'd') for (const n of ctx.fs.readdir(p)) apply(under(p, n));
      };
      for (const p of paths) apply(p);
      return exit;
    },
  };
}

const readlink: ShellCommand = {
  ...cmdDoc({
    name: 'readlink',
    summary: bi('показать, куда ведёт ссылка', 'print where a symbolic link points'),
    whatis: 'print resolved symbolic links or canonical file names',
    synopsis: ['readlink [OPTION]... FILE...'],
    description: 'Print value of a symbolic link or canonical file name.',
    options: [
      ['-f, --canonicalize', 'canonicalize by following every symlink in every component of the given name recursively; all but the last component must exist'],
      ['-n, --no-newline', 'do not output the trailing delimiter'],
    ],
    examples: [['readlink /proc/$$/ns/pid', 'The pid namespace of the current shell: pid:[4026531836].']],
    seeAlso: 'readlink(2), realpath(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'fenm', long: { canonicalize: 'f', 'no-newline': 'n' } });
    if (a.error) return usageError(ctx, a.error);
    let exit = 0;
    for (const f of a.operands) {
      try {
        if (a.flags.has('f') || a.flags.has('e') || a.flags.has('m')) ctx.out(canonical(ctx.fs, f) + (a.flags.has('n') ? '' : '\n'));
        else ctx.out(ctx.fs.readlink(f) + (a.flags.has('n') ? '' : '\n'));
      } catch {
        exit = 1;
      }
    }
    return exit;
  },
};

export function canonical(fs: FsApi, p: string): string {
  let path = fs.resolve(p);
  for (let guard = 0; guard < 40; guard++) {
    const parts = path.split('/').filter(Boolean);
    let cur = '';
    let changed = false;
    for (let i = 0; i < parts.length; i++) {
      cur += '/' + parts[i];
      const st = fs.lstat(cur);
      if (st?.type === 'l') {
        const t = fs.readlink(cur);
        path = normalize(joinPath(dirname(cur), t) + (i < parts.length - 1 ? '/' + parts.slice(i + 1).join('/') : ''));
        changed = true;
        break;
      }
    }
    if (!changed) return normalize(path);
  }
  return path;
}

const realpath: ShellCommand = {
  ...cmdDoc({
    name: 'realpath',
    summary: bi('показать полный путь без ссылок', 'print the resolved path'),
    whatis: 'print the resolved path',
    synopsis: ['realpath [OPTION]... FILE...'],
    description: 'Print the resolved absolute file name; all but the last component must exist.',
    seeAlso: 'readlink(1), realpath(3)',
  }),
  run(ctx) {
    for (const f of ctx.argv.slice(1).filter((x) => !x.startsWith('-'))) ctx.out(canonical(ctx.fs, f) + '\n');
    return 0;
  },
};

const basenameCmd: ShellCommand = {
  ...cmdDoc({
    name: 'basename',
    summary: bi('отрезать от пути каталоги', 'strip directory from a file name'),
    whatis: 'strip directory and suffix from filenames',
    synopsis: ['basename NAME [SUFFIX]'],
    description: 'Print NAME with any leading directory components removed. If specified, also remove a trailing SUFFIX.',
    examples: [['basename /var/log/nginx/access.log .log', 'Prints: access']],
    seeAlso: 'dirname(1)',
  }),
  run(ctx) {
    const [n, suf] = ctx.argv.slice(1);
    if (n === undefined) return usageError(ctx, 'missing operand');
    let b = basename(n);
    if (suf && b.endsWith(suf) && b !== suf) b = b.slice(0, -suf.length);
    ctx.out(b + '\n');
    return 0;
  },
};

const dirnameCmd: ShellCommand = {
  ...cmdDoc({
    name: 'dirname',
    summary: bi('оставить от пути только каталог', 'strip the last component from a file name'),
    whatis: 'strip last component from file name',
    synopsis: ['dirname [OPTION] NAME...'],
    description: "Output each NAME with its last non-slash component and trailing slashes removed; if NAME contains no /'s, output '.' (meaning the current directory).",
    seeAlso: 'basename(1)',
  }),
  run(ctx) {
    for (const n of ctx.argv.slice(1)) ctx.out((n.includes('/') ? dirname(n) : '.') + '\n');
    return 0;
  },
};

// ── space ──

const du: ShellCommand = {
  ...cmdDoc({
    name: 'du',
    summary: bi('посчитать место, которое занимают файлы', 'estimate file space usage'),
    whatis: 'estimate file space usage',
    synopsis: ['du [OPTION]... [FILE]...'],
    description: 'Summarize device usage of the set of FILEs, recursively for directories. du counts the files it can reach by name; space held by deleted but still open files is not counted (df counts it).',
    options: [
      ['-a, --all', 'write counts for all files, not just directories'],
      ['-c, --total', 'produce a grand total'],
      ['-d, --max-depth=N', 'print the total for a directory (or file, with --all) only if it is N or fewer levels below the command line argument'],
      ['-h, --human-readable', 'print sizes in human readable format (e.g., 1K 234M 2G)'],
      ['-s, --summarize', 'display only a total for each argument'],
    ],
    examples: [
      ['du -sh /var/log', 'How much the logs take, in one line.'],
      ['du -h --max-depth=1 /var | sort -h', 'Which directory under /var is the biggest.'],
    ],
    seeAlso: 'df(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'achsx', withValue: 'd', long: { all: 'a', total: 'c', 'human-readable': 'h', summarize: 's', 'max-depth': 'd' } });
    if (a.error) return usageError(ctx, a.error);
    const m = M(ctx);
    const show = (bytes: number) => (a.flags.has('h') ? humanSize(bytes).replace(/^(\d+)$/, '$1') : String(Math.ceil(bytes / 1024)));
    const maxd = a.flags.has('s') ? 0 : a.values.d !== undefined ? Number(a.values.d) : Infinity;
    let total = 0;
    let exit = 0;
    const walk = (p: string, depth: number): number => {
      let st: Stat | null = null;
      try {
        st = ctx.fs.lstat(p);
      } catch (e) {
        if (isFsError(e)) ctx.err(`du: cannot access '${p}': ${e.text}\n`);
        exit = 1;
        return 0;
      }
      if (!st) {
        ctx.err(`du: cannot access '${p}': No such file or directory\n`);
        exit = 1;
        return 0;
      }
      let size = st.type === 'd' ? 4096 : Math.ceil(st.size / 4096) * 4096;
      if (st.type === 'd') {
        try {
          for (const n of ctx.fs.readdir(p)) size += walk(under(p, n), depth + 1);
        } catch (e) {
          if (isFsError(e)) ctx.err(`du: cannot read directory '${p}': ${e.text}\n`);
          exit = 1;
        }
      }
      if (depth <= maxd && (st.type === 'd' || a.flags.has('a') || depth === 0)) ctx.out(`${show(size)}\t${p}\n`);
      return size;
    };
    void m;
    for (const p of a.operands.length ? a.operands : ['.']) total += walk(p, 0);
    if (a.flags.has('c')) ctx.out(`${show(total)}\ttotal\n`);
    return exit;
  },
};

/** Sizes of the file systems on the machine (KiB), for df. */
export function fsTable(m: SimMachine): { source: string; type: string; size: number; used: number; target: string; inodes: number; iused: number }[] {
  const rows: { source: string; type: string; size: number; used: number; target: string; inodes: number; iused: number }[] = [];
  const all = m.vfs.list();
  const under = (t: string) => all.filter((e) => e.path === t || e.path.startsWith(t === '/' ? '/' : t + '/'));
  const mounts = m.kernel.visibleMounts();
  const targets = mounts.map((x) => x.target);
  const own = (t: string) => under(t).filter((e) => !targets.some((o) => o !== t && o.startsWith(t === '/' ? '/' : t + '/') && (e.path === o || e.path.startsWith(o + '/'))));
  for (const mt of mounts) {
    if (['proc', 'sysfs', 'cgroup2', 'devpts'].includes(mt.fstype)) continue;
    const files = own(mt.target);
    const bytes = files.reduce((s, e) => s + (e.stat.type === 'f' ? Math.ceil(e.stat.size / 4096) * 4096 : 0), 0);
    const base = mt.target === '/' ? 3_412_000 : 0;
    const size = mt.size ?? (mt.target === '/' ? 8_154_588 : mt.fstype === 'tmpfs' ? Number(/size=(\d+)k/.exec(mt.options)?.[1] ?? 1006592) : mt.fstype === 'devtmpfs' ? 987_596 : 60_400);
    rows.push({ source: mt.source, type: mt.fstype, size, used: Math.min(size, base + Math.ceil(bytes / 1024)), target: mt.target, inodes: mt.target === '/' ? 524288 : 251648, iused: files.length + (mt.target === '/' ? 41_200 : 1) });
  }
  return rows;
}

const df: ShellCommand = {
  ...cmdDoc({
    name: 'df',
    summary: bi('показать свободное место на файловых системах', 'report file system space usage'),
    whatis: 'report file system space usage',
    synopsis: ['df [OPTION]... [FILE]...'],
    description: 'df displays the amount of space available on the file system containing each file name argument. If no file name is given, the space available on all currently mounted file systems is shown.',
    options: [
      ['-h, --human-readable', 'print sizes in powers of 1024 (e.g., 1023M)'],
      ['-i, --inodes', 'list inode information instead of block usage'],
      ['-T, --print-type', 'print file system type'],
      ['-t, --type=TYPE', 'limit listing to file systems of type TYPE'],
      ['-x, --exclude-type=TYPE', 'limit listing to file systems not of type TYPE'],
      ['--output[=FIELD_LIST]', "use the output format defined by FIELD_LIST: 'source', 'fstype', 'itotal', 'iused', 'iavail', 'ipcent', 'size', 'used', 'avail', 'pcent', 'target'"],
    ],
    examples: [['df -h /', 'How full the root file system is.']],
    seeAlso: 'du(1), mount(8), statfs(2)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'hiTlaH', withValue: 'tx', long: { 'human-readable': 'h', inodes: 'i', 'print-type': 'T', type: 't', 'exclude-type': 'x', output: 'output', local: 'l', all: 'a' }, longWithValue: ['output'] });
    if (a.error) return usageError(ctx, a.error);
    const m = M(ctx);
    let rows = fsTable(m);
    if (a.values.t) rows = rows.filter((r) => r.type === a.values.t);
    if (a.values.x) rows = rows.filter((r) => r.type !== a.values.x);
    if (a.operands.length) {
      const pick: typeof rows = [];
      for (const f of a.operands) {
        const p = ctx.fs.resolve(f);
        if (!ctx.fs.exists(f)) {
          ctx.err(`df: ${f}: No such file or directory\n`);
          continue;
        }
        const best = rows.filter((r) => p === r.target || p.startsWith(r.target === '/' ? '/' : r.target + '/')).sort((x, y) => y.target.length - x.target.length)[0];
        if (best) pick.push(best);
      }
      rows = pick;
    }
    const hs = (kib: number) => (a.flags.has('h') ? humanSize(kib * 1024) : String(kib));
    if (a.values.output !== undefined) {
      const fields = (a.values.output || 'source,fstype,itotal,iused,iavail,ipcent,size,used,avail,pcent,target').split(',');
      const head: Record<string, string> = { source: 'Filesystem', fstype: 'Type', itotal: 'Inodes', iused: 'IUsed', iavail: 'IFree', ipcent: 'IUse%', size: '1K-blocks', used: 'Used', avail: 'Avail', pcent: 'Use%', target: 'Mounted on' };
      const val = (r: (typeof rows)[number], f: string) =>
        ({ source: r.source, fstype: r.type, itotal: String(r.inodes), iused: String(r.iused), iavail: String(r.inodes - r.iused), ipcent: `${Math.ceil((r.iused / r.inodes) * 100)}%`, size: hs(r.size), used: hs(r.used), avail: hs(r.size - r.used), pcent: `${Math.ceil((r.used / r.size) * 100)}%`, target: r.target })[f] ?? '';
      const table = [fields.map((f) => head[f] ?? f), ...rows.map((r) => fields.map((f) => val(r, f)))];
      const w = fields.map((_, i) => Math.max(...table.map((row) => row[i].length)));
      for (const row of table) ctx.out(row.map((c, i) => (i === row.length - 1 ? c : c.padStart(w[i]))).join(' ') + '\n');
      return 0;
    }
    const table: string[][] = [];
    if (a.flags.has('i')) {
      table.push(['Filesystem', ...(a.flags.has('T') ? ['Type'] : []), 'Inodes', 'IUsed', 'IFree', 'IUse%', 'Mounted on']);
      for (const r of rows) table.push([r.source, ...(a.flags.has('T') ? [r.type] : []), String(r.inodes), String(r.iused), String(r.inodes - r.iused), `${Math.ceil((r.iused / r.inodes) * 100)}%`, r.target]);
    } else {
      table.push(['Filesystem', ...(a.flags.has('T') ? ['Type'] : []), a.flags.has('h') ? 'Size' : '1K-blocks', 'Used', 'Avail', 'Use%', 'Mounted on']);
      for (const r of rows) table.push([r.source, ...(a.flags.has('T') ? [r.type] : []), hs(r.size), hs(r.used), hs(r.size - r.used), `${Math.ceil((r.used / r.size) * 100)}%`, r.target]);
    }
    const w = table[0].map((_, i) => Math.max(...table.map((row) => row[i].length)));
    for (const row of table) ctx.out(row.map((c, i) => (i === 0 ? c.padEnd(w[i]) : i === row.length - 1 ? c : c.padStart(w[i]))).join(' ') + '\n');
    return 0;
  },
};

// ── archives ──

export const TAR_MAGIC = 'ustar\u0000dt1\u0000';
const GZ_MAGIC = '\u001f\u008b\u0008\u0000';

interface TarEntry {
  path: string;
  type: 'f' | 'd' | 'l';
  mode: number;
  uid: number;
  gid: number;
  mtime: number;
  data?: string;
  target?: string;
}

function encodeTar(entries: TarEntry[]): string {
  return TAR_MAGIC + JSON.stringify(entries);
}
function decodeTar(text: string): TarEntry[] | null {
  if (text.startsWith(GZ_MAGIC)) text = gunzipText(text) ?? '';
  if (!text.startsWith(TAR_MAGIC)) return null;
  try {
    return JSON.parse(text.slice(TAR_MAGIC.length)) as TarEntry[];
  } catch {
    return null;
  }
}
export function gzipText(t: string): string {
  return GZ_MAGIC + btoa(unescape(encodeURIComponent(t)));
}
export function gunzipText(t: string): string | null {
  if (!t.startsWith(GZ_MAGIC)) return null;
  try {
    return decodeURIComponent(escape(atob(t.slice(GZ_MAGIC.length))));
  } catch {
    return null;
  }
}

const tar: ShellCommand = {
  ...cmdDoc({
    name: 'tar',
    summary: bi('упаковать каталог в архив и распаковать', 'pack a directory tree into one archive and unpack it'),
    whatis: 'an archiving utility',
    synopsis: ['tar -c [-f ARCHIVE] [OPTIONS] [FILE...]', 'tar -x [-f ARCHIVE] [OPTIONS] [MEMBER...]', 'tar -t [-f ARCHIVE] [OPTIONS] [MEMBER...]'],
    description:
      'GNU tar saves many files together into a single archive, and can restore individual files from the archive. It keeps names, permission bits, owners and times.\nThe first option must be one of the operation letters: -c create, -x extract, -t list. Options can be bundled after one dash: tar -czf site.tgz site/.',
    options: [
      ['-c, --create', 'Create a new archive.'],
      ['-x, --extract, --get', 'Extract files from an archive.'],
      ['-t, --list', 'List the contents of an archive.'],
      ['-f, --file=ARCHIVE', 'Use archive file ARCHIVE.'],
      ['-z, --gzip', 'Filter the archive through gzip(1).'],
      ['-v, --verbose', 'Verbosely list files processed.'],
      ['-C, --directory=DIR', 'Change to DIR before performing any operations.'],
      ['--strip-components=NUMBER', 'Strip NUMBER leading components from file names on extraction.'],
    ],
    examples: [
      ['tar -czf site.tgz site/', 'Pack the directory site into a compressed archive.'],
      ['tar -tzf site.tgz', 'Look inside without unpacking.'],
      ['tar -xzf site.tgz -C /srv/www', 'Unpack into /srv/www.'],
    ],
    seeAlso: 'gzip(1), cpio(1)',
    url: 'https://man7.org/linux/man-pages/man1/tar.1.html',
  }),
  run(ctx) {
    let args = ctx.argv.slice(1);
    if (args[0] && /^[ctxzvf]+$/.test(args[0])) args = ['-' + args[0], ...args.slice(1)];
    const a = parseArgs(args, { short: 'ctxzvfCjp', withValue: 'fC', long: { create: 'c', extract: 'x', get: 'x', list: 't', file: 'f', gzip: 'z', verbose: 'v', directory: 'C', 'strip-components': 'strip' }, longWithValue: ['strip'] });
    if (a.error) return usageError(ctx, a.error);
    const f = a.flags;
    const mode = f.has('c') ? 'c' : f.has('x') ? 'x' : f.has('t') ? 't' : null;
    if (!mode) {
      ctx.err("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.\n");
      return 2;
    }
    const dir = a.values.C ?? '.';
    const at = (p: string) => (p.startsWith('/') ? p : dir === '.' ? p : under(dir, p));
    if (mode === 'c') {
      if (!a.operands.length) {
        ctx.err('tar: Cowardly refusing to create an empty archive\n');
        return 2;
      }
      const entries: TarEntry[] = [];
      let exit = 0;
      const add = (p: string, name: string) => {
        const st = ctx.fs.lstat(p);
        if (!st) {
          ctx.err(`tar: ${name}: Cannot stat: No such file or directory\n`);
          exit = 2;
          return;
        }
        if (f.has('v')) ctx.out(`${name}${st.type === 'd' && !name.endsWith('/') ? '/' : ''}\n`);
        if (st.type === 'd') {
          entries.push({ path: name.replace(/\/$/, '') + '/', type: 'd', mode: st.mode, uid: st.uid, gid: st.gid, mtime: st.mtime });
          for (const n of ctx.fs.readdir(p)) add(under(p, n), under(name.replace(/\/$/, ''), n));
        } else if (st.type === 'l') entries.push({ path: name, type: 'l', mode: st.mode, uid: st.uid, gid: st.gid, mtime: st.mtime, target: st.target });
        else {
          try {
            entries.push({ path: name, type: 'f', mode: st.mode, uid: st.uid, gid: st.gid, mtime: st.mtime, data: ctx.fs.readFile(p) });
          } catch (e) {
            if (isFsError(e)) ctx.err(`tar: ${name}: Cannot open: ${e.text}\n`);
            exit = 2;
          }
        }
      };
      for (const p of a.operands) {
        const name = p.replace(/^\/+/, '');
        if (p.startsWith('/') && f.has('v')) void 0;
        if (p.startsWith('/')) ctx.err("tar: Removing leading `/' from member names\n");
        add(at(p), name);
      }
      let data = encodeTar(entries);
      if (f.has('z')) data = gzipText(data);
      const out = a.values.f;
      if (!out || out === '-') ctx.out(data);
      else
        try {
          ctx.fs.writeFile(out, data);
        } catch (e) {
          ctx.err(`tar: ${out}: Cannot open: ${isFsError(e) ? e.text : 'error'}\ntar: Error is not recoverable: exiting now\n`);
          return 2;
        }
      return exit;
    }
    const src = a.values.f;
    let text: string;
    try {
      text = !src || src === '-' ? ctx.stdin : ctx.fs.readFile(src);
    } catch (e) {
      ctx.err(`tar: ${src}: Cannot open: ${isFsError(e) ? e.text : 'error'}\ntar: Error is not recoverable: exiting now\n`);
      return 2;
    }
    const entries = decodeTar(text);
    if (!entries) {
      ctx.err('tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors\n');
      return 2;
    }
    const strip = Number(a.values.strip ?? 0);
    const wanted = a.operands.map((x) => x.replace(/\/$/, ''));
    const sel = entries.filter((e) => !wanted.length || wanted.some((w) => e.path === w || e.path.replace(/\/$/, '') === w || e.path.startsWith(w + '/')));
    const m = M(ctx);
    if (mode === 't') {
      for (const e of sel) {
        if (f.has('v')) ctx.out(`${modeString(e.type, e.mode)} ${m.userName_(e.uid)}/${m.groupName_(e.gid)} ${String(e.data?.length ?? 0).padStart(8)} ${lsTime(e.mtime)} ${e.path}${e.target ? ` -> ${e.target}` : ''}\n`);
        else ctx.out(e.path + '\n');
      }
      return 0;
    }
    let exit = 0;
    for (const e of sel) {
      const parts = e.path.replace(/\/$/, '').split('/');
      if (parts.length <= strip) continue;
      const rel = parts.slice(strip).join('/');
      const dst = at(rel);
      if (f.has('v')) ctx.out(e.path + '\n');
      try {
        const parent = dirname(ctx.fs.resolve(dst));
        if (!ctx.fs.exists(parent)) ctx.fs.mkdir(parent, { parents: true });
        if (e.type === 'd') {
          if (!ctx.fs.exists(dst)) ctx.fs.mkdir(dst);
        } else if (e.type === 'l') {
          if (ctx.fs.lstat(dst)) ctx.fs.unlink(dst);
          ctx.fs.symlink(e.target ?? '', dst);
        } else ctx.fs.writeFile(dst, e.data ?? '');
        if (e.type !== 'l') {
          ctx.fs.chmod(dst, e.mode);
          ctx.fs.utimes(dst, e.mtime);
          if (ctx.user.uid === 0) ctx.fs.chown(dst, e.uid, e.gid);
        }
      } catch (er) {
        if (isFsError(er)) ctx.err(`tar: ${rel}: Cannot open: ${er.text}\n`);
        exit = 2;
      }
    }
    if (exit) ctx.err('tar: Exiting with failure status due to previous errors\n');
    return exit;
  },
};

function gzipLike(name: 'gzip' | 'gunzip' | 'zcat'): ShellCommand {
  return {
    ...cmdDoc({
      name,
      summary: name === 'gzip' ? bi('сжать файл', 'compress a file') : name === 'gunzip' ? bi('распаковать сжатый файл', 'decompress a file') : bi('показать сжатый файл', 'print a compressed file'),
      whatis: name === 'zcat' ? 'decompress files to standard output' : 'compress or expand files',
      synopsis: [`${name} [ -cdfkv ] [ name ... ]`],
      description:
        name === 'gzip'
          ? 'gzip reduces the size of the named files. Whenever possible, each file is replaced by one with the extension .gz, while keeping the same ownership modes, access and modification times.'
          : name === 'gunzip'
            ? 'gunzip takes a list of files on its command line and replaces each file whose name ends with .gz and which begins with the correct magic number with an uncompressed file without the original extension.'
            : 'zcat uncompresses either a list of files on the command line or its standard input and writes the uncompressed data on standard output.',
      options: [
        ['-c, --stdout', 'Write output on standard output; keep original files unchanged.'],
        ['-d, --decompress', 'Decompress.'],
        ['-k, --keep', 'Keep (don\'t delete) input files during compression or decompression.'],
        ['-v, --verbose', 'Display the name and percentage reduction for each file compressed or decompressed.'],
      ],
      seeAlso: 'tar(1), zcat(1)',
    }),
    run(ctx) {
      const a = parseArgs(ctx.argv.slice(1), { short: 'cdfkv9', long: { stdout: 'c', decompress: 'd', force: 'f', keep: 'k', verbose: 'v' } });
      if (a.error) return usageError(ctx, a.error);
      const decompress = name !== 'gzip' || a.flags.has('d');
      const toStdout = name === 'zcat' || a.flags.has('c');
      let exit = 0;
      if (!a.operands.length) {
        if (decompress) {
          const t = gunzipText(ctx.stdin);
          if (t === null) {
            ctx.err(`${name}: stdin: not in gzip format\n`);
            return 1;
          }
          ctx.out(t);
        } else ctx.out(gzipText(ctx.stdin));
        return 0;
      }
      for (const fpath of a.operands) {
        try {
          const text = ctx.fs.readFile(fpath);
          if (decompress) {
            if (!fpath.endsWith('.gz') && !fpath.endsWith('.tgz') && !toStdout) {
              ctx.err(`${name}: ${fpath}: unknown suffix -- ignored\n`);
              exit = 1;
              continue;
            }
            const t = gunzipText(text);
            if (t === null) {
              ctx.err(`${name}: ${fpath}: not in gzip format\n`);
              exit = 1;
              continue;
            }
            if (toStdout) ctx.out(t);
            else {
              const out = fpath.endsWith('.tgz') ? fpath.slice(0, -4) + '.tar' : fpath.slice(0, -3);
              ctx.fs.writeFile(out, t);
              if (!a.flags.has('k')) ctx.fs.unlink(fpath);
            }
          } else {
            if (fpath.endsWith('.gz')) {
              ctx.err(`gzip: ${fpath} already has .gz suffix -- unchanged\n`);
              exit = 1;
              continue;
            }
            const z = gzipText(text);
            if (toStdout) ctx.out(z);
            else {
              ctx.fs.writeFile(fpath + '.gz', z);
              if (a.flags.has('v')) ctx.out(`${fpath}:\t ${Math.max(0, 100 - Math.round((z.length / Math.max(1, text.length)) * 100) * 0.35).toFixed(1)}% -- replaced with ${fpath}.gz\n`);
              if (!a.flags.has('k')) ctx.fs.unlink(fpath);
            }
          }
        } catch (e) {
          exit = fsErr(ctx, e, fpath);
        }
      }
      return exit;
    },
  };
}

// ── fingerprints ──

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const sha256sum: ShellCommand = {
  ...cmdDoc({
    name: 'sha256sum',
    summary: bi('посчитать отпечаток SHA-256 файла', 'compute and check SHA-256 message digests'),
    whatis: 'compute and check SHA256 message digest',
    synopsis: ['sha256sum [OPTION]... [FILE]...'],
    description: 'Print or check SHA256 (256-bit) checksums. With no FILE, or when FILE is -, read standard input.\nThe sums are computed as described in FIPS-180-2. When checking, the input should be a former output of this program: a checksum, two spaces, a file name.',
    options: [
      ['-c, --check', 'read checksums from the FILEs and check them'],
      ['--quiet', "don't print OK for each successfully verified file"],
      ['--status', "don't output anything, status code shows success"],
    ],
    exit: '0  all checksums matched (or were computed)\n1  a checksum did not match or a file could not be read',
    examples: [
      ['sha256sum app.tar.gz', 'The fingerprint of a downloaded file.'],
      ['sha256sum -c SHA256SUMS', 'Check every file listed in SHA256SUMS against its published sum.'],
    ],
    seeAlso: 'md5sum(1), sha512sum(1)',
  }),
  async run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'cb', long: { check: 'c', quiet: 'quiet', status: 'status', binary: 'b', text: 't' } });
    if (a.error) return usageError(ctx, a.error);
    if (a.flags.has('c')) {
      const inputs = readInputs(ctx, a.operands);
      let bad = 0;
      let unread = 0;
      for (const inp of inputs) {
        for (const line of lines(inp.text)) {
          const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
          if (!m) continue;
          let text: string;
          try {
            text = ctx.fs.readFile(m[2]);
          } catch {
            ctx.err(`sha256sum: ${m[2]}: No such file or directory\n`);
            if (!a.flags.has('status')) ctx.out(`${m[2]}: FAILED open or read\n`);
            unread++;
            continue;
          }
          const ok = (await sha256(text)) === m[1];
          if (!ok) bad++;
          if (!a.flags.has('status') && !(ok && a.flags.has('quiet'))) ctx.out(`${m[2]}: ${ok ? 'OK' : 'FAILED'}\n`);
        }
      }
      if (unread && !a.flags.has('status')) ctx.err(`sha256sum: WARNING: ${unread} listed file${unread > 1 ? 's' : ''} could not be read\n`);
      if (bad && !a.flags.has('status')) ctx.err(`sha256sum: WARNING: ${bad} computed checksum${bad > 1 ? 's' : ''} did NOT match\n`);
      return bad || unread ? 1 : 0;
    }
    const inputs = readInputs(ctx, a.operands);
    for (const inp of inputs) ctx.out(`${await sha256(inp.text)}  ${inp.name}\n`);
    return inputs.failed ? 1 : 0;
  },
};

const getfacl: ShellCommand = {
  ...cmdDoc({
    name: 'lsattr',
    summary: bi('показать атрибуты файла ext4', 'list file attributes on an ext4 file system'),
    whatis: 'list file attributes on a Linux second extended file system',
    synopsis: ['lsattr [ -RVadlpv ] [ files...  ]'],
    description: 'lsattr lists the file attributes on a Linux file system (chattr(1) sets them). On this machine no file has extra attributes.',
    seeAlso: 'chattr(1)',
  }),
  run(ctx) {
    for (const f of ctx.argv.slice(1).filter((x) => !x.startsWith('-'))) ctx.out(`--------------e------- ${f}\n`);
    return 0;
  },
};

export const FILE_COMMANDS: ShellCommand[] = [cp, mv, ln, rmdir, stat, file, find, tree, chmod, chownLike('chown'), chownLike('chgrp'), readlink, realpath, basenameCmd, dirnameCmd, du, df, tar, gzipLike('gzip'), gzipLike('gunzip'), gzipLike('zcat'), sha256sum, getfacl];

