// The handful of everyday commands the platform core ships with. The Linux
// block extends the set (and may replace any of these with `override: true`).
// Help texts and man pages are condensed from the real ones and carry the
// man7.org address of the page they follow.

import { bi } from '../../../core/i18n';
import type { CmdContext, ManPage, ShellCommand, Stat } from '../../../core/types';
import { corpus, renderManText, shortOf } from '../../docs/corpus';
import { basename, isFsError, modeString } from '../vfs';
import { columns, fsErr, humanSize, lsTime, parseArgs, usageError } from './util';

const man7 = (name: string, sec: number | string) => `https://man7.org/linux/man-pages/man${String(sec)[0]}/${name}.${sec}.html`;

function page(name: string, sec: number | string, sections: ManPage['sections']): ManPage {
  return { section: sec, url: man7(name, sec), license: 'condensed from the GNU coreutils / Linux man-pages documentation', sections };
}

// ── echo ──
const echo: ShellCommand = {
  name: 'echo',
  builtin: true,
  summary: bi('напечатать строку', 'print a line of text'),
  handlesHelp: true,
  help: `Usage: echo [SHORT-OPTION]... [STRING]...
Echo the STRING(s) to standard output.

  -n             do not output the trailing newline
  -e             enable interpretation of backslash escapes
  -E             disable interpretation of backslash escapes (default)`,
  man: page('echo', 1, [
    { id: 'NAME', body: 'echo - display a line of text' },
    { id: 'SYNOPSIS', body: 'echo [SHORT-OPTION]... [STRING]...' },
    { id: 'DESCRIPTION', body: 'Echo the STRING(s) to standard output, separated by single spaces and followed by a newline.' },
    {
      id: 'OPTIONS',
      body: '-n     do not output the trailing newline\n-e     enable interpretation of backslash escapes\n-E     disable interpretation of backslash escapes (default)\n\nIf -e is in effect, the following sequences are recognized:\n\\\\     backslash\n\\n     new line\n\\t     horizontal tab',
    },
    { id: 'EXAMPLES', body: 'echo "Hello, $USER"\n    Print a greeting with the value of the USER variable.\necho -n done\n    Print "done" without a newline.' },
    { id: 'SEE ALSO', body: 'printf(1)' },
  ]),
  run(ctx) {
    let args = ctx.argv.slice(1);
    let newline = true;
    let escapes = false;
    while (args.length && /^-[neE]+$/.test(args[0])) {
      for (const c of args[0].slice(1)) {
        if (c === 'n') newline = false;
        if (c === 'e') escapes = true;
        if (c === 'E') escapes = false;
      }
      args = args.slice(1);
    }
    let text = args.join(' ');
    if (escapes) text = text.replace(/\\(\\|n|t|e)/g, (_, c) => ({ '\\': '\\', n: '\n', t: '\t', e: '\x1b' })[c as string] ?? c);
    ctx.out(text + (newline ? '\n' : ''));
    return 0;
  },
};

// ── pwd ──
const pwd: ShellCommand = {
  name: 'pwd',
  builtin: true,
  summary: bi('показать текущий каталог', 'print the current directory'),
  help: `Usage: pwd [OPTION]...
Print the full filename of the current working directory.

  -L, --logical   use PWD from environment, even if it contains symlinks
  -P, --physical  avoid all symlinks`,
  man: page('pwd', 1, [
    { id: 'NAME', body: 'pwd - print name of current/working directory' },
    { id: 'SYNOPSIS', body: 'pwd [OPTION]...' },
    { id: 'DESCRIPTION', body: 'Print the full filename of the current working directory.' },
    { id: 'OPTIONS', body: '-L, --logical\n       use PWD from environment, even if it contains symlinks\n-P, --physical\n       avoid all symlinks\n--help display this help and exit' },
    { id: 'SEE ALSO', body: 'cd(1p)' },
  ]),
  run(ctx) {
    ctx.out(ctx.cwd + '\n');
    return 0;
  },
};

// ── ls ──
const LS_HELP = `Usage: ls [OPTION]... [FILE]...
List information about the FILEs (the current directory by default).
Sort entries alphabetically.

  -a, --all                  do not ignore entries starting with .
  -A, --almost-all           do not list implied . and ..
  -d, --directory            list directories themselves, not their contents
  -F, --classify             append indicator (one of */=>@|) to entries
  -h, --human-readable       with -l, print sizes like 1K 234M 2G etc.
  -i, --inode                print the index number of each file
  -l                         use a long listing format
  -n, --numeric-uid-gid      like -l, but list numeric user and group IDs
  -r, --reverse              reverse order while sorting
  -R, --recursive            list subdirectories recursively
  -S                         sort by file size, largest first
      --sort=WORD            sort by WORD instead of name: none (-U), size (-S),
                             time (-t)
  -t                         sort by time, newest first
  -1                         list one file per line

Exit status:
 0  if OK,
 1  if minor problems (e.g., cannot access subdirectory),
 2  if serious trouble (e.g., cannot access command-line argument).`;

