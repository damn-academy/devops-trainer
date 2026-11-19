// `git` for the simulated machine: the porcelain the course teaches, with the
// messages real Git 2.5x prints. Plumbing lives in repo.ts, line diffs and the
// three-way merge in diff.ts, the remote side in forge.ts.

import type { CmdContext, FsApi, ShellCommand } from '../../../core/types';
import { bi } from '../../../core/i18n';
import { renderManText } from '../../../engine/docs/corpus';
import { hasConflictMarkers, lineStats, merge3, unifiedHunks } from './diff';
import { firePush, forgePath, forgeUrl, ForgeProject, projectOfUrl } from './forge';
import { GIT_MAN } from './man';
import { GitError, Repo, type Commit, type FlatTree, type IndexEntry } from './repo';
import { objectId } from './sha1';

export const GIT_VERSION = '2.52.0';

const C = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  boldCyan: (s: string) => `\x1b[1;36m${s}\x1b[0m`,
  boldGreen: (s: string) => `\x1b[1;32m${s}\x1b[0m`,
  boldRed: (s: string) => `\x1b[1;31m${s}\x1b[0m`,
};
const noColor = Object.fromEntries(Object.keys(C).map((k) => [k, (s: string) => s])) as typeof C;

const short = (oid: string | null | undefined) => (oid ? oid.slice(0, 7) : '0000000');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function gitDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ${d.getUTCFullYear()} +0000`;
}

function clockOf(ctx: CmdContext): () => number {
  const m = ctx.machine as unknown as { now?: () => number };
  return () => (typeof m.now === 'function' ? m.now() : Date.now());
}

interface Io {
  ctx: CmdContext;
  out: (s: string) => void;
  err: (s: string) => void;
  c: typeof C;
  fsWrite: (p: string, s: string) => void;
}

function openRepo(io: Io): Repo {
  const r = Repo.find(io.ctx.fs, io.ctx.cwd, clockOf(io.ctx));
  if (!r) throw new GitError('fatal: not a git repository (or any of the parent directories): .git');
  r.homeDir = () => io.ctx.env.HOME ?? io.ctx.user.home;
  return r;
}

/** A Repo object for config outside any repository (git config --global). */
function homeRepo(io: Io): Repo {
  const r = Repo.find(io.ctx.fs, io.ctx.cwd, clockOf(io.ctx)) ?? new Repo(io.ctx.fs, io.ctx.cwd, '/nonexistent/.git', false, clockOf(io.ctx));
  r.homeDir = () => io.ctx.env.HOME ?? io.ctx.user.home;
  return r;
}

function relToRepo(repo: Repo, ctx: CmdContext, p: string): string {
  const abs = ctx.fs.resolve(p);
  if (abs === repo.root) return '';
  if (!abs.startsWith(repo.root + '/')) throw new GitError(`fatal: ${p}: '${p}' is outside repository at '${repo.root}'`);
  return abs.slice(repo.root.length + 1);
}

function decorations(repo: Repo): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (oid: string, s: string) => m.set(oid, [...(m.get(oid) ?? []), s]);
  const head = repo.headRef();
  const cur = repo.currentBranch();
  if (head.oid && !cur) add(head.oid, 'HEAD');
  for (const [b, oid] of repo.branches()) add(oid, b === cur ? `HEAD -> ${b}` : b);
  for (const [b, oid] of repo.remoteBranches()) if (!b.endsWith('/HEAD')) add(oid, b);
  for (const [t, oid] of repo.tags()) add(repo.peel(oid), `tag: ${t}`);
  for (const [k, v] of m) {
    v.sort((a, b) => (a.startsWith('HEAD') ? -1 : b.startsWith('HEAD') ? 1 : a.startsWith('tag:') ? 1 : b.startsWith('tag:') ? -1 : 0));
    m.set(k, v);
  }
  return m;
}

function decoText(io: Io, d: string[] | undefined): string {
  if (!d?.length) return '';
  const parts = d.map((x) =>
    x.startsWith('HEAD -> ') ? `${io.c.boldCyan('HEAD ->')} ${io.c.boldGreen(x.slice(8))}` : x === 'HEAD' ? io.c.boldCyan('HEAD') : x.startsWith('tag: ') ? io.c.yellow(x) : x.includes('/') ? io.c.boldRed(x) : io.c.boldGreen(x),
  );
  return ` ${io.c.yellow('(')}${parts.join(io.c.yellow(', '))}${io.c.yellow(')')}`;
}

// ── tracking info for status ──

function upstreamOf(repo: Repo, branch: string): { remote: string; ref: string; oid: string | null } | null {
  const remote = repo.config(`branch.${branch}.remote`);
  const merge = repo.config(`branch.${branch}.merge`);
  if (!remote || !merge) return null;
  const name = merge.replace(/^refs\/heads\//, '');
  return { remote, ref: `${remote}/${name}`, oid: repo.readRef(`refs/remotes/${remote}/${name}`) };
}

function aheadBehind(repo: Repo, a: string, b: string): [number, number] {
  const A = repo.ancestors(a);
  const B = repo.ancestors(b);
  let ahead = 0;
  let behind = 0;
  for (const x of A) if (!B.has(x)) ahead++;
  for (const x of B) if (!A.has(x)) behind++;
  return [ahead, behind];
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ── subcommands ──

type Sub = (io: Io, args: string[]) => Promise<number> | number;

const subs: Record<string, Sub> = {
  init(io, args) {
    let branch: string | undefined;
    let bare = false;
    let dir = '.';
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-b' || a === '--initial-branch') branch = args[++i];
      else if (a.startsWith('--initial-branch=')) branch = a.slice(17);
      else if (a === '--bare') bare = true;
      else if (a === '-q' || a === '--quiet') continue;
      else if (a.startsWith('-')) return usage(io, 'init', `unknown option '${a}'`);
      else dir = a;
    }
    const cfg = homeRepo(io);
    const configured = cfg.config('init.defaultBranch');
    const name = branch ?? configured ?? 'master';
    if (!branch && !configured) {
      io.err(
        [
          "hint: Using 'master' as the name for the initial branch. This default branch name",
          'hint: will change to "main" in Git 3.0. To configure the initial branch name',
          'hint: to use in all of your new repositories, which will suppress this warning,',
          'hint: call:',
          'hint:',
          'hint: \tgit config --global init.defaultBranch <name>',
          'hint:',
          "hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and",
          "hint: 'development'. The just-created branch can be renamed via this command:",
          'hint:',
          'hint: \tgit branch -m <name>',
          '',
        ].join('\n'),
      );
    }
    const { repo, reinit } = Repo.init(io.ctx.fs, dir, { bare, branch: name, clock: clockOf(io.ctx) });
    io.out(`${reinit ? 'Reinitialized existing' : 'Initialized empty'} Git repository in ${repo.gitdir}/\n`);
    return 0;
  },

  config(io, args) {
    let global = false;
    let list = false;
    let unset = false;
    const rest: string[] = [];
    for (const a of args) {
      if (a === '--global') global = true;
      else if (a === '--local') global = false;
      else if (a === '-l' || a === '--list') list = true;
      else if (a === '--unset') unset = true;
      else if (a === '--get') continue;
      else rest.push(a);
    }
    const repo = homeRepo(io);
    const home = io.ctx.env.HOME ?? io.ctx.user.home;
    if (list) {
      const files = global ? [`${home}/.gitconfig`] : [`${home}/.gitconfig`, repo.p('config')];
      for (const f of files) for (const [k, v] of repo.readConfig(f)) io.out(`${k}=${v}\n`);
      return 0;
    }
    if (!rest.length) return usage(io, 'config', 'no action specified');
    const key = rest[0];
    if (!/^[\w-]+(\.[^\s]+)?\.[\w-]+$/.test(key)) {
      io.err(`error: key does not contain a section: ${key}\n`);
      return 2;
    }
    if (!global && !Repo.find(io.ctx.fs, io.ctx.cwd) && (rest.length > 1 || unset)) {
      io.err('fatal: not in a git directory\n');
      return 128;
    }
    if (unset) {
      repo.setConfig(key, null, global);
      return 0;
    }
    if (rest.length === 1) {
      const v = global ? repo.readConfig(`${home}/.gitconfig`).get(key.toLowerCase()) : repo.config(key);
      if (v === undefined) return 1;
      io.out(v + '\n');
      return 0;
    }
    repo.setConfig(key, rest.slice(1).join(' '), global);
    return 0;
  },

  status(io, args) {
    const repo = openRepo(io);
    const s = repo.status();
    const shortFmt = args.includes('-s') || args.includes('--short');
    if (shortFmt) {
      const lines = new Map<string, [string, string]>();
      const L = (p: string) => lines.get(p) ?? [' ', ' '];
      for (const e of s.staged) lines.set(e.path, [e.kind === 'new' ? 'A' : e.kind === 'deleted' ? 'D' : 'M', L(e.path)[1]]);
      for (const e of s.unstaged) lines.set(e.path, [L(e.path)[0], e.kind === 'deleted' ? 'D' : 'M']);
      for (const p of s.conflicted) lines.set(p, ['U', 'U']);
      const sorted = [...lines.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      for (const [p, [x, y]] of sorted) io.out(`${x === 'U' ? io.c.red(x + y) : io.c.green(x) + io.c.red(y)} ${p}\n`);
      for (const p of s.untracked) io.out(`${io.c.red('??')} ${p}\n`);
      return 0;
    }
    const branch = repo.currentBranch();
    const head = repo.headOid();
    io.out(branch ? `On branch ${branch}\n` : `HEAD detached at ${short(head)}\n`);
    if (branch && head) {
      const up = upstreamOf(repo, branch);
      if (up?.oid) {
        const [ahead, behind] = aheadBehind(repo, head, up.oid);
        if (!ahead && !behind) io.out(`Your branch is up to date with '${up.ref}'.\n`);
        else if (ahead && !behind) io.out(`Your branch is ahead of '${up.ref}' by ${plural(ahead, 'commit')}.\n  (use "git push" to publish your local commits)\n`);
        else if (!ahead && behind) io.out(`Your branch is behind '${up.ref}' by ${plural(behind, 'commit')}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)\n`);
        else io.out(`Your branch and '${up.ref}' have diverged,\nand have ${ahead} and ${behind} different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)\n`);
      } else if (up) io.out(`Your branch is based on '${up.ref}', but the upstream is gone.\n  (use "git branch --unset-upstream" to fixup)\n`);
    }
    const merging = io.ctx.fs.exists(repo.p('MERGE_HEAD'));
    if (!head) io.out('\nNo commits yet\n');
    if (merging) {
      if (s.conflicted.length) io.out('\nYou have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)\n');
      else io.out('\nAll conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)\n');
    }
    const label = (k: string) => (k === 'new' ? 'new file:   ' : k === 'deleted' ? 'deleted:    ' : 'modified:   ');
    if (s.staged.length) {
      io.out(`\nChanges to be committed:\n  (use "${head ? 'git restore --staged <file>...' : 'git rm --cached <file>...'}" to unstage)\n`);
      for (const e of s.staged) io.out(`\t${io.c.green(label(e.kind) + e.path)}\n`);
    }
    if (s.conflicted.length) {
      io.out('\nUnmerged paths:\n  (use "git add <file>..." to mark resolution)\n');
      for (const p of s.conflicted) io.out(`\t${io.c.red('both modified:   ' + p)}\n`);
    }
    if (s.unstaged.length) {
      io.out('\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n');
      for (const e of s.unstaged) io.out(`\t${io.c.red(label(e.kind) + e.path)}\n`);
    }
    if (s.untracked.length) {
      io.out('\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n');
      for (const p of s.untracked) io.out(`\t${io.c.red(p)}\n`);
    }
    if (!s.staged.length && !s.unstaged.length && !s.conflicted.length) {
      if (s.untracked.length) io.out(`\nnothing added to commit but untracked files present (use "git add" to track)\n`);
      else if (!merging) io.out(head ? 'nothing to commit, working tree clean\n' : '\nnothing to commit (create/copy files and use "git add" to track)\n');
    } else if (!s.staged.length && s.unstaged.length) io.out('\nno changes added to commit (use "git add" and/or "git commit -a")\n');
    return 0;
  },

  add(io, args) {
    const repo = openRepo(io);
    const force = args.includes('-f') || args.includes('--force');
    const all = args.includes('-A') || args.includes('--all');
    let paths = args.filter((a) => !a.startsWith('-'));
    if (all && !paths.length) paths = ['.'];
    if (!paths.length) {
      io.err('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?\nhint: Disable this message with "git config set advice.addEmptyPathspec false"\n');
      return 0;
    }
    const idx = repo.readIndex();
    const wt = repo.worktree();
    const rules = repo.ignoreRules();
    const ignoredHits: string[] = [];
    for (const p of paths) {
      const rel = relToRepo(repo, io.ctx, p);
      const inside = (x: string) => !rel || x === rel || x.startsWith(rel + '/');
      const files = [...wt.keys()].filter(inside);
      const tracked = [...idx.keys()].filter(inside);
      if (!files.length && !tracked.length) {
        if (rel && repo.ignored(rel, false, rules)) {
          ignoredHits.push(rel);
          continue;
        }
        io.err(`fatal: pathspec '${p}' did not match any files\n`);
        return 128;
      }
      for (const f of files) {
        const isTracked = idx.has(f);
        if (!isTracked && !force && repo.ignored(f, false, rules)) {
          if (f === rel) ignoredHits.push(f);
          continue;
        }
        const w = wt.get(f)!;
        idx.set(f, { oid: repo.writeObject('blob', w.text), mode: w.mode });
      }
      for (const f of tracked) if (!wt.has(f)) idx.delete(f);
    }
    repo.writeIndex(idx);
    if (ignoredHits.length) {
      io.err(`The following paths are ignored by one of your .gitignore files:\n${ignoredHits.join('\n')}\nhint: Use -f if you really want to add them.\nhint: Disable this message with "git config set advice.addIgnoredFile false"\n`);
      return 1;
    }
    return 0;
  },

  rm(io, args) {
    const repo = openRepo(io);
    const cached = args.includes('--cached');
    const recursive = args.includes('-r');
    const paths = args.filter((a) => !a.startsWith('-'));
    if (!paths.length) return usage(io, 'rm', 'No pathspec was given. Which files should I remove?');
    const idx = repo.readIndex();
    for (const p of paths) {
      const rel = relToRepo(repo, io.ctx, p);
      const hits = [...idx.keys()].filter((x) => x === rel || x.startsWith(rel + '/'));
      if (!hits.length) {
        io.err(`fatal: pathspec '${p}' did not match any files\n`);
        return 128;
      }
      if (hits.some((x) => x !== rel) && !recursive) {
        io.err(`fatal: not removing '${p}' recursively without -r\n`);
        return 128;
      }
      for (const h of hits) {
        idx.delete(h);
        io.out(`rm '${h}'\n`);
        if (!cached) {
          const abs = `${repo.root}/${h}`;
          if (io.ctx.fs.exists(abs)) io.ctx.fs.unlink(abs);
        }
      }
    }
    repo.writeIndex(idx);
    return 0;
  },

  restore(io, args) {
    const repo = openRepo(io);
    const staged = args.includes('--staged') || args.includes('-S');
    const paths = args.filter((a) => !a.startsWith('-'));
    if (!paths.length) {
      io.err('fatal: you must specify path(s) to restore\n');
      return 128;
    }
    const idx = repo.readIndex();
    const headFiles = repo.commitFiles(repo.headOid());
    for (const p of paths) {
      const rel = relToRepo(repo, io.ctx, p);
      const match = (x: string) => !rel || x === rel || x.startsWith(rel + '/');
      if (staged) {
        const keys = new Set([...idx.keys(), ...headFiles.keys()].filter(match));
        if (!keys.size) {
          io.err(`error: pathspec '${p}' did not match any file(s) known to git\n`);
          return 1;
        }
        for (const k of keys) {
          const h = headFiles.get(k);
          if (h) idx.set(k, { oid: h.oid, mode: h.mode });
          else idx.delete(k);
        }
      } else {
        const keys = [...idx.keys()].filter(match);
        if (!keys.length) {
          io.err(`error: pathspec '${p}' did not match any file(s) known to git\n`);
          return 1;
        }
        for (const k of keys) {
          const e = idx.get(k)!;
          if (e.conflict) {
            io.err(`error: path '${k}' is unmerged\n`);
            return 1;
          }
          io.ctx.fs.writeFile(`${repo.root}/${k}`, repo.readBlob(e.oid));
        }
      }
    }
    repo.writeIndex(idx);
    return 0;
  },

  commit(io, args) {
    const repo = openRepo(io);
    const msgs: string[] = [];
    let all = false;
    let allowEmpty = false;
    let amend = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-m' || a === '--message') {
        if (args[i + 1] === undefined) return usage(io, 'commit', "switch `m' requires a value");
        msgs.push(args[++i]);
      } else if (a.startsWith('--message=')) msgs.push(a.slice(10));
      else if (/^-[a]*m.+/.test(a) && !a.startsWith('--')) msgs.push(a.slice(a.indexOf('m') + 1));
      else if (a === '-a' || a === '--all') all = true;
      else if (a === '-am') {
        all = true;
        msgs.push(args[++i] ?? '');
      } else if (a === '--allow-empty') allowEmpty = true;
      else if (a === '--amend') amend = true;
      else if (a === '-q' || a === '--quiet') continue;
      else return usage(io, 'commit', `unknown option '${a.replace(/^-+/, '')}'`);
    }
    const idx = repo.readIndex();
    if ([...idx.values()].some((e) => e.conflict)) {
      io.err("error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.\n");
      return 128;
    }
    if (all) {
      const wt = repo.worktree();
      for (const [p] of idx) {
        const w = wt.get(p);
        if (!w) idx.delete(p);
        else idx.set(p, { oid: repo.writeObject('blob', w.text), mode: w.mode });
      }
      repo.writeIndex(idx);
    }
    const head = repo.headOid();
    const mergeHead = io.ctx.fs.exists(repo.p('MERGE_HEAD')) ? io.ctx.fs.readFile(repo.p('MERGE_HEAD')).trim() : null;
    let message = msgs.join('\n\n');
    if (!msgs.length && mergeHead && io.ctx.fs.exists(repo.p('MERGE_MSG'))) message = io.ctx.fs.readFile(repo.p('MERGE_MSG')).trim();
    if (!message && amend && head) message = repo.readCommit(head).message;
    if (!message.trim()) {
      if (!msgs.length) io.err('hint: This simulator has no commit message editor; pass the message with -m "…".\n');
      io.err('Aborting commit due to empty commit message.\n');
      return 1;
    }
    const tree = repo.buildTree(repo.indexAsTree(idx));
    const base = amend && head ? repo.readCommit(head).parents : head ? [head] : [];
    const parentTree = base[0] ? repo.readCommit(base[0]).tree : head && !amend ? repo.readCommit(head).tree : null;
    if (!mergeHead && !allowEmpty && !amend && head && repo.readCommit(head).tree === tree) {
      return subs.status(io, []) && 1;
    }
    if (!mergeHead && !allowEmpty && !head && idx.size === 0) {
      io.out(`On branch ${repo.currentBranch()}\n\nInitial commit\n\nnothing to commit (create/copy files and use "git add" to track)\n`);
      return 1;
    }
    const person = repo.person();
    const parents = mergeHead ? [head!, mergeHead] : base;
    const oid = repo.writeCommit({ tree, parents, author: amend && head ? repo.readCommit(head).author : person, committer: person, message });
    const first = message.split('\n')[0];
    repo.advanceHead(oid, `${mergeHead ? 'commit (merge)' : amend ? 'commit (amend)' : head ? 'commit' : 'commit (initial)'}: ${first}`);
    for (const f of ['MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE']) if (io.ctx.fs.exists(repo.p(f))) io.ctx.fs.unlink(repo.p(f));
    const branch = repo.currentBranch() ?? 'detached HEAD';
    io.out(`[${branch}${!head ? ' (root-commit)' : ''} ${short(oid)}] ${first}\n`);
    printStat(io, repo, parentTree ? repo.flatTree(parentTree) : new Map(), repo.flatTree(tree), true);
    return 0;
  },

  log(io, args) {
    const repo = openRepo(io);
    let oneline = false;
    let graph = false;
    let all = false;
    let limit = Infinity;
    let author: string | null = null;
    const revs: string[] = [];
    let paths: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--oneline') oneline = true;
      else if (a === '--graph') graph = true;
      else if (a === '--all') all = true;
      else if (a === '--decorate' || a === '--no-decorate') continue;
      else if (a === '-n' || a === '--max-count') limit = Number(args[++i]);
      else if (/^-\d+$/.test(a)) limit = Number(a.slice(1));
      else if (a.startsWith('--max-count=')) limit = Number(a.slice(12));
      else if (a.startsWith('--author=')) author = a.slice(9);
      else if (a === '--') {
        paths = args.slice(i + 1);
        break;
      } else if (a.startsWith('-')) return usage(io, 'log', `unrecognized argument: ${a}`);
      else revs.push(a);
    }
    // Arguments that are not revisions but files are paths (git log index.html).
    for (const r of [...revs]) {
      let ok = false;
      try {
        ok = !!repo.resolve(r);
      } catch {
        ok = false;
      }
      if (!ok) {
        if (io.ctx.fs.exists(io.ctx.fs.resolve(r)) || repo.commitFiles(repo.headOid()).has(relToRepo(repo, io.ctx, r))) {
          revs.splice(revs.indexOf(r), 1);
          paths.push(r);
        } else {
          io.err(`fatal: ambiguous argument '${r}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'\n`);
          return 128;
        }
      }
    }
    const starts = all ? [...new Set([...repo.branches().values(), ...repo.remoteBranches().values(), ...[...repo.tags().values()].map((t) => repo.peel(t)), repo.headOid() ?? ''])].filter(Boolean) : revs.length ? revs.map((r) => repo.resolve(r)!) : [repo.headOid()].filter(Boolean) as string[];
    if (!starts.length) {
      const b = repo.currentBranch() ?? 'HEAD';
      io.err(`fatal: your current branch '${b}' does not have any commits yet\n`);
      return 128;
    }
    let commits = topo(repo, repo.walk(starts));
    const relPaths = paths.map((p) => relToRepo(repo, io.ctx, p));
    if (relPaths.length) {
      commits = commits.filter((c) => {
        const now = repo.flatTree(c.tree);
        const before = c.parents[0] ? repo.commitFiles(c.parents[0]) : new Map();
        return relPaths.some((p) => [...new Set([...now.keys(), ...before.keys()])].some((f) => (f === p || f.startsWith(p + '/')) && now.get(f)?.oid !== before.get(f)?.oid));
      });
    }
    if (author) commits = commits.filter((c) => `${c.author.name} <${c.author.email}>`.toLowerCase().includes(author!.toLowerCase()));
    commits = commits.slice(0, limit);
    const deco = decorations(repo);
    const rows = graph && !relPaths.length && !author ? graphRows(commits) : commits.map((c) => ({ commit: c as Commit | null, prefix: '', cont: '' }));
    for (const row of rows) {
      if (!row.commit) {
        io.out(row.prefix.replace(/\s+$/, '') + '\n');
        continue;
      }
      const c = row.commit;
      if (oneline) io.out(`${row.prefix}${io.c.yellow(short(c.oid))}${decoText(io, deco.get(c.oid))} ${c.message.split('\n')[0]}\n`);
      else {
        const p = row.prefix;
        const q = row.cont;
        io.out(`${p}${io.c.yellow('commit ' + c.oid)}${decoText(io, deco.get(c.oid))}\n`);
        if (c.parents.length > 1) io.out(`${q}Merge: ${c.parents.map(short).join(' ')}\n`);
        io.out(`${q}Author: ${c.author.name} <${c.author.email}>\n${q}Date:   ${gitDate(c.author.time)}\n${q}\n`);
        for (const l of c.message.split('\n')) io.out(`${q}    ${l}\n`);
        io.out(`${q}\n`);
      }
    }
    return 0;
  },

  diff(io, args) {
    const repo = openRepo(io);
    const staged = args.includes('--staged') || args.includes('--cached');
    const stat = args.includes('--stat');
    const nameOnly = args.includes('--name-only');
    const rest = args.filter((a) => !a.startsWith('-'));
    const revs: string[] = [];
    const paths: string[] = [];
    for (const r of rest) {
      if (r.includes('..')) revs.push(...r.split('..'));
      else if (!paths.length && repo.resolve(r)) revs.push(r);
      else paths.push(r);
    }
    const wtTree = (): Map<string, { text: string }> => {
      const m = new Map<string, { text: string }>();
      const idx = repo.readIndex();
      const wt = repo.worktree();
      for (const [p] of idx) {
        const w = wt.get(p);
        if (w) m.set(p, { text: w.text });
      }
      return m;
    };
    const fromTree = (t: FlatTree) => new Map([...t].map(([p, e]) => [p, { text: repo.readBlob(e.oid) }]));
    let a: Map<string, { text: string }>;
    let b: Map<string, { text: string }>;
    if (revs.length >= 2) {
      a = fromTree(repo.commitFiles(resolveOrThrow(repo, revs[0])));
      b = fromTree(repo.commitFiles(resolveOrThrow(repo, revs[1])));
    } else if (revs.length === 1) {
      a = fromTree(repo.commitFiles(resolveOrThrow(repo, revs[0])));
      b = staged ? fromTree(repo.indexAsTree()) : wtTree();
    } else if (staged) {
      a = fromTree(repo.commitFiles(repo.headOid()));
      b = fromTree(repo.indexAsTree());
    } else {
      const idx = repo.readIndex();
      a = new Map([...idx].filter(([, e]) => !e.conflict).map(([p, e]) => [p, { text: repo.readBlob(e.oid) }]));
      b = wtTree();
      // Conflicted files are shown as they are in the working tree.
      for (const [p, e] of idx) if (e.conflict) {
        a.set(p, { text: e.conflict.ours ? repo.readBlob(e.conflict.ours) : '' });
      }
    }
    const rel = paths.map((p) => relToRepo(repo, io.ctx, p));
    const keys = [...new Set([...a.keys(), ...b.keys()])].sort().filter((k) => !rel.length || rel.some((r) => k === r || k.startsWith(r + '/')));
    const changed = keys.filter((k) => a.get(k)?.text !== b.get(k)?.text);
    if (nameOnly) {
      for (const k of changed) io.out(k + '\n');
      return 0;
    }
    if (stat) {
      printStatMaps(io, a, b, changed);
      return 0;
    }
    for (const k of changed) io.out(fileDiff(io, k, a.get(k)?.text, b.get(k)?.text));
    return 0;
  },

  show(io, args) {
    const repo = openRepo(io);
    const rev = args.find((a) => !a.startsWith('-')) ?? 'HEAD';
    if (rev.includes(':')) {
      const [r, path] = rev.split(':');
      const files = repo.commitFiles(resolveOrThrow(repo, r || 'HEAD'));
      const e = files.get(path);
      if (!e) {
        io.err(`fatal: path '${path}' does not exist in '${r || 'HEAD'}'\n`);
        return 128;
      }
      io.out(repo.readBlob(e.oid));
      return 0;
    }
    const oid = resolveOrThrow(repo, rev);
    const c = repo.readCommit(oid);
    const deco = decorations(repo);
    io.out(`${io.c.yellow('commit ' + c.oid)}${decoText(io, deco.get(c.oid))}\n`);
    if (c.parents.length > 1) io.out(`Merge: ${c.parents.map(short).join(' ')}\n`);
    io.out(`Author: ${c.author.name} <${c.author.email}>\nDate:   ${gitDate(c.author.time)}\n\n${c.message.split('\n').map((l) => '    ' + l).join('\n')}\n\n`);
    if (c.parents.length > 1) return 0;
    const before = repo.commitFiles(c.parents[0] ?? null);
    const after = repo.flatTree(c.tree);
    for (const k of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      if (before.get(k)?.oid === after.get(k)?.oid) continue;
      io.out(fileDiff(io, k, before.get(k) ? repo.readBlob(before.get(k)!.oid) : undefined, after.get(k) ? repo.readBlob(after.get(k)!.oid) : undefined));
    }
    return 0;
  },

  branch(io, args) {
    const repo = openRepo(io);
    const flags = new Set(args.filter((a) => a.startsWith('-')));
    const rest = args.filter((a) => !a.startsWith('-'));
    const cur = repo.currentBranch();
    const del = flags.has('-d') || flags.has('--delete') ? 'd' : flags.has('-D') ? 'D' : null;
    if (del) {
      if (!rest.length) {
        io.err('fatal: branch name required\n');
        return 128;
      }
      for (const name of rest) {
        const oid = repo.readRef(`refs/heads/${name}`);
        if (!oid) {
          io.err(`error: branch '${name}' not found\n`);
          return 1;
        }
        if (name === cur) {
          io.err(`error: cannot delete branch '${name}' used by worktree at '${repo.root}'\n`);
          return 1;
        }
        const head = repo.headOid();
        const up = upstreamOf(repo, name);
        const mergedInto = up?.oid ?? head;
        if (del === 'd' && mergedInto && !repo.isAncestor(oid, mergedInto)) {
          io.err(`error: the branch '${name}' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D ${name}'\nhint: Disable this message with "git config set advice.forceDeleteBranch false"\n`);
          return 1;
        }
        repo.deleteRef(`refs/heads/${name}`);
        repo.setConfig(`branch.${name}.remote`, null);
        repo.setConfig(`branch.${name}.merge`, null);
        io.out(`Deleted branch ${name} (was ${short(oid)}).\n`);
      }
      return 0;
    }
    if (flags.has('-m') || flags.has('-M')) {
      const [from, to] = rest.length === 1 ? [cur!, rest[0]] : rest;
      const oid = repo.readRef(`refs/heads/${from}`);
      if (!oid && from === cur) {
        // Renaming the unborn branch only changes HEAD.
        repo.setHead({ branch: to }, `Branch: renamed refs/heads/${from} to refs/heads/${to}`);
        return 0;
      }
      if (!oid) {
        io.err(`error: refname refs/heads/${from} not found\nfatal: Branch rename failed\n`);
        return 128;
      }
      repo.writeRef(`refs/heads/${to}`, oid, `Branch: renamed refs/heads/${from} to refs/heads/${to}`);
      repo.deleteRef(`refs/heads/${from}`);
      if (from === cur) io.ctx.fs.writeFile(repo.p('HEAD'), `ref: refs/heads/${to}\n`);
      return 0;
    }
    if (rest.length && !flags.has('--merged') && !flags.has('--no-merged')) {
      const name = rest[0];
      if (!validBranch(name)) {
        io.err(`fatal: '${name}' is not a valid branch name\n`);
        return 128;
      }
      if (repo.readRef(`refs/heads/${name}`)) {
        io.err(`fatal: a branch named '${name}' already exists\n`);
        return 128;
      }
      const start = rest[1] ? repo.resolve(rest[1]) : repo.headOid();
      if (!start) {
        io.err(rest[1] ? `fatal: not a valid object name: '${rest[1]}'\n` : `fatal: not a valid object name: '${cur ?? 'HEAD'}'\n`);
        return 128;
      }
      repo.writeRef(`refs/heads/${name}`, start, `branch: Created from ${rest[1] ?? 'HEAD'}`);
      return 0;
    }
    const verbose = flags.has('-v') || flags.has('-vv');
    let list = [...repo.branches()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (flags.has('--merged') || flags.has('--no-merged')) {
      const target = rest[0] ? resolveOrThrow(repo, rest[0]) : repo.headOid()!;
      const anc = repo.ancestors(target);
      list = list.filter(([, oid]) => anc.has(oid) === flags.has('--merged'));
    }
    if (!cur && repo.headOid()) io.out(`* ${io.c.green(`(HEAD detached at ${short(repo.headOid())})`)}\n`);
    for (const [name, oid] of list) {
      const mark = name === cur ? '* ' : '  ';
      const shown = name === cur ? io.c.green(name) : name;
      io.out(verbose ? `${mark}${shown.padEnd(name === cur ? shown.length + Math.max(0, 16 - name.length) : 16)} ${short(oid)} ${repo.readCommit(oid).message.split('\n')[0]}\n` : `${mark}${shown}\n`);
    }
    if (flags.has('-a') || flags.has('--all') || flags.has('-r')) {
      for (const [name] of [...repo.remoteBranches()].sort()) io.out(`  ${io.c.red('remotes/' + name)}\n`);
    }
    return 0;
  },

  switch(io, args) {
    const repo = openRepo(io);
    let create: string | null = null;
    let target: string | null = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-c' || a === '--create' || a === '-C') create = args[++i] ?? null;
      else if (a === '-' ) target = '@{-1}';
      else if (a.startsWith('-')) return usage(io, 'switch', `unknown option '${a}'`);
      else target = a;
    }
    if (create) return switchTo(io, repo, create, { create: true, start: target ?? undefined });
    if (!target) {
      io.err('fatal: missing branch or commit argument\n');
      return 128;
    }
    if (!repo.readRef(`refs/heads/${target}`)) {
      if (repo.readRef(`refs/remotes/origin/${target}`)) return switchTo(io, repo, target, { create: true, start: `origin/${target}`, track: true });
      if (repo.resolve(target)) {
        io.err(`fatal: a branch is expected, got commit '${target}'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.\n`);
        return 128;
      }
      io.err(`fatal: invalid reference: ${target}\n`);
      return 128;
    }
    return switchTo(io, repo, target, {});
  },

  checkout(io, args) {
    const repo = openRepo(io);
    const dd = args.indexOf('--');
    if (dd >= 0) return subs.restore(io, args.slice(dd + 1));
    let create: string | null = null;
    let target: string | null = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-b' || a === '-B') create = args[++i] ?? null;
      else if (a.startsWith('-')) return usage(io, 'checkout', `unknown option '${a}'`);
      else target = a;
    }
    if (create) return switchTo(io, repo, create, { create: true, start: target ?? undefined });
    if (!target) return 0;
    if (repo.readRef(`refs/heads/${target}`)) return switchTo(io, repo, target, {});
    if (repo.readRef(`refs/remotes/origin/${target}`)) return switchTo(io, repo, target, { create: true, start: `origin/${target}`, track: true });
    const oid = repo.resolve(target);
    if (oid && repo.readObject(oid)?.type === 'commit') return detachTo(io, repo, oid, target);
    // A path: restore it from the index.
    if (repo.readIndex().has(relToRepo(repo, io.ctx, target))) return subs.restore(io, [target]);
    io.err(`error: pathspec '${target}' did not match any file(s) known to git\n`);
    return 1;
  },

  merge(io, args) {
    const repo = openRepo(io);
    if (args.includes('--abort')) {
      if (!io.ctx.fs.exists(repo.p('MERGE_HEAD'))) {
        io.err('fatal: There is no merge to abort (MERGE_HEAD missing).\n');
        return 128;
      }
      repo.checkoutTree(repo.commitFiles(repo.headOid()), { from: unionTree(repo) });
      for (const f of ['MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE']) if (io.ctx.fs.exists(repo.p(f))) io.ctx.fs.unlink(repo.p(f));
      return 0;
    }
    if (io.ctx.fs.exists(repo.p('MERGE_HEAD'))) {
      io.err('error: Merging is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use \'git add/rm <file>\'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.\n');
      return 128;
    }
    const noFf = args.includes('--no-ff');
    const ffOnly = args.includes('--ff-only');
    let message: string | null = null;
    const mi = args.indexOf('-m');
    if (mi >= 0) message = args[mi + 1] ?? null;
    const name = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-m')[0];
    if (!name) {
      io.err('fatal: No remote for the current branch.\n');
      return 128;
    }
    const theirs = repo.resolve(name);
    if (!theirs) {
      io.err(`merge: ${name} - not something we can merge\n`);
      return 1;
    }
    return mergeInto(io, repo, theirs, name, { noFf, ffOnly, message });
  },

  remote(io, args) {
    const repo = openRepo(io);
    const sub = args[0];
    if (!sub || sub === '-v' || sub === '--verbose') {
      const cfg = repo.readConfig(repo.p('config'));
      const names = [...new Set([...cfg.keys()].filter((k) => k.startsWith('remote.') && k.endsWith('.url')).map((k) => k.slice(7, -4)))];
      for (const n of names) {
        const url = cfg.get(`remote.${n}.url`);
        io.out(sub ? `${n}\t${url} (fetch)\n${n}\t${url} (push)\n` : `${n}\n`);
      }
      return 0;
    }
    if (sub === 'add') {
      const [name, url] = args.slice(1);
      if (!name || !url) return usage(io, 'remote', 'usage: git remote add [<options>] <name> <url>');
      if (repo.config(`remote.${name}.url`)) {
        io.err(`error: remote ${name} already exists.\n`);
        return 3;
      }
      repo.setConfig(`remote.${name}.url`, url);
      repo.setConfig(`remote.${name}.fetch`, `+refs/heads/*:refs/remotes/${name}/*`);
      return 0;
    }
    if (sub === 'remove' || sub === 'rm') {
      const name = args[1];
      if (!repo.config(`remote.${name}.url`)) {
        io.err(`error: No such remote: '${name}'\n`);
        return 2;
      }
      repo.setConfig(`remote.${name}.url`, null);
      repo.setConfig(`remote.${name}.fetch`, null);
      return 0;
    }
    if (sub === 'get-url') {
      const url = repo.config(`remote.${args[1]}.url`);
      if (!url) {
        io.err(`error: No such remote '${args[1]}'\n`);
        return 2;
      }
      io.out(url + '\n');
      return 0;
    }
    if (sub === 'set-url') {
      repo.setConfig(`remote.${args[1]}.url`, args[2]);
      return 0;
    }
    return usage(io, 'remote', `unknown subcommand: \`${sub}'`);
  },

  async push(io, args) {
    const repo = openRepo(io);
    const setUp = args.includes('-u') || args.includes('--set-upstream');
    const force = args.includes('-f') || args.includes('--force');
    const tagsAll = args.includes('--tags');
    const rest = args.filter((a) => !a.startsWith('-'));
    const branch = repo.currentBranch();
    let remote = rest[0];
    let refspecs = rest.slice(1);
    if (!remote) {
      if (!branch) {
        io.err('fatal: You are not currently on a branch.\n');
        return 128;
      }
      const up = upstreamOf(repo, branch);
      if (!up) {
        const remotes = [...repo.readConfig(repo.p('config')).keys()].filter((k) => k.startsWith('remote.') && k.endsWith('.url'));
        if (!remotes.length) {
          io.err("fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n\n");
          return 128;
        }
        io.err(`fatal: The current branch ${branch} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin ${branch}\n\nTo have this happen automatically for branches without a tracking\nupstream, see 'push.autoSetupRemote' in 'git help config'.\n\n`);
        return 128;
      }
      remote = up.remote;
      refspecs = [`${branch}:${up.ref.slice(up.remote.length + 1)}`];
    }
    const url = repo.config(`remote.${remote}.url`) ?? (projectOfUrl(remote) ? remote : undefined);
    if (!url) {
      io.err(`fatal: '${remote}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
      return 128;
    }
    const project = projectOfUrl(url);
    if (!project || !ForgeProject.exists(io.ctx.machine.rootFs, project)) {
      io.err(`remote: The project you were looking for could not be found or you don't have permission to view it.\nfatal: repository '${url}' not found\n`);
      return 128;
    }
    if (!refspecs.length && !tagsAll) {
      if (!branch) {
        io.err('fatal: You are not currently on a branch.\n');
        return 128;
      }
      refspecs = [branch];
    }
    if (tagsAll) for (const t of repo.tags().keys()) refspecs.push(`refs/tags/${t}`);
    const forge = new ForgeProject(io.ctx.machine.rootFs, project, clockOf(io.ctx));
    const state = forge.state();
    const updates: { src: string; dst: string; oid: string; old: string | null; tag: boolean; line: string; ok: boolean }[] = [];
    for (const spec of refspecs) {
      const [srcName, dstName0] = spec.includes(':') ? spec.split(':') : [spec, spec];
      const isTag = srcName.startsWith('refs/tags/') || (!!repo.readRef(`refs/tags/${srcName}`) && !repo.readRef(`refs/heads/${srcName}`));
      const tagName = srcName.replace(/^refs\/tags\//, '');
      const oid = isTag ? repo.readRef(`refs/tags/${tagName}`) : repo.resolve(srcName);
      if (!oid) {
        io.err(`error: src refspec ${srcName} does not match any\nerror: failed to push some refs to '${url}'\n`);
        return 1;
      }
      const dstName = (dstName0 || srcName).replace(/^refs\/(heads|tags)\//, '');
      const dst = isTag ? `refs/tags/${dstName}` : `refs/heads/${dstName}`;
      const old = forge.repo.readRef(dst);
      const short1 = isTag ? tagName : srcName.replace(/^refs\/heads\//, '');
      if (old === oid) {
        updates.push({ src: short1, dst: dstName, oid, old, tag: isTag, line: '', ok: true });
        continue;
      }
      if (old && !isTag) {
        const known = repo.hasObject(old);
        if (!known || !repo.isAncestor(old, oid)) {
          if (!force) {
            updates.push({ src: short1, dst: dstName, oid, old, tag: false, line: ` ${io.c.red('! [rejected]')}        ${short1} -> ${dstName} (${known ? 'non-fast-forward' : 'fetch first'})`, ok: false });
            continue;
          }
          if (state.protectedBranches.includes(dstName)) {
            io.err(`remote: GitLab: You are not allowed to force push code to a protected branch on this project.\nTo ${url}\n ! [remote rejected] ${short1} -> ${dstName} (pre-receive hook declined)\nerror: failed to push some refs to '${url}'\n`);
            return 1;
          }
        }
      } else if (old && isTag) {
        updates.push({ src: short1, dst: dstName, oid, old, tag: true, line: ` ${io.c.red('! [rejected]')}        ${short1} -> ${dstName} (already exists)`, ok: false });
        continue;
      }
      const forced = !!old && !isTag && !repo.isAncestor(old, oid);
      updates.push({
        src: short1,
        dst: dstName,
        oid,
        old,
        tag: isTag,
        ok: true,
        line: old ? ` ${forced ? '+' : ' '} ${short(old)}${forced ? '...' : '..'}${short(oid)}  ${short1} -> ${dstName}${forced ? ' (forced update)' : ''}` : ` * [new ${isTag ? 'tag' : 'branch'}]      ${short1} -> ${dstName}`,
      });
    }
    const toSend = updates.filter((u) => u.ok && u.line);
    if (!toSend.length && updates.every((u) => u.ok)) {
      io.err('Everything up-to-date\n');
      return 0;
    }
    let count = 0;
    for (const u of toSend) count += copyObjects(repo, forge.repo, u.oid);
    if (toSend.length) {
      io.err(`Enumerating objects: ${count + 2}, done.\nCounting objects: 100% (${count + 2}/${count + 2}), done.\nWriting objects: 100% (${count}/${count}), ${count * 104} bytes | ${count * 104}.00 KiB/s, done.\nTotal ${count} (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)\n`);
    }
    const remoteLines: string[] = [];
    for (const u of toSend) {
      forge.repo.writeRef(u.tag ? `refs/tags/${u.dst}` : `refs/heads/${u.dst}`, u.oid, 'push');
      if (!u.tag) repo.writeRef(`refs/remotes/${remote}/${u.dst}`, u.oid, 'update by push');
      if (!u.tag && !u.old && u.dst !== state.defaultBranch) {
        remoteLines.push('', `To create a merge request for ${u.dst}, visit:`, `  https://forge.edu/${project}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(u.dst)}`, '');
      }
      remoteLines.push(...(await firePush({ machine: io.ctx.machine, forge, ref: u.dst, before: u.old, after: u.oid, kind: u.tag ? 'tag' : 'push', user: io.ctx.user.name })));
    }
    for (const l of remoteLines) io.err(`remote: ${l}\n`);
    io.err(`To ${url}\n`);
    for (const u of updates) if (u.line) io.err(u.line + '\n');
    const rejected = updates.filter((u) => !u.ok);
    if (setUp && branch) {
      for (const u of toSend.filter((x) => !x.tag && x.src === branch)) {
        repo.setConfig(`branch.${branch}.remote`, remote);
        repo.setConfig(`branch.${branch}.merge`, `refs/heads/${u.dst}`);
        io.out(`branch '${branch}' set up to track '${remote}/${u.dst}'.\n`);
      }
    }
    if (rejected.length) {
      io.err(`error: failed to push some refs to '${url}'\n`);
      const fetchFirst = rejected.some((r) => r.line.includes('fetch first'));
      if (rejected.some((r) => r.tag)) io.err("hint: Updates were rejected because the tag already exists in the remote.\n");
      else if (fetchFirst)
        io.err("hint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details.\n");
      else io.err("hint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. If you want to integrate the remote changes,\nhint: use 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details.\n");
      return 1;
    }
    return 0;
  },

  fetch(io, args) {
    const repo = openRepo(io);
    const remote = args.find((a) => !a.startsWith('-')) ?? 'origin';
    return fetchFrom(io, repo, remote, false);
  },

  pull(io, args) {
    const repo = openRepo(io);
    const branch = repo.currentBranch();
    if (!branch) {
      io.err('You are not currently on a branch.\n');
      return 1;
    }
    const rest = args.filter((a) => !a.startsWith('-'));
    const remote = rest[0] ?? upstreamOf(repo, branch)?.remote ?? 'origin';
    const remoteBranch = rest[1] ?? upstreamOf(repo, branch)?.ref.slice(remote.length + 1);
    if (!remoteBranch) {
      io.err(`There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=${remote}/<branch> ${branch}\n\n`);
      return 1;
    }
    const f = fetchFrom(io, repo, remote, true);
    if (f) return f;
    const theirs = repo.readRef(`refs/remotes/${remote}/${remoteBranch}`);
    if (!theirs) {
      io.err(`fatal: couldn't find remote ref ${remoteBranch}\n`);
      return 1;
    }
    const head = repo.headOid();
    const rebase = args.includes('--rebase') || repo.config('pull.rebase') === 'true';
    const mergeOk = args.includes('--no-rebase') || args.includes('--ff') || args.includes('--no-ff') || repo.config('pull.rebase') === 'false' || repo.config('pull.ff');
    if (head && !repo.isAncestor(head, theirs) && !repo.isAncestor(theirs, head)) {
      if (rebase) {
        io.err('error: rebase is not available in this simulator; use `git pull --no-rebase` (merge) instead\n');
        return 1;
      }
      if (!mergeOk) {
        io.err(
          "hint: You have divergent branches and need to specify how to reconcile them.\nhint: You can do so by running one of the following commands sometime before\nhint: your next pull:\nhint:\nhint:   git config pull.rebase false  # merge\nhint:   git config pull.rebase true   # rebase\nhint:   git config pull.ff only       # fast-forward only\nhint:\nhint: You can replace \"git config\" with \"git config --global\" to set a default\nhint: preference for all repositories. You can also pass --rebase, --no-rebase,\nhint: or --ff-only on the command line to override the configured default per\nhint: invocation.\nfatal: Need to specify how to reconcile divergent branches.\n",
        );
        return 128;
      }
    }
    const url = repo.config(`remote.${remote}.url`) ?? remote;
    return mergeInto(io, repo, theirs, `${remoteBranch}`, { pullFrom: url.replace(/\.git$/, '') });
  },

  clone(io, args) {
    const rest = args.filter((a) => !a.startsWith('-'));
    const url = rest[0];
    if (!url) return usage(io, 'clone', 'You must specify a repository to clone.');
    const project = projectOfUrl(url);
    if (!project || !ForgeProject.exists(io.ctx.machine.rootFs, project)) {
      io.err(`Cloning into '${rest[1] ?? (url.split('/').pop() ?? 'repo').replace(/\.git$/, '')}'...\nremote: The project you were looking for could not be found or you don't have permission to view it.\nfatal: repository '${url}' not found\n`);
      return 128;
    }
    const dir = rest[1] ?? project.split('/')[1];
    const abs = io.ctx.fs.resolve(dir);
    if (io.ctx.fs.exists(abs) && io.ctx.fs.readdir(abs).length) {
      io.err(`fatal: destination path '${dir}' already exists and is not an empty directory.\n`);
      return 128;
    }
    io.err(`Cloning into '${dir}'...\n`);
    const { repo } = Repo.init(io.ctx.fs, abs, { branch: 'main', clock: clockOf(io.ctx) });
    repo.homeDir = () => io.ctx.env.HOME ?? io.ctx.user.home;
    repo.setConfig('remote.origin.url', url);
    repo.setConfig('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    const forge = new ForgeProject(io.ctx.machine.rootFs, project);
    let n = 0;
    for (const [b, oid] of forge.repo.branches()) {
      n += copyObjects(forge.repo, repo, oid);
      repo.writeRef(`refs/remotes/origin/${b}`, oid, `clone: from ${url}`);
    }
    for (const [t, oid] of forge.repo.tags()) {
      n += copyObjects(forge.repo, repo, oid);
      repo.writeRef(`refs/tags/${t}`, oid, 'clone');
    }
    const def = forge.state().defaultBranch;
    const oid = forge.repo.readRef(`refs/heads/${def}`);
    if (!oid) {
      io.err('warning: You appear to have cloned an empty repository.\n');
      return 0;
    }
    io.err(`remote: Enumerating objects: ${n}, done.\nremote: Counting objects: 100% (${n}/${n}), done.\nReceiving objects: 100% (${n}/${n}), done.\n`);
    repo.writeRef(`refs/heads/${def}`, oid, `clone: from ${url}`);
    repo.setHead({ branch: def }, `clone: from ${url}`);
    repo.setConfig(`branch.${def}.remote`, 'origin');
    repo.setConfig(`branch.${def}.merge`, `refs/heads/${def}`);
    repo.checkoutTree(repo.commitFiles(oid), { from: new Map() });
    return 0;
  },

  tag(io, args) {
    const repo = openRepo(io);
    const annotate = args.includes('-a');
    const del = args.includes('-d');
    const mi = args.indexOf('-m');
    const msg = mi >= 0 ? args[mi + 1] : null;
    const rest = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-m');
    if (del) {
      const oid = repo.readRef(`refs/tags/${rest[0]}`);
      if (!oid) {
        io.err(`error: tag '${rest[0]}' not found.\n`);
        return 1;
      }
      repo.deleteRef(`refs/tags/${rest[0]}`);
      io.out(`Deleted tag '${rest[0]}' (was ${short(oid)})\n`);
      return 0;
    }
    if (!rest.length) {
      for (const t of [...repo.tags().keys()].sort()) io.out(t + '\n');
      return 0;
    }
    const name = rest[0];
    if (repo.readRef(`refs/tags/${name}`)) {
      io.err(`fatal: tag '${name}' already exists\n`);
      return 128;
    }
    const target = rest[1] ? resolveOrThrow(repo, rest[1]) : repo.headOid();
    if (!target) {
      io.err("fatal: Failed to resolve 'HEAD' as a valid ref.\n");
      return 128;
    }
    if (annotate || msg) {
      if (!msg) {
        io.err('hint: This simulator has no tag message editor; pass the message with -m "…".\nfatal: no tag message?\n');
        return 128;
      }
      const p = repo.person();
      const body = `object ${target}\ntype commit\ntag ${name}\ntagger ${p.name} <${p.email}> ${Math.floor(p.time / 1000)} ${p.tz}\n\n${msg}\n`;
      repo.writeRef(`refs/tags/${name}`, repo.writeObject('tag', body), 'tag');
    } else repo.writeRef(`refs/tags/${name}`, target, 'tag');
    return 0;
  },

  revert(io, args) {
    const repo = openRepo(io);
    const rev = args.find((a) => !a.startsWith('-'));
    if (!rev) return usage(io, 'revert', 'no commit specified');
    const oid = resolveOrThrow(repo, rev);
    const c = repo.readCommit(oid);
    if (c.parents.length > 1 && !args.includes('-m')) {
      io.err(`error: commit ${oid} is a merge but no -m option was given.\nfatal: revert failed\n`);
      return 128;
    }
    const dirty = repo.status();
    if (dirty.staged.length || dirty.unstaged.length) {
      io.err('error: your local changes would be overwritten by revert.\nhint: commit your changes or stash them to proceed.\nfatal: revert failed\n');
      return 128;
    }
    const head = repo.headOid()!;
    const parent = c.parents[0] ?? null;
    const message = `Revert "${c.message.split('\n')[0]}"\n\nThis reverts commit ${oid}.`;
    const res = threeWay(repo, repo.commitFiles(oid), repo.commitFiles(head), repo.commitFiles(parent), 'HEAD', `parent of ${short(oid)} (${c.message.split('\n')[0]})`);
    applyMergeResult(repo, res);
    if (res.conflicts.length) {
      for (const p of res.conflicts) io.out(`CONFLICT (content): Merge conflict in ${p}\n`);
      io.err(`error: could not revert ${short(oid)}... ${c.message.split('\n')[0]}\nhint: After resolving the conflicts, mark them with\nhint: "git add/rm <pathspec>", then run\nhint: "git revert --continue".\n`);
      return 1;
    }
    const tree = repo.buildTree(repo.indexAsTree());
    const person = repo.person();
    const newOid = repo.writeCommit({ tree, parents: [head], author: person, committer: person, message });
    repo.advanceHead(newOid, `revert: ${message.split('\n')[0]}`);
    io.out(`[${repo.currentBranch() ?? 'detached HEAD'} ${short(newOid)}] ${message.split('\n')[0]}\n`);
    printStat(io, repo, repo.commitFiles(head), repo.flatTree(tree), true);
    return 0;
  },

  reset(io, args) {
    const repo = openRepo(io);
    const mode = args.includes('--hard') ? 'hard' : args.includes('--soft') ? 'soft' : 'mixed';
    const dd = args.indexOf('--');
    const rest = (dd >= 0 ? args.slice(0, dd) : args).filter((a) => !a.startsWith('-'));
    const paths = dd >= 0 ? args.slice(dd + 1) : [];
    // `git reset <file>`: unstage.
    if (!paths.length && rest.length && !repo.resolve(rest[0])) return subs.restore(io, ['--staged', ...rest]);
    if (paths.length) return subs.restore(io, ['--staged', ...paths]);
    const target = rest[0] ? resolveOrThrow(repo, rest[0]) : repo.headOid();
    if (!target) return 0;
    const files = repo.commitFiles(target);
    const prev = repo.headOid();
    if (mode === 'hard') repo.checkoutTree(files, { from: unionTree(repo) });
    else if (mode === 'mixed') {
      const idx = new Map<string, IndexEntry>();
      for (const [p, e] of files) idx.set(p, { oid: e.oid, mode: e.mode });
      repo.writeIndex(idx);
    }
    repo.advanceHead(target, `reset: moving to ${rest[0] ?? 'HEAD'}`);
    if (prev) io.ctx.fs.writeFile(repo.p('ORIG_HEAD'), prev + '\n');
    for (const f of ['MERGE_HEAD', 'MERGE_MSG']) if (io.ctx.fs.exists(repo.p(f))) io.ctx.fs.unlink(repo.p(f));
    if (mode === 'hard') io.out(`HEAD is now at ${short(target)} ${repo.readCommit(target).message.split('\n')[0]}\n`);
    else if (mode === 'mixed') {
      const s = repo.status();
      if (s.unstaged.length) io.out(`Unstaged changes after reset:\n${s.unstaged.map((e) => `${e.kind === 'deleted' ? 'D' : 'M'}\t${e.path}`).join('\n')}\n`);
    }
    return 0;
  },

  reflog(io) {
    const repo = openRepo(io);
    const log = repo.readReflog('HEAD').reverse();
    const deco = decorations(repo);
    log.forEach((e, i) => io.out(`${io.c.yellow(short(e.to))}${i === 0 ? decoText(io, deco.get(e.to)) : ''} HEAD@{${i}}: ${e.reason}\n`));
    return 0;
  },

  'rev-parse'(io, args) {
    if (args.includes('--is-inside-work-tree')) {
      const r = Repo.find(io.ctx.fs, io.ctx.cwd);
      if (!r) throw new GitError('fatal: not a git repository (or any of the parent directories): .git');
      io.out('true\n');
      return 0;
    }
    const repo = openRepo(io);
    if (args.includes('--show-toplevel')) {
      io.out(repo.root + '\n');
      return 0;
    }
    const abbrev = args.includes('--abbrev-ref');
    const sh = args.includes('--short');
    for (const r of args.filter((a) => !a.startsWith('-'))) {
      if (abbrev && r === 'HEAD') {
        io.out((repo.currentBranch() ?? 'HEAD') + '\n');
        continue;
      }
      const oid = repo.resolve(r);
      if (!oid) {
        io.err(`fatal: ambiguous argument '${r}': unknown revision or path not in the working tree.\n`);
        return 128;
      }
      io.out((sh ? short(oid) : oid) + '\n');
    }
    return 0;
  },

  'cat-file'(io, args) {
    const repo = openRepo(io);
    const flag = args.find((a) => a.startsWith('-')) ?? '-p';
    const rev = args.find((a) => !a.startsWith('-'));
    if (!rev) return usage(io, 'cat-file', 'usage: git cat-file (-t | -s | -e | -p) <object>');
    const oid = rev.includes(':') ? repo.commitFiles(resolveOrThrow(repo, rev.split(':')[0] || 'HEAD')).get(rev.split(':')[1])?.oid : repo.resolve(rev);
    const o = oid ? repo.readObject(oid) : null;
    if (!o) {
      io.err(`fatal: Not a valid object name ${rev}\n`);
      return 128;
    }
    if (flag === '-t') io.out(o.type + '\n');
    else if (flag === '-s') io.out(new TextEncoder().encode(o.body).length + '\n');
    else if (flag === '-e') return 0;
    else if (o.type === 'tree') for (const e of repo.readTree(oid!)) io.out(`${e.mode} ${e.type} ${e.oid}\t${e.name}\n`);
    else io.out(o.body.endsWith('\n') || !o.body ? o.body : o.body + '\n');
    return 0;
  },

  'ls-files'(io) {
    const repo = openRepo(io);
    for (const p of repo.readIndex().keys()) io.out(p + '\n');
    return 0;
  },

  'hash-object'(io, args) {
    const file = args.find((a) => !a.startsWith('-'));
    if (!file) return usage(io, 'hash-object', 'usage: git hash-object [-w] <file>');
    const text = io.ctx.fs.readFile(file);
    if (args.includes('-w')) io.out(openRepo(io).writeObject('blob', text) + '\n');
    else io.out(objectId('blob', text) + '\n');
    return 0;
  },

  help(io, args) {
    const name = args.find((a) => !a.startsWith('-'));
    if (args.includes('-a') || !name) {
      io.out(GIT_USAGE);
      return 0;
    }
    return showMan(io, name === 'gitignore' ? 'gitignore' : `git-${name}`);
  },
};

function validBranch(name: string): boolean {
  return !!name && !/(^[-.]|\.\.|[\s~^:?*[\\]|\/$|\.lock$|@\{|\/\.)/.test(name) && name !== 'HEAD';
}

function resolveOrThrow(repo: Repo, rev: string): string {
  const oid = repo.resolve(rev);
  if (!oid) throw new GitError(`fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`);
  return oid;
}

function usage(io: Io, sub: string, msg: string): number {
  io.err(`error: ${msg}\n`);
  const page = GIT_MAN.find((p) => p.id === `man/git-${sub}.1`);
  const syn = page?.sections.find((s) => s.id === 'SYNOPSIS')?.body;
  if (syn) io.err(`usage: ${syn.split('\n').join('\n   or: ')}\n`);
  return 129;
}

function showMan(io: Io, name: string): number {
  const page = GIT_MAN.find((p) => p.id === `man/${name}.1` || p.id === `man/${name}.5`);
  if (!page) {
    io.err(`No manual entry for ${name}\n`);
    return 16;
  }
  if (io.ctx.isatty) io.ctx.effect({ kind: 'pager', title: page.title, text: renderManText(page) });
  else io.out(renderManText(page).replace(/\x1b\[[0-9;]*m/g, ''));
  return 0;
}

/** Union of index and HEAD paths: what a hard reset may have to delete from the working tree. */
function unionTree(repo: Repo): FlatTree {
  const m: FlatTree = new Map(repo.commitFiles(repo.headOid()));
  for (const [p, e] of repo.readIndex()) m.set(p, { oid: e.oid, mode: e.mode });
  return m;
}

function copyObjects(from: Repo, to: Repo, oid: string): number {
  let n = 0;
  const stack = [oid];
  const seen = new Set<string>();
  while (stack.length) {
    const o = stack.pop()!;
    if (seen.has(o)) continue;
    seen.add(o);
    if (to.hasObject(o)) continue;
    const obj = from.readObject(o);
    if (!obj) continue;
    to.writeObject(obj.type, obj.body);
    n++;
    if (obj.type === 'commit') {
      const c = from.readCommit(o);
      stack.push(c.tree, ...c.parents);
    } else if (obj.type === 'tree') for (const e of from.readTree(o)) stack.push(e.oid);
    else if (obj.type === 'tag') {
      const m = /^object ([0-9a-f]{40})/m.exec(obj.body);
      if (m) stack.push(m[1]);
    }
  }
  return n;
}

function fetchFrom(io: Io, repo: Repo, remote: string, quietWhenNothing: boolean): number {
  const url = repo.config(`remote.${remote}.url`);
  if (!url) {
    io.err(`fatal: '${remote}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
    return 128;
  }
  const project = projectOfUrl(url);
  if (!project || !ForgeProject.exists(io.ctx.machine.rootFs, project)) {
    io.err(`fatal: repository '${url}' not found\n`);
    return 128;
  }
  const forge = new ForgeProject(io.ctx.machine.rootFs, project);
  const lines: string[] = [];
  for (const [b, oid] of forge.repo.branches()) {
    const old = repo.readRef(`refs/remotes/${remote}/${b}`);
    if (old === oid) continue;
    copyObjects(forge.repo, repo, oid);
    repo.writeRef(`refs/remotes/${remote}/${b}`, oid, 'fetch');
    lines.push(old ? `   ${short(old)}..${short(oid)}  ${b.padEnd(10)} -> ${remote}/${b}` : ` * [new branch]      ${b.padEnd(10)} -> ${remote}/${b}`);
  }
  for (const [t, oid] of forge.repo.tags()) {
    if (repo.readRef(`refs/tags/${t}`)) continue;
    copyObjects(forge.repo, repo, oid);
    repo.writeRef(`refs/tags/${t}`, oid, 'fetch');
    lines.push(` * [new tag]         ${t.padEnd(10)} -> ${t}`);
  }
  if (lines.length) io.err(`From ${url.replace(/\.git$/, '')}\n${lines.join('\n')}\n`);
  else if (!quietWhenNothing) {
    /* git fetch prints nothing when up to date */
  }
  return 0;
}

interface ThreeWay {
  files: FlatTree;
  conflicts: string[];
  conflictEntries: Map<string, IndexEntry>;
  texts: Map<string, string>;
  messages: string[];
}

function threeWay(repo: Repo, base: FlatTree, ours: FlatTree, theirs: FlatTree, oursLabel: string, theirsLabel: string): ThreeWay {
  const files: FlatTree = new Map();
  const conflicts: string[] = [];
  const conflictEntries = new Map<string, IndexEntry>();
  const texts = new Map<string, string>();
  const messages: string[] = [];
  for (const p of [...new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])].sort()) {
    const b = base.get(p);
    const o = ours.get(p);
    const t = theirs.get(p);
    if (o?.oid === t?.oid) {
      if (o) files.set(p, o);
      continue;
    }
    if (b?.oid === o?.oid) {
      if (t) files.set(p, t);
      continue;
    }
    if (b?.oid === t?.oid) {
      if (o) files.set(p, o);
      continue;
    }
    if (o && t) {
      messages.push(`Auto-merging ${p}`);
      const r = merge3(b ? repo.readBlob(b.oid) : '', repo.readBlob(o.oid), repo.readBlob(t.oid), { ours: oursLabel, theirs: theirsLabel });
      if (r.conflicts) {
        messages.push(`CONFLICT (${b ? 'content' : 'add/add'}): Merge conflict in ${p}`);
        conflicts.push(p);
        texts.set(p, r.text);
        conflictEntries.set(p, { oid: o.oid, mode: o.mode, conflict: { base: b?.oid, ours: o.oid, theirs: t.oid } });
      } else files.set(p, { oid: repo.writeObject('blob', r.text), mode: o.mode });
      continue;
    }
    // modify/delete
    const kept = o ?? t!;
    messages.push(`CONFLICT (modify/delete): ${p} deleted in ${o ? theirsLabel : oursLabel} and modified in ${o ? oursLabel : theirsLabel}.  Version ${o ? oursLabel : theirsLabel} of ${p} left in tree.`);
    conflicts.push(p);
    texts.set(p, repo.readBlob(kept.oid));
    conflictEntries.set(p, { oid: kept.oid, mode: kept.mode, conflict: { base: b?.oid, ours: o?.oid, theirs: t?.oid } });
  }
  return { files, conflicts, conflictEntries, texts, messages };
}

function applyMergeResult(repo: Repo, res: ThreeWay): void {
  const all: FlatTree = new Map(res.files);
  for (const [p, e] of res.conflictEntries) all.set(p, { oid: e.oid, mode: e.mode });
  repo.checkoutTree(all, { from: unionTree(repo) });
  for (const [p, text] of res.texts) repo.fs.writeFile(`${repo.root}/${p}`, text);
  const idx = repo.readIndex();
  for (const [p, e] of res.conflictEntries) idx.set(p, e);
  repo.writeIndex(idx);
}

function dirtyPaths(repo: Repo): Set<string> {
  const s = repo.status();
  return new Set([...s.staged, ...s.unstaged].map((e) => e.path));
}

function mergeInto(io: Io, repo: Repo, theirs: string, name: string, o: { noFf?: boolean; ffOnly?: boolean; message?: string | null; pullFrom?: string }): number {
  const head = repo.headOid();
  const branch = repo.currentBranch();
  if (!head) {
    // Merging into an unborn branch just takes the other side.
    repo.checkoutTree(repo.commitFiles(theirs), { from: unionTree(repo) });
    repo.advanceHead(theirs, `merge ${name}: Fast-forward`);
    return 0;
  }
  if (repo.isAncestor(theirs, head)) {
    io.out('Already up to date.\n');
    return 0;
  }
  const dirty = dirtyPaths(repo);
  const headFiles = repo.commitFiles(head);
  const theirFiles = repo.commitFiles(theirs);
  const touched = [...dirty].filter((p) => headFiles.get(p)?.oid !== theirFiles.get(p)?.oid);
  if (touched.length) {
    io.err(`error: Your local changes to the following files would be overwritten by merge:\n${touched.map((p) => `\t${p}`).join('\n')}\nPlease commit your changes or stash them before you merge.\nAborting\n`);
    return 2;
  }
  if (repo.isAncestor(head, theirs) && !o.noFf) {
    io.out(`Updating ${short(head)}..${short(theirs)}\nFast-forward\n`);
    repo.checkoutTree(theirFiles, { from: unionTree(repo) });
    repo.advanceHead(theirs, `${o.pullFrom ? 'pull' : `merge ${name}`}: Fast-forward`);
    printStat(io, repo, headFiles, theirFiles, false);
    return 0;
  }
  if (o.ffOnly) {
    io.err('fatal: Not possible to fast-forward, aborting.\n');
    return 128;
  }
  const base = repo.mergeBase(head, theirs);
  const res = threeWay(repo, repo.commitFiles(base), headFiles, theirFiles, 'HEAD', name);
  for (const m of res.messages) io.out(m + '\n');
  const msg = o.message ?? (o.pullFrom ? `Merge branch '${name}' of ${o.pullFrom}` : `Merge branch '${name}'${branch && branch !== 'main' && branch !== 'master' ? ` into ${branch}` : ''}`);
  applyMergeResult(repo, res);
  if (res.conflicts.length) {
    io.fsWrite(repo.p('MERGE_HEAD'), theirs + '\n');
    io.fsWrite(repo.p('MERGE_MSG'), `${msg}\n\n# Conflicts:\n${res.conflicts.map((p) => `#\t${p}`).join('\n')}\n`);
    io.out('Automatic merge failed; fix conflicts and then commit the result.\n');
    return 1;
  }
  const tree = repo.buildTree(repo.indexAsTree());
  const person = repo.person();
  const oid = repo.writeCommit({ tree, parents: [head, theirs], author: person, committer: person, message: msg });
  repo.advanceHead(oid, `merge ${name}: Merge made by the 'ort' strategy.`);
  io.out("Merge made by the 'ort' strategy.\n");
  printStat(io, repo, headFiles, repo.flatTree(tree), false);
  return 0;
}

function switchTo(io: Io, repo: Repo, name: string, o: { create?: boolean; start?: string; track?: boolean }): number {
  const head = repo.headOid();
  if (o.create) {
    if (!validBranch(name)) {
      io.err(`fatal: '${name}' is not a valid branch name\n`);
      return 128;
    }
    if (repo.readRef(`refs/heads/${name}`)) {
      io.err(`fatal: a branch named '${name}' already exists\n`);
      return 128;
    }
  } else if (repo.currentBranch() === name) {
    io.err(`Already on '${name}'\n`);
    return 0;
  }
  const target = o.create ? (o.start ? repo.resolve(o.start) : head) : repo.readRef(`refs/heads/${name}`);
  if (o.create && o.start && !target) {
    io.err(`fatal: invalid reference: ${o.start}\n`);
    return 128;
  }
  if (target && target !== head) {
    const err = carryOver(io, repo, head, target, 'checkout');
    if (err) return err;
  }
  if (o.create) {
    if (target) repo.writeRef(`refs/heads/${name}`, target, `branch: Created from ${o.start ?? 'HEAD'}`);
    if (o.track && o.start) {
      const [remote, ...b] = o.start.split('/');
      repo.setConfig(`branch.${name}.remote`, remote);
      repo.setConfig(`branch.${name}.merge`, `refs/heads/${b.join('/')}`);
      io.out(`branch '${name}' set up to track '${o.start}'.\n`);
    }
  }
  const prevName = repo.currentBranch() ?? short(head);
  repo.setHead({ branch: name }, `checkout: moving from ${prevName} to ${name}`);
  io.err(o.create ? `Switched to a new branch '${name}'\n` : `Switched to branch '${name}'\n`);
  if (!o.create) {
    const up = upstreamOf(repo, name);
    if (up?.oid && target) {
      const [ahead, behind] = aheadBehind(repo, target, up.oid);
      if (!ahead && !behind) io.out(`Your branch is up to date with '${up.ref}'.\n`);
      else if (ahead && !behind) io.out(`Your branch is ahead of '${up.ref}' by ${plural(ahead, 'commit')}.\n  (use "git push" to publish your local commits)\n`);
      else if (behind && !ahead) io.out(`Your branch is behind '${up.ref}' by ${plural(behind, 'commit')}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)\n`);
    }
  }
  return 0;
}

function detachTo(io: Io, repo: Repo, oid: string, rev: string): number {
  const err = carryOver(io, repo, repo.headOid(), oid, 'checkout');
  if (err) return err;
  const prev = repo.currentBranch() ?? short(repo.headOid());
  repo.setHead({ oid }, `checkout: moving from ${prev} to ${rev}`);
  io.err(
    `Note: switching to '${rev}'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nIf you want to create a new branch to retain commits you create, you may\ndo so (now or later) by using -c with the switch command. Example:\n\n  git switch -c <new-branch-name>\n\nOr undo this operation with:\n\n  git switch -\n\nHEAD is now at ${short(oid)} ${repo.readCommit(oid).message.split('\n')[0]}\n`,
  );
  return 0;
}

/** Move the working tree from one commit to another, keeping local changes that do not collide (git switch semantics). */
function carryOver(io: Io, repo: Repo, from: string | null, to: string, verb: string): number {
  const a = repo.commitFiles(from);
  const b = repo.commitFiles(to);
  const dirty = dirtyPaths(repo);
  const s = repo.status();
  const collide = [...dirty].filter((p) => a.get(p)?.oid !== b.get(p)?.oid);
  if (collide.length) {
    io.err(`error: Your local changes to the following files would be overwritten by ${verb}:\n${collide.map((p) => `\t${p}`).join('\n')}\nPlease commit your changes or stash them before you switch branches.\nAborting\n`);
    return 1;
  }
  const untrackedHit = s.untracked.filter((p) => b.has(p) && !a.has(p));
  if (untrackedHit.length) {
    io.err(`error: The following untracked working tree files would be overwritten by ${verb}:\n${untrackedHit.map((p) => `\t${p}`).join('\n')}\nPlease move or remove them before you switch branches.\nAborting\n`);
    return 1;
  }
  const idx = repo.readIndex();
  for (const p of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(p)?.oid === b.get(p)?.oid) continue;
    const abs = `${repo.root}/${p}`;
    const e = b.get(p);
    if (e) {
      const dir = abs.slice(0, abs.lastIndexOf('/'));
      if (!repo.fs.exists(dir)) repo.fs.mkdir(dir, { parents: true });
      repo.fs.writeFile(abs, repo.readBlob(e.oid));
      idx.set(p, { oid: e.oid, mode: e.mode });
    } else {
      if (repo.fs.exists(abs)) repo.fs.unlink(abs);
      idx.delete(p);
    }
  }
  repo.writeIndex(idx);
  return 0;
}

function fileDiff(io: Io, path: string, a: string | undefined, b: string | undefined): string {
  const oa = a === undefined ? '0000000' : short(objectId('blob', a));
  const ob = b === undefined ? '0000000' : short(objectId('blob', b));
  let out = io.c.bold(`diff --git a/${path} b/${path}`) + '\n';
  if (a === undefined) out += io.c.bold('new file mode 100644') + '\n' + io.c.bold(`index ${oa}..${ob}`) + '\n' + io.c.bold('--- /dev/null') + '\n' + io.c.bold(`+++ b/${path}`) + '\n';
  else if (b === undefined) out += io.c.bold('deleted file mode 100644') + '\n' + io.c.bold(`index ${oa}..${ob}`) + '\n' + io.c.bold(`--- a/${path}`) + '\n' + io.c.bold('+++ /dev/null') + '\n';
  else out += io.c.bold(`index ${oa}..${ob} 100644`) + '\n' + io.c.bold(`--- a/${path}`) + '\n' + io.c.bold(`+++ b/${path}`) + '\n';
  out += unifiedHunks(a ?? '', b ?? '', { meta: io.c.bold, hunk: io.c.cyan, add: io.c.green, del: io.c.red });
  return out;
}

function printStat(io: Io, repo: Repo, before: FlatTree, after: FlatTree, summaryModes: boolean): void {
  const a = new Map([...before].map(([p, e]) => [p, { text: repo.readBlob(e.oid) }]));
  const b = new Map([...after].map(([p, e]) => [p, { text: repo.readBlob(e.oid) }]));
  const changed = [...new Set([...a.keys(), ...b.keys()])].sort().filter((k) => a.get(k)?.text !== b.get(k)?.text);
  if (!summaryModes) {
    printStatMaps(io, a, b, changed);
    return;
  }
  let add = 0;
  let del = 0;
  for (const k of changed) {
    const s = lineStats(a.get(k)?.text ?? '', b.get(k)?.text ?? '');
    add += s.add;
    del += s.del;
  }
  io.out(` ${plural(changed.length, 'file')} changed${add ? `, ${plural(add, 'insertion')}(+)` : ''}${del ? `, ${plural(del, 'deletion')}(-)` : ''}\n`.replace('files changed', 'files changed'));
  for (const k of changed) {
    if (!a.has(k)) io.out(` create mode ${after.get(k)!.mode} ${k}\n`);
    else if (!b.has(k)) io.out(` delete mode ${before.get(k)!.mode} ${k}\n`);
  }
}

function printStatMaps(io: Io, a: Map<string, { text: string }>, b: Map<string, { text: string }>, changed: string[]): void {
  if (!changed.length) return;
  const width = Math.max(...changed.map((k) => k.length));
  let add = 0;
  let del = 0;
  for (const k of changed) {
    const s = lineStats(a.get(k)?.text ?? '', b.get(k)?.text ?? '');
    add += s.add;
    del += s.del;
    const n = s.add + s.del;
    io.out(` ${k.padEnd(width)} | ${String(n).padStart(2)} ${io.c.green('+'.repeat(Math.min(s.add, 40)))}${io.c.red('-'.repeat(Math.min(s.del, 40)))}\n`);
  }
  io.out(` ${plural(changed.length, 'file')} changed${add ? `, ${plural(add, 'insertion')}(+)` : ''}${del ? `, ${plural(del, 'deletion')}(-)` : ''}\n`);
  for (const k of changed) {
    if (!a.has(k)) io.out(` create mode 100644 ${k}\n`);
    else if (!b.has(k)) io.out(` delete mode 100644 ${k}\n`);
  }
}

/** Topological order, newest first: a commit is printed before its parents. */
function topo(repo: Repo, commits: Commit[]): Commit[] {
  const inSet = new Map(commits.map((c) => [c.oid, c]));
  const children = new Map<string, number>();
  for (const c of commits) for (const p of c.parents) if (inSet.has(p)) children.set(p, (children.get(p) ?? 0) + 1);
  const ready = commits.filter((c) => !children.get(c.oid));
  const out: Commit[] = [];
  while (ready.length) {
    ready.sort((a, b) => b.committer.time - a.committer.time || (a.oid < b.oid ? -1 : 1));
    const c = ready.shift()!;
    out.push(c);
    for (const p of c.parents) {
      if (!inSet.has(p)) continue;
      const n = (children.get(p) ?? 0) - 1;
      children.set(p, n);
      if (n === 0) ready.push(inSet.get(p)!);
    }
  }
  void repo;
  return out;
}

/** A simplified `git log --graph`: lanes with *, |, \\ and / drawn the way Git draws them. */
export function graphRows(commits: Commit[]): { commit: Commit | null; prefix: string; cont: string }[] {
  const rows: { commit: Commit | null; prefix: string; cont: string }[] = [];
  let cols: (string | null)[] = [];
  const lanes = (cs: (string | null)[], star = -1) => cs.map((x, j) => (j === star ? '*' : x ? '|' : ' ')).join(' ');
  for (const c of commits) {
    let i = cols.indexOf(c.oid);
    if (i < 0) {
      i = cols.indexOf(null);
      if (i < 0) {
        cols.push(c.oid);
        i = cols.length - 1;
      } else cols[i] = c.oid;
    }
    // Lanes that also wait for this commit fold into it first: "|/".
    const dups = cols.map((x, j) => (x === c.oid && j !== i ? j : -1)).filter((j) => j >= 0);
    if (dups.length) {
      const line: string[] = Array(cols.length * 2).fill(' ');
      let k = 0;
      cols.forEach((x, j) => {
        if (dups.includes(j)) line[2 * j - 1] = '/';
        else if (x) {
          line[2 * k] = k === j ? '|' : line[2 * k];
          if (k !== j) line[2 * j - 1] = '/';
          k++;
        } else k++;
      });
      rows.push({ commit: null, prefix: line.join(''), cont: '' });
      cols = cols.filter((_, j) => !dups.includes(j));
    }
    const next = [...cols];
    next[i] = c.parents[0] ?? null;
    const extra = c.parents.slice(1).filter((p) => !next.includes(p));
    if (extra.length) next.splice(i + 1, 0, ...extra);
    const width = Math.max(cols.length, next.length) * 2;
    rows.push({ commit: c, prefix: lanes(cols, i).padEnd(width, ' '), cont: lanes(c.parents.length ? next.slice(0, Math.max(cols.length, 1)) : cols.map((x, j) => (j === i ? null : x))).padEnd(width, ' ') });
    if (extra.length) {
      // "|\": the new lanes open to the right of the merge commit.
      const line: string[] = Array(next.length * 2).fill(' ');
      next.forEach((x, j) => {
        if (j > i && j <= i + extra.length) line[2 * j - 1] = '\\';
        else if (j > i + extra.length && x) line[2 * j - 1] = '\\';
        else if (x) line[2 * j] = '|';
      });
      rows.push({ commit: null, prefix: line.join(''), cont: '' });
    }
    cols = next;
    while (cols.length && cols[cols.length - 1] === null) cols.pop();
  }
  return rows;
}

const GIT_USAGE = `usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]
           <command> [<args>]

These are common Git commands used in various situations:

start a working area (see also: git help tutorial)
   clone      Clone a repository into a new directory
   init       Create an empty Git repository or reinitialize an existing one

work on the current change (see also: git help everyday)
   add        Add file contents to the index
   restore    Restore working tree files
   rm         Remove files from the working tree and from the index

examine the history and state (see also: git help revisions)
   diff       Show changes between commits, commit and working tree, etc
   log        Show commit logs
   show       Show various types of objects
   status     Show the working tree status

grow, mark and tweak your common history
   branch     List, create, or delete branches
   commit     Record changes to the repository
   merge      Join two or more development histories together
   reset      Reset current HEAD to the specified state
   revert     Revert some existing commits
   switch     Switch branches
   tag        Create, list, delete or verify a tag object signed with GPG

collaborate (see also: git help workflows)
   fetch      Download objects and refs from another repository
   pull       Fetch from and integrate with another repository or a local branch
   push       Update remote refs along with associated objects

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
See 'git help git' for an overview of the system.
`;

export const gitCommand: ShellCommand = {
  name: 'git',
  summary: bi('Система контроля версий: история проекта, ветки, обмен с удалённым репозиторием.', 'Version control: the project history, branches, exchange with a remote repository.'),
  help: GIT_USAGE,
  handlesHelp: true,
  async run(ctx) {
    const c = ctx.isatty ? C : noColor;
    const io: Io = { ctx, out: ctx.out, err: ctx.err, c, fsWrite: (p, s) => io.ctx.fs.writeFile(p, s) };
    let args = ctx.argv.slice(1);
    // git -C <dir> …
    while (args[0] === '-C' && args[1]) {
      const dir = ctx.fs.resolve(args[1]);
      ctx = { ...ctx, cwd: dir, fs: rebase(ctx.fs, dir) };
      io.ctx = ctx;
      args = args.slice(2);
    }
    const sub = args[0];
    if (!sub) {
      ctx.out(GIT_USAGE);
      return 1;
    }
    if (sub === '--version' || sub === '-v' || sub === 'version') {
      ctx.out(`git version ${GIT_VERSION}\n`);
      return 0;
    }
    if (sub === '--help' || sub === '-h') {
      ctx.out(GIT_USAGE);
      return 0;
    }
    const rest = args.slice(1);
    if (rest.includes('--help')) return showMan(io, `git-${sub}`);
    if (rest.length === 1 && rest[0] === '-h') {
      const page = GIT_MAN.find((p) => p.id === `man/git-${sub}.1`);
      const syn = page?.sections.find((s) => s.id === 'SYNOPSIS')?.body;
      ctx.out(syn ? `usage: ${syn.split('\n').join('\n   or: ')}\n` : `usage: git ${sub} [<options>]\n`);
      return 129;
    }
    const fn = subs[sub];
    if (!fn) {
      ctx.err(`git: '${sub}' is not a git command. See 'git --help'.\n`);
      const near = Object.keys(subs).filter((k) => lev(k, sub) <= 2);
      if (near.length) ctx.err(`\nThe most similar command is\n\t${near[0]}\n`);
      return 1;
    }
    try {
      return await fn(io, rest);
    } catch (e) {
      if (e instanceof GitError) {
        ctx.err(e.message + '\n');
        return e.code;
      }
      throw e;
    }
  },
  complete(args) {
    if (args.length <= 1) return Object.keys(subs);
    return [];
  },
};

function rebase(fs: FsApi, dir: string): FsApi {
  const abs = (p: string) => (p.startsWith('/') ? p : `${dir}/${p}`);
  return {
    resolve: (p) => fs.resolve(abs(p)),
    exists: (p) => fs.exists(abs(p)),
    stat: (p) => fs.stat(abs(p)),
    lstat: (p) => fs.lstat(abs(p)),
    readFile: (p) => fs.readFile(abs(p)),
    writeFile: (p, d, o) => fs.writeFile(abs(p), d, o),
    mkdir: (p, o) => fs.mkdir(abs(p), o),
    readdir: (p) => fs.readdir(abs(p)),
    unlink: (p) => fs.unlink(abs(p)),
    rmdir: (p) => fs.rmdir(abs(p)),
    rename: (a, b) => fs.rename(abs(a), abs(b)),
    symlink: (t, p) => fs.symlink(t, abs(p)),
    link: (a, b) => fs.link(abs(a), abs(b)),
    readlink: (p) => fs.readlink(abs(p)),
    chmod: (p, m) => fs.chmod(abs(p), m),
    chown: (p, u, g) => fs.chown(abs(p), u, g),
    utimes: (p, m) => fs.utimes(abs(p), m),
    access: (p, m) => fs.access(abs(p), m),
  };
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export { forgePath, forgeUrl, hasConflictMarkers };