function colorName(name: string, st: Stat | null, ctx: CmdContext): string {
  if (!ctx.isatty || !st) return name;
  if (st.type === 'd') return st.mode & 0o1000 && st.mode & 0o002 ? `\x1b[30;42m${name}\x1b[0m` : `\x1b[1;34m${name}\x1b[0m`;
  if (st.type === 'l') return `\x1b[1;36m${name}\x1b[0m`;
  if (st.type === 'c') return `\x1b[1;33m${name}\x1b[0m`;
  if (st.mode & 0o111) return `\x1b[1;32m${name}\x1b[0m`;
  return name;
}

function classify(st: Stat | null): string {
  if (!st) return '';
  if (st.type === 'd') return '/';
  if (st.type === 'l') return '@';
  if (st.mode & 0o111) return '*';
  return '';
}

const ls: ShellCommand = {
  name: 'ls',
  summary: bi('показать содержимое каталога', 'list directory contents'),
  help: LS_HELP,
  man: page('ls', 1, [
    { id: 'NAME', body: 'ls - list directory contents' },
    { id: 'SYNOPSIS', body: 'ls [OPTION]... [FILE]...' },
    { id: 'DESCRIPTION', body: 'List information about the FILEs (the current directory by default). Sort entries alphabetically.\nMandatory arguments to long options are mandatory for short options too.' },
    {
      id: 'OPTIONS',
      body: '-a, --all\n       do not ignore entries starting with .\n-A, --almost-all\n       do not list implied . and ..\n-d, --directory\n       list directories themselves, not their contents\n-F, --classify\n       append indicator (one of */=>@|) to entries\n-h, --human-readable\n       with -l, print sizes like 1K 234M 2G etc.\n-i, --inode\n       print the index number of each file\n-l     use a long listing format\n-n, --numeric-uid-gid\n       like -l, but list numeric user and group IDs\n-r, --reverse\n       reverse order while sorting\n-R, --recursive\n       list subdirectories recursively\n-S     sort by file size, largest first\n--sort=WORD\n       sort by WORD instead of name: none (-U), size (-S), time (-t), version (-v), extension (-X)\n-t     sort by time, newest first; see --time\n-1     list one file per line',
    },
    {
      id: 'EXIT STATUS',
      body: '0      if OK,\n1      if minor problems (e.g., cannot access subdirectory),\n2      if serious trouble (e.g., cannot access command-line argument).',
    },
    { id: 'EXAMPLES', body: 'ls -l /etc\n    Long listing of /etc: type and permissions, links, owner, group, size, time, name.\nls -la ~\n    Everything in the home directory, hidden files included.' },
    { id: 'SEE ALSO', body: 'dircolors(1), stat(1)' },
  ]),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), {
      short: 'aAdFhilR1nrStU',
      long: { all: 'a', 'almost-all': 'A', directory: 'd', classify: 'F', 'human-readable': 'h', inode: 'i', recursive: 'R', 'numeric-uid-gid': 'n', reverse: 'r', sort: 'sort', color: 'color' },
      longWithValue: ['sort'],
    });
    if (a.values.sort === 'size') a.flags.add('S');
    if (a.values.sort === 'time') a.flags.add('t');
    if (a.values.sort === 'none') a.flags.add('U');
    if (a.flags.has('n')) a.flags.add('l');
    if (a.error) return usageError(ctx, a.error);
    const f = a.flags;
    const targets = a.operands.length ? a.operands : ['.'];
    let exit = 0;
    const users = ctx.machine.users;
    const groups = ctx.machine.groups;
    const mm = ctx.machine as unknown as { userName_?(uid: number): string; groupName_?(gid: number): string; displayUid?(uid: number): number };
    const ownerName = (uid: number) => (f.has('n') ? String(mm.displayUid?.(uid) ?? uid) : (mm.userName_?.(uid) ?? users.find((u) => u.uid === uid)?.name ?? String(uid)));
    const groupName = (gid: number) => (f.has('n') ? String(gid) : (mm.groupName_?.(gid) ?? groups.find((g) => g.gid === gid)?.name ?? String(gid)));

    const longLine = (name: string, st: Stat, path: string) => {
      const rdev = (st as Stat & { rdev?: string }).rdev;
      const size = rdev ?? (f.has('h') ? humanSize(st.size) : String(st.size));
      const ino = f.has('i') ? `${st.ino} ` : '';
      let shown = colorName(name, st, ctx) + (f.has('F') ? classify(st) : '');
      if (st.type === 'l') {
        let target = st.target ?? '';
        try {
          target = ctx.fs.readlink(path);
        } catch {
          /* ignore */
        }
        shown += ` -> ${target}`;
      }
      return { ino, mode: modeString(st.type, st.mode), nlink: String(st.nlink), owner: ownerName(st.uid), group: groupName(st.gid), size, time: lsTime(st.mtime), shown };
    };

    const printLong = (rows: ReturnType<typeof longLine>[]) => {
      const w = (k: keyof ReturnType<typeof longLine>) => Math.max(...rows.map((r) => r[k].length));
      const wn = w('nlink');
      const wo = w('owner');
      const wg = w('group');
      const ws = w('size');
      for (const r of rows) ctx.out(`${r.ino}${r.mode} ${r.nlink.padStart(wn)} ${r.owner.padEnd(wo)} ${r.group.padEnd(wg)} ${r.size.padStart(ws)} ${r.time} ${r.shown}\n`);
    };

    const printNames = (entries: { name: string; st: Stat | null }[]) => {
      if (f.has('l')) {
        printLong(entries.filter((e) => e.st).map((e) => longLine(e.name, e.st!, (e as { path?: string }).path ?? e.name)));
        return;
      }
      const items = entries.map((e) => {
        const ino = f.has('i') && e.st ? `${e.st.ino} ` : '';
        const text = ino + colorName(e.name, e.st, ctx) + (f.has('F') ? classify(e.st) : '');
        return { text, width: (ino + e.name + (f.has('F') ? classify(e.st) : '')).length };
      });
      if (!ctx.isatty || f.has('1')) for (const it of items) ctx.out(it.text + '\n');
      else ctx.out(columns(items, ctx.cols));
    };

    const files: { name: string; st: Stat | null; path: string }[] = [];
    const dirs: string[] = [];
    for (const t of targets) {
      let st: Stat | null;
      try {
        st = ctx.fs.lstat(t);
        if (st?.type === 'l' && !f.has('l') && !f.has('d')) st = ctx.fs.stat(t) ?? st;
      } catch (e) {
        exit = 2;
        fsErr(ctx, e, t, 'cannot access');
        continue;
      }
      if (!st) {
        ctx.err(`ls: cannot access '${t}': No such file or directory\n`);
        exit = 2;
        continue;
      }
      if (st.type === 'd' && !f.has('d')) dirs.push(t);
      else files.push({ name: t, st, path: t });
    }
    if (files.length) printNames(sortEntries(files, f));

    const listDir = (dir: string, header: boolean) => {
      let names: string[];
      try {
        names = ctx.fs.readdir(dir);
      } catch (e) {
        if (isFsError(e)) {
          ctx.err(`ls: cannot open directory '${dir}': ${e.text}\n`);
          exit = exit || 1;
          return;
        }
        throw e;
      }
      if (f.has('a')) names = ['.', '..', ...names];
      else if (!f.has('A')) names = names.filter((n) => !n.startsWith('.'));
      names.sort((x, y) => x.replace(/^\./, '').localeCompare(y.replace(/^\./, ''), 'en'));
      if (header) ctx.out(`${dir}:\n`);
      let entries = names.map((n) => {
        const path = `${dir.replace(/\/$/, '')}/${n}`;
        let st: Stat | null = null;
        try {
          st = ctx.fs.lstat(path);
        } catch {
          st = null;
        }
        return { name: n, st, path };
      });
      entries = sortEntries(entries, f);
      if (f.has('l')) {
        const total = entries.reduce((s, e) => s + (e.st ? Math.ceil(e.st.size / 4096) * 4 : 0), 0);
        ctx.out(`total ${total}\n`);
      }
      printNames(entries);
      if (f.has('R')) {
        for (const e of entries) {
          if (e.st?.type === 'd' && e.name !== '.' && e.name !== '..') {
            ctx.out('\n');
            listDir(e.path, true);
          }
        }
      }
    };
    dirs.forEach((d, i) => {
      if (i > 0 || files.length) ctx.out('\n');
      listDir(d, targets.length > 1 || f.has('R'));
    });
    return exit;
  },
};

function sortEntries<T extends { name: string; st: Stat | null }>(entries: T[], f: Set<string>): T[] {
  let out = [...entries];
  if (f.has('U')) return out;
  if (f.has('S')) out.sort((a, b) => (b.st?.size ?? 0) - (a.st?.size ?? 0) || a.name.localeCompare(b.name, 'en'));
  else if (f.has('t')) out.sort((a, b) => (b.st?.mtime ?? 0) - (a.st?.mtime ?? 0) || a.name.localeCompare(b.name, 'en'));
  if (f.has('r')) out = out.reverse();
  return out;
}

// ── cat ──
const cat: ShellCommand = {
  name: 'cat',
  summary: bi('вывести содержимое файлов', 'print the contents of files'),
  help: `Usage: cat [OPTION]... [FILE]...
Concatenate FILE(s) to standard output.

With no FILE, or when FILE is -, read standard input.

  -n, --number             number all output lines`,
  man: page('cat', 1, [
    { id: 'NAME', body: 'cat - concatenate files and print on the standard output' },
    { id: 'SYNOPSIS', body: 'cat [OPTION]... [FILE]...' },
    { id: 'DESCRIPTION', body: 'Concatenate FILE(s) to standard output.\nWith no FILE, or when FILE is -, read standard input.' },
    { id: 'OPTIONS', body: '-n, --number\n       number all output lines\n--help display this help and exit' },
    { id: 'EXAMPLES', body: 'cat f - g\n    Output f\'s contents, then standard input, then g\'s contents.\ncat\n    Copy standard input to standard output.' },
    { id: 'SEE ALSO', body: 'tac(1)' },
  ]),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'n', long: { number: 'n' } });
    if (a.error) return usageError(ctx, a.error);
    const files = a.operands.length ? a.operands : ['-'];
    let exit = 0;
    let text = '';
    for (const f of files) {
      if (f === '-') {
        text += ctx.stdin;
        continue;
      }
      try {
        text += ctx.fs.readFile(f);
      } catch (e) {
        exit = fsErr(ctx, e, f);
      }
    }
    if (a.flags.has('n')) {
      const lines = text.split('\n');
      const trailing = text.endsWith('\n');
      if (trailing) lines.pop();
      text = lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join('\n') + (trailing ? '\n' : '');
    }
    ctx.out(text);
    return exit;
  },
};

// ── mkdir ──
const mkdir: ShellCommand = {
  name: 'mkdir',
  summary: bi('создать каталог', 'make directories'),
  help: `Usage: mkdir [OPTION]... DIRECTORY...
Create the DIRECTORY(ies), if they do not already exist.

  -m, --mode=MODE   set file mode (as in chmod), not a=rwx - umask
  -p, --parents     no error if existing, make parent directories as needed
  -v, --verbose     print a message for each created directory`,
  man: page('mkdir', 1, [
    { id: 'NAME', body: 'mkdir - make directories' },
    { id: 'SYNOPSIS', body: 'mkdir [OPTION]... DIRECTORY...' },
    { id: 'DESCRIPTION', body: 'Create the DIRECTORY(ies), if they do not already exist.' },
    { id: 'OPTIONS', body: '-m, --mode=MODE\n       set file mode (as in chmod), not a=rwx - umask\n-p, --parents\n       no error if existing, make parent directories as needed\n-v, --verbose\n       print a message for each created directory' },
    { id: 'SEE ALSO', body: 'mkdir(2), rmdir(1)' },
  ]),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'pv', withValue: 'm', long: { parents: 'p', verbose: 'v', mode: 'm' } });
    if (a.error) return usageError(ctx, a.error);
    if (!a.operands.length) return usageError(ctx, 'missing operand');
    const mode = a.values.m !== undefined ? parseInt(a.values.m, 8) : undefined;
    if (a.values.m !== undefined && (Number.isNaN(mode) || !/^[0-7]{1,4}$/.test(a.values.m))) {
      ctx.err(`mkdir: invalid mode '${a.values.m}'\n`);
      return 1;
    }
    let exit = 0;
    for (const d of a.operands) {
      try {
        const existed = ctx.fs.exists(d);
        ctx.fs.mkdir(d, { parents: a.flags.has('p') });
        if (mode !== undefined) ctx.fs.chmod(d, mode);
        if (a.flags.has('v') && !existed) ctx.out(`mkdir: created directory '${d}'\n`);
      } catch (e) {
        exit = fsErr(ctx, e, d, 'cannot create directory');
      }
    }
    return exit;
  },
};

// ── touch ──
const touch: ShellCommand = {
  name: 'touch',
  summary: bi('создать файл или обновить его время', 'create a file or update its time'),
  help: `Usage: touch [OPTION]... FILE...
Update the access and modification times of each FILE to the current time.

A FILE argument that does not exist is created empty, unless -c is supplied.

  -c, --no-create        do not create any files`,
  man: page('touch', 1, [
    { id: 'NAME', body: 'touch - change file timestamps' },
    { id: 'SYNOPSIS', body: 'touch [OPTION]... FILE...' },
    { id: 'DESCRIPTION', body: 'Update the access and modification times of each FILE to the current time.\nA FILE argument that does not exist is created empty, unless -c or -h is supplied.' },
    { id: 'OPTIONS', body: '-c, --no-create\n       do not create any files\n--help display this help and exit' },
    { id: 'SEE ALSO', body: 'stat(1)' },
  ]),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'c', long: { 'no-create': 'c' } });
    if (a.error) return usageError(ctx, a.error);
    if (!a.operands.length) return usageError(ctx, 'missing file operand');
    let exit = 0;
    for (const f of a.operands) {
      try {
        if (ctx.fs.exists(f)) ctx.fs.utimes(f, (ctx.machine as unknown as { now(): number }).now());
        else if (!a.flags.has('c')) ctx.fs.writeFile(f, '');
      } catch (e) {
        exit = fsErr(ctx, e, f, 'cannot touch');
      }
    }
    return exit;
  },
};

// ── rm ──
const rm: ShellCommand = {
  name: 'rm',
  summary: bi('удалить файлы или каталоги', 'remove files or directories'),
  help: `Usage: rm [OPTION]... [FILE]...
Remove (unlink) the FILE(s).

  -f, --force           ignore nonexistent files and arguments, never prompt
  -r, -R, --recursive   remove directories and their contents recursively
  -d, --dir             remove empty directories
  -v, --verbose         explain what is being done
      --no-preserve-root  do not treat '/' specially
      --preserve-root   do not remove '/' (default)

By default, rm does not remove directories.  Use the --recursive (-r or -R)
option to remove each listed directory, too, along with all of its contents.`,
  man: page('rm', 1, [
    { id: 'NAME', body: 'rm - remove files or directories' },
    { id: 'SYNOPSIS', body: 'rm [OPTION]... [FILE]...' },
    {
      id: 'DESCRIPTION',
      body: 'rm removes each specified file. By default, it does not remove directories.\nRemoving a name does not always free space: the data goes away only when the last hard link and the last open descriptor are gone.',
    },
    {
      id: 'OPTIONS',
      body: '-f, --force\n       ignore nonexistent files and arguments, never prompt\n-r, -R, --recursive\n       remove directories and their contents recursively\n-d, --dir\n       remove empty directories\n-v, --verbose\n       explain what is being done\n--preserve-root\n       do not remove \'/\' (default)',
    },
    { id: 'SEE ALSO', body: 'unlink(1), unlink(2), rmdir(1)' },
  ]),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), {
      short: 'fRrdvi',
      long: { force: 'f', recursive: 'r', dir: 'd', verbose: 'v', 'preserve-root': 'preserve-root', 'no-preserve-root': 'no-preserve-root' },
    });
    if (a.error) return usageError(ctx, a.error);
    const f = a.flags;
    const recursive = f.has('r') || f.has('R');
    if (!a.operands.length) {
      if (f.has('f')) return 0;
      return usageError(ctx, 'missing operand');
    }
    let exit = 0;
    const removeTree = (path: string) => {
      const st = ctx.fs.lstat(path);
      if (st?.type === 'd') {
        for (const n of ctx.fs.readdir(path)) removeTree(`${path.replace(/\/$/, '')}/${n}`);
        ctx.fs.rmdir(path);
      } else ctx.fs.unlink(path);
      if (f.has('v')) ctx.out(st?.type === 'd' ? `removed directory '${path}'\n` : `removed '${path}'\n`);
    };
    for (const p of a.operands) {
      if (ctx.fs.resolve(p) === '/' && recursive && !f.has('no-preserve-root')) {
        ctx.err(`rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n`);
        exit = 1;
        continue;
      }
      if (basename(p) === '.' || basename(p) === '..' || /(^|\/)\.\.?\/?$/.test(p)) {
        ctx.err(`rm: refusing to remove '.' or '..' directory: skipping '${p}'\n`);
        exit = 1;
        continue;
      }
      try {
        const st = ctx.fs.lstat(p);
        if (!st) {
          if (!f.has('f')) {
            ctx.err(`rm: cannot remove '${p}': No such file or directory\n`);
            exit = 1;
          }
          continue;
        }
        if (st.type === 'd') {
          if (recursive) removeTree(p);
          else if (f.has('d')) {
            ctx.fs.rmdir(p);
            if (f.has('v')) ctx.out(`removed directory '${p}'\n`);
          } else {
            ctx.err(`rm: cannot remove '${p}': Is a directory\n`);
            exit = 1;
          }
        } else {
          ctx.fs.unlink(p);
          if (f.has('v')) ctx.out(`removed '${p}'\n`);
        }
      } catch (e) {
        exit = fsErr(ctx, e, p, 'cannot remove');
      }
    }
    return exit;
  },
};

// ── grep ──
const grep: ShellCommand = {
  name: 'grep',
  aliases: ['egrep'],
  summary: bi('найти строки по образцу', 'print lines that match a pattern'),
  help: `Usage: grep [OPTION]... PATTERNS [FILE]...
Search for PATTERNS in each FILE.
Example: grep -i 'hello world' menu.h main.c
PATTERNS can contain multiple patterns separated by newlines.

Pattern selection and interpretation:
  -E, --extended-regexp     PATTERNS are extended regular expressions
  -F, --fixed-strings       PATTERNS are strings
  -e, --regexp=PATTERNS     use PATTERNS for matching
  -i, --ignore-case         ignore case distinctions in patterns and data
  -w, --word-regexp         match only whole words
  -x, --line-regexp         match only whole lines

Miscellaneous:
  -v, --invert-match        select non-matching lines

Output control:
  -c, --count               print only a count of selected lines per FILE
  -n, --line-number         print line number with output lines
  -H, --with-filename       print file name with output lines
  -h, --no-filename         suppress the file name prefix on output
  -o, --only-matching       show only nonempty parts of lines that match
  -q, --quiet, --silent     suppress all normal output
  -r, --recursive           read all files under each directory, recursively
  -l, --files-with-matches  print only names of FILEs with selected lines

When FILE is '-', read standard input.  With no FILE, read '.' if
recursive, '-' otherwise.  With fewer than two FILEs, assume -h.
Exit status is 0 if any line is selected, 1 otherwise;
if any error occurs and -q is not given, the exit status is 2.`,
  man: page('grep', 1, [
    { id: 'NAME', body: 'grep - print lines that match patterns' },
    { id: 'SYNOPSIS', body: 'grep [OPTION...] PATTERNS [FILE...]\ngrep [OPTION...] -e PATTERNS ... [FILE...]' },
    { id: 'DESCRIPTION', body: 'grep searches for PATTERNS in each FILE. PATTERNS is one or more patterns separated by newline characters, and grep prints each line that matches a pattern. Typically PATTERNS should be quoted when grep is used in a shell command.\nA FILE of "-" stands for standard input. If no FILE is given, recursive searches examine the working directory, and nonrecursive searches read standard input.' },
    {
      id: 'OPTIONS',
      body: '-E, --extended-regexp\n       Interpret PATTERNS as extended regular expressions (EREs).\n-F, --fixed-strings\n       Interpret PATTERNS as fixed strings, not regular expressions.\n-e PATTERNS, --regexp=PATTERNS\n       Use PATTERNS as the patterns.\n-i, --ignore-case\n       Ignore case distinctions in patterns and input data.\n-v, --invert-match\n       Invert the sense of matching, to select non-matching lines.\n-w, --word-regexp\n       Select only those lines containing matches that form whole words.\n-x, --line-regexp\n       Select only those matches that exactly match the whole line.\n-c, --count\n       Suppress normal output; instead print a count of matching lines for each input file.\n-l, --files-with-matches\n       Suppress normal output; instead print the name of each input file from which output would normally have been printed.\n-o, --only-matching\n       Print only the matched (non-empty) parts of a matching line, with each such part on a separate output line.\n-q, --quiet, --silent\n       Quiet; do not write anything to standard output. Exit immediately with zero status if any match is found.\n-H, --with-filename\n       Print the file name for each match. This is the default when there is more than one file to search.\n-h, --no-filename\n       Suppress the prefixing of file names on output.\n-n, --line-number\n       Prefix each line of output with the 1-based line number within its input file.\n-r, --recursive\n       Read all files under each directory, recursively.\n-R, --dereference-recursive\n       Read all files under each directory, recursively. Follow all symbolic links.',
    },
    { id: 'REGULAR EXPRESSIONS', body: 'A regular expression is a pattern that describes a set of strings.\nThe period . matches any single character. A bracket expression [abc] matches any one character in the list. ^ and $ match the empty string at the beginning and end of a line.\nThe repetition operator * means the preceding item will be matched zero or more times. In extended regular expressions (-E) also + (one or more), ? (at most once), {n,m}, alternation | and grouping ( ).\nIn basic regular expressions the meta-characters ?, +, {, |, (, and ) lose their special meaning; instead use the backslashed versions \\?, \\+, \\{, \\|, \\(, and \\).' },
    { id: 'EXIT STATUS', body: 'Normally the exit status is 0 if a line is selected, 1 if no lines were selected, and 2 if an error occurred. However, if the -q is used and a line is selected, the exit status is 0 even if an error occurred.' },
    { id: 'EXAMPLES', body: "ls /etc | grep conf\n    Names in /etc that contain 'conf'.\ngrep -n ERROR app.log\n    Lines with ERROR and their numbers.\ngrep -rn 'listen' /etc/nginx\n    Every line with 'listen' in every file under /etc/nginx." },
    { id: 'SEE ALSO', body: 'sed(1), awk(1), find(1), regex(7)' },
  ]),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), {
      short: 'EFivcnlqsHhowxrR',
      withValue: 'eABCm',
      long: { 'extended-regexp': 'E', 'fixed-strings': 'F', 'ignore-case': 'i', 'invert-match': 'v', count: 'c', 'line-number': 'n', 'files-with-matches': 'l', quiet: 'q', silent: 'q', 'with-filename': 'H', 'no-filename': 'h', 'only-matching': 'o', 'word-regexp': 'w', 'line-regexp': 'x', recursive: 'r', 'dereference-recursive': 'R', regexp: 'e', 'after-context': 'A', 'before-context': 'B', context: 'C', 'max-count': 'm', color: 'color' },
    });
    if (a.error) {
      ctx.err(`grep: ${a.error}\nUsage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n`);
      return 2;
    }
    for (const flag of ['A', 'B', 'C', 'm']) {
      if (a.values[flag] !== undefined && !/^\d+$/.test(a.values[flag])) return 2;
    }
    const limit = a.values.m === undefined ? Infinity : Number(a.values.m);
    const before = Number(a.values.B ?? a.values.C ?? 0);
    const after = Number(a.values.A ?? a.values.C ?? 0);
    const f = a.flags;
    if (ctx.argv[0] === 'egrep') f.add('E');
    const ops = [...a.operands];
    const pattern = a.values.e ?? ops.shift();
    if (pattern === undefined) {
      ctx.err("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n");
      return 2;
    }
    const recursive = f.has('r') || f.has('R');
    let re: RegExp;
    try {
      let src = pattern
        .split('\n')
        .map((p) => (f.has('F') ? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : f.has('E') ? p : basicToJs(p)))
        .join('|');
      if (f.has('w')) src = `(?<![\\w])(?:${src})(?![\\w])`;
      if (f.has('x')) src = `^(?:${src})$`;
      re = new RegExp(src, f.has('i') ? 'i' : '');
    } catch {
      ctx.err('grep: Unmatched ( or \\(\n');
      return 2;
    }
    let inputs = ops.length ? ops : [recursive ? '.' : '-'];
    if (recursive) {
      const expanded: string[] = [];
      const walk = (p: string) => {
        let st: Stat | null = null;
        try {
          st = ctx.fs.lstat(p);
        } catch {
          st = null;
        }
        if (st?.type === 'd') {
          let names: string[] = [];
          try {
            names = ctx.fs.readdir(p);
          } catch (e) {
            if (isFsError(e)) ctx.err(`grep: ${p}: ${e.text}\n`);
            return;
          }
          for (const n of names) walk(p === '.' && !ops.length ? n : `${p.replace(/\/$/, '')}/${n}`);
        } else if (st?.type === 'l' && !f.has('R')) return;
        else expanded.push(p);
      };
      for (const p of inputs) walk(p);
      inputs = expanded;
    }
    const many = f.has('H') || (!f.has('h') && (inputs.length > 1 || recursive));
    let any = false;
    let error = false;
    for (const file of inputs) {
      let text: string;
      try {
        if (file !== '-' && ctx.fs.stat(file)?.type === 'd') {
          ctx.err(`grep: ${file}: Is a directory\n`);
          error = true;
          continue;
        }
        text = file === '-' ? ctx.stdin : ctx.fs.readFile(file);
      } catch (e) {
        if (isFsError(e)) {
          if (!f.has('s')) ctx.err(`grep: ${file}: ${e.text}\n`);
          error = true;
          continue;
        }
        throw e;
      }
      const label = file === '-' ? '(standard input)' : file;
      const lines = text.split('\n');
      if (text.endsWith('\n')) lines.pop();
      const matched = new Set<number>();
      for (let i = 0; i < lines.length && matched.size < limit; i++) {
        if (re.test(lines[i]) !== f.has('v')) matched.add(i);
      }
      const count = matched.size;
      any ||= count > 0;
      const shownIndices = new Set<number>();
      for (const i of matched) for (let j = Math.max(0, i - before); j <= Math.min(lines.length - 1, i + after); j++) shownIndices.add(j);
      let last = -1;
      for (const i of [...shownIndices].sort((a, b) => a - b)) {
        if (f.has('q') || f.has('c') || f.has('l')) continue;
        const line = lines[i];
        const hit = matched.has(i);
        if (f.has('o') && !hit) continue;
        if ((before || after) && last >= 0 && i > last + 1) ctx.out('--\n');
        last = i;
        const sep = hit ? ':' : '-';
        const prefix = (many ? `${label}${sep}` : '') + (f.has('n') ? `${i + 1}${sep}` : '');
        if (f.has('o') && !f.has('v')) {
          for (const m of line.matchAll(new RegExp(re.source, re.flags + 'g'))) if (m[0]) ctx.out(prefix + m[0] + '\n');
          continue;
        }
        const shown = ctx.isatty && hit && !f.has('v') ? line.replace(new RegExp(re.source, re.flags + 'g'), (m) => (m ? `\x1b[1;31m${m}\x1b[0m` : m)) : line;
        ctx.out(prefix + shown + '\n');
      }
      if (f.has('q') && any) return 0;
      if (f.has('c') && !f.has('q')) ctx.out((many ? `${label}:` : '') + count + '\n');
      if (f.has('l') && count && !f.has('q')) ctx.out(label + '\n');
    }
    if (error && !(f.has('q') && any)) return 2;
    return any ? 0 : 1;
  },
};

/** POSIX basic regular expressions → JavaScript: \( \) \{ \} \| \+ \? are the operators. */
function basicToJs(p: string): string {
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\' && i + 1 < p.length) {
      const n = p[++i];
      out += '(){}|+?'.includes(n) ? n : `\\${n}`;
    } else if ('(){}|+?'.includes(c)) out += `\\${c}`;
    else out += c;
  }
  return out;
}

// ── clear ──
const clearCmd: ShellCommand = {
  name: 'clear',
  summary: bi('очистить экран терминала', 'clear the terminal screen'),
  help: 'Usage: clear\nclear clears your terminal\'s screen and its scrollback buffer.',
  man: {
    section: 1,
    url: 'https://man7.org/linux/man-pages/man1/clear.1.html',
    sections: [
      { id: 'NAME', body: 'clear - clear the terminal screen' },
      { id: 'SYNOPSIS', body: 'clear [-x]' },
      { id: 'DESCRIPTION', body: 'clear clears your terminal\'s screen and its scrollback buffer, if any.' },
      { id: 'SEE ALSO', body: 'tput(1), terminfo(5)' },
    ],
  },
  run(ctx) {
    ctx.effect({ kind: 'clear' });
    return 0;
  },
};

// ── help ──
const help: ShellCommand = {
  name: 'help',
  builtin: true,
  summary: bi('список команд этой машины', 'list the commands of this machine'),
  help: 'Usage: help [COMMAND]\nList the commands available on this machine, or show the --help of one of them.',
  run(ctx) {
    const name = ctx.argv[1];
    if (name) {
      const c = ctx.machine.lookup(name);
      if (!c) {
        ctx.err(`bash: help: no help topics match \`${name}'.\n`);
        return 1;
      }
      ctx.out((c.help ?? c.summary.en) + '\n');
      return 0;
    }
    const all = (ctx.machine as unknown as { registry: { commands: { list(): ShellCommand[] } } }).registry.commands.list();
    const width = Math.max(...all.map((c) => c.name.length)) + 2;
    ctx.out('Commands on this machine. Type `man NAME` or `NAME --help` to read about one.\n\n');
    for (const c of all) ctx.out(`  ${c.name.padEnd(width)}${c.summary.en}\n`);
    return 0;
  },
};

// ── man ──
const MAN_HELP = `Usage: man [SECTION] PAGE
Show the manual page PAGE.

  -k, --apropos   search the short descriptions for a keyword
  -f, --whatis    print the one-line description of PAGE

Navigate the pager with Space / b (page down / up), j / k (line), q to quit.`;

const manCmd: ShellCommand = {
  name: 'man',
  summary: bi('открыть страницу руководства', 'open a manual page'),
  help: MAN_HELP,
  man: page('man', 1, [
    { id: 'NAME', body: 'man - an interface to the system reference manuals' },
    { id: 'SYNOPSIS', body: 'man [SECTION] PAGE\nman -k KEYWORD\nman -f PAGE' },
    {
      id: 'DESCRIPTION',
      body: 'man is the system\'s manual pager. Each page argument given to man is normally the name of a program, utility or function.\nA manual page consists of several sections. Conventional section names include NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXIT STATUS, EXAMPLES and SEE ALSO.\nThe table below shows the section numbers of the manual:\n1   Executable programs or shell commands\n5   File formats and conventions, e.g. /etc/passwd\n7   Miscellaneous (overviews, conventions)\n8   System administration commands (usually only for root)',
    },
    { id: 'OPTIONS', body: '-k, --apropos\n       Search the short manual page descriptions for keywords.\n-f, --whatis\n       Display the one-line description of the page.' },
    {
      id: 'EXAMPLES',
      body: 'man ls\n    Display the manual page for the program ls.\nman 5 passwd\n    Display the page about the file format of /etc/passwd from section 5.\nman -k directory\n    Search the descriptions for the word "directory".',
    },
    { id: 'SEE ALSO', body: 'apropos(1), whatis(1), less(1)' },
  ]),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'kf', long: { apropos: 'k', whatis: 'f' } });
    if (a.error) return usageError(ctx, a.error);
    if (a.flags.has('k')) {
      const kw = (a.operands[0] ?? '').toLowerCase();
      if (!kw) return usageError(ctx, 'apropos what?');
      const hits = corpus
        .all()
        .filter((p) => p.source === 'man' && (p.title.toLowerCase().includes(kw) || shortOf(p).toLowerCase().includes(kw)))
        .sort((x, y) => x.title.localeCompare(y.title));
      if (!hits.length) {
        ctx.out(`${kw}: nothing appropriate.\n`);
        return 16;
      }
      for (const h of hits) ctx.out(`${h.title.replace('(', ' (')}${' '.repeat(Math.max(1, 20 - h.title.length))}- ${shortOf(h)}\n`);
      return 0;
    }
    if (!a.operands.length) {
      ctx.err('What manual page do you want?\nFor example, try \'man man\'.\n');
      return 1;
    }
    let section: string | undefined;
    let name = a.operands[0];
    if (a.operands.length > 1 && /^\d[a-z]*$/.test(a.operands[0])) {
      section = a.operands[0];
      name = a.operands[1];
    }
    const found = corpus.findMan(name, section);
    if (!found) {
      ctx.err(section ? `No entry for ${name} in section ${section} of the manual\n` : `No manual entry for ${name}\n`);
      return 16;
    }
    if (a.flags.has('f')) {
      ctx.out(`${found.title.replace('(', ' (')} - ${shortOf(found)}\n`);
      return 0;
    }
    const text = renderManText(found);
    if (ctx.isatty) {
      ctx.effect({ kind: 'pager', title: found.title, text });
      ctx.effect({ kind: 'doc', ref: { page: found.id } });
    } else ctx.out(text.replace(/\x1b\[[0-9;]*m/g, ''));
    return 0;
  },
};

export const BASIC_COMMANDS: ShellCommand[] = [echo, pwd, ls, cat, mkdir, touch, rm, grep, clearCmd, help, manCmd];
