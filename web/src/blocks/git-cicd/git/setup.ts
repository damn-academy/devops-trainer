// Facts and setup for the simulated Git.
//
// Facts scope `git` (09 §2.2 style):
//   git.repos[path=/home/learner/site].branch            current branch or null
//   git.repos[…].head, .branches{name: oid}, .tags{…}, .remotes{name: url}
//   git.repos[…].commits[]  {oid, parents[], message, author, files{path: text}} newest first
//   git.repos[…].status     {staged[], unstaged[], untracked[], conflicted[]}
//   git.repos[…].merging    a merge is in progress
//   git.forge[project=team/site].branches{…}, .commits[], .mrs[]
//
// Setup `ext.git`: { identity, repos: [...], forge: [...] } — see GitSetup.

import type { FactsProvider, FsApi, SetupHook, SimMachineApi } from '../../../core/types';
import { ForgeProject, forgeUrl, type CiVariable, type ForgeState, type MergeRequest, type Runner } from './forge';
import { Repo, serializeConfig, type FlatTree } from './repo';

export interface CommitSpec {
  message: string;
  /** path → content; null deletes the file. */
  files: Record<string, string | null>;
  author?: { name: string; email: string };
  /** Branch to commit on (created from the current HEAD when missing). */
  branch?: string;
  /** Merge this branch into `branch` with a merge commit instead of writing files. */
  merge?: string;
}

export interface RepoSpec {
  path: string;
  initialBranch?: string;
  commits?: CommitSpec[];
  /** Branch checked out at the end. */
  checkout?: string;
  /** Files changed in the working tree after the history is built (not staged). */
  worktree?: Record<string, string | null>;
  /** Paths from `worktree` to put into the index. */
  staged?: string[];
  /** Push every branch to this forge project and set origin + upstreams. */
  remote?: string;
}

export interface ForgeSpec {
  project: string;
  /** History of the default branch on the forge (when no local repo pushes it). */
  commits?: CommitSpec[];
  /** Commits added on the forge after local clones were made (someone else's work). */
  later?: CommitSpec[];
  variables?: CiVariable[];
  runners?: Runner[];
  protectedBranches?: string[];
  mrs?: Partial<MergeRequest>[];
}

export interface GitSetup {
  identity?: { name: string; email: string };
  /** Extra ~/.gitconfig lines as key → value (init.defaultBranch, pull.rebase…). */
  config?: Record<string, string>;
  forge?: ForgeSpec[];
  repos?: RepoSpec[];
}

const BASE_TIME = Date.UTC(2026, 10, 17, 9, 0, 0);
const BOT = { name: 'Forge Bot', email: 'bot@forge.edu' };

function machineClock(m: SimMachineApi): () => number {
  const mm = m as unknown as { now?: () => number };
  return () => (typeof mm.now === 'function' ? mm.now() : Date.now());
}

/** Write a commit from a spec onto the current HEAD of `repo` (files only, no working tree). */
function commitSpec(repo: Repo, spec: CommitSpec, time: number, fallback: { name: string; email: string }): string {
  if (spec.branch && repo.currentBranch() !== spec.branch) {
    if (!repo.readRef(`refs/heads/${spec.branch}`)) {
      const h = repo.headOid();
      if (h) repo.writeRef(`refs/heads/${spec.branch}`, h, 'branch: Created from HEAD');
    }
    repo.fs.writeFile(repo.p('HEAD'), `ref: refs/heads/${spec.branch}\n`);
  }
  const head = repo.headOid();
  const who = { ...(spec.author ?? fallback), time, tz: '+0000' };
  if (spec.merge) {
    const theirs = repo.readRef(`refs/heads/${spec.merge}`)!;
    const files: FlatTree = new Map(repo.commitFiles(head));
    for (const [p, e] of repo.commitFiles(theirs)) files.set(p, e);
    const oid = repo.writeCommit({ tree: repo.buildTree(files), parents: [head!, theirs], author: who, committer: who, message: spec.message || `Merge branch '${spec.merge}'` });
    repo.advanceHead(oid, `merge ${spec.merge}: Merge made by the 'ort' strategy.`);
    return oid;
  }
  const files: FlatTree = new Map(repo.commitFiles(head));
  for (const [p, text] of Object.entries(spec.files)) {
    if (text === null) files.delete(p);
    else files.set(p, { oid: repo.writeObject('blob', text), mode: p.endsWith('.sh') ? '100755' : '100644' });
  }
  const oid = repo.writeCommit({ tree: repo.buildTree(files), parents: head ? [head] : [], author: who, committer: who, message: spec.message });
  repo.advanceHead(oid, `commit${head ? '' : ' (initial)'}: ${spec.message.split('\n')[0]}`);
  return oid;
}

function copyAll(from: Repo, to: Repo): void {
  for (const oid of from.allObjects()) {
    if (to.hasObject(oid)) continue;
    const o = from.readObject(oid)!;
    to.writeObject(o.type, o.body);
  }
}

export function applyGitSetup(m: SimMachineApi, value: unknown): void {
  const spec = value as GitSetup;
  const clock = machineClock(m);
  const login = m.users.find((u) => u.uid >= 1000 && u.uid < 60000 && m.rootFs.exists(u.home)) ?? m.users[0];
  const home = login.home;
  const fs: FsApi = m.rootFs;
  const identity = spec.identity;
  // ~/.gitconfig
  const cfg = new Map<string, string>();
  if (identity) {
    cfg.set('user.name', identity.name);
    cfg.set('user.email', identity.email);
  }
  for (const [k, v] of Object.entries(spec.config ?? {})) cfg.set(k, v);
  if (cfg.size) {
    fs.writeFile(`${home}/.gitconfig`, serializeConfig(cfg));
    fs.chown(`${home}/.gitconfig`, login.uid, login.gid);
  }
  let t = BASE_TIME;
  const tick = () => (t += 7 * 60_000);
  const author = identity ?? { name: 'Learner', email: 'learner@example.com' };

  for (const f of spec.forge ?? []) {
    const project = ForgeProject.create(fs, f.project, clock);
    const repo = project.repo;
    for (const c of f.commits ?? []) commitSpec(repo, { ...c, branch: c.branch ?? 'main' }, tick(), c.author ?? BOT);
    project.update((s: ForgeState) => {
      if (f.variables) s.variables = f.variables;
      if (f.runners) s.runners = f.runners;
      if (f.protectedBranches) s.protectedBranches = f.protectedBranches;
      for (const mr of f.mrs ?? []) {
        s.mrs.push({ iid: s.next.mr++, title: mr.title ?? 'Draft', source: mr.source ?? 'feature', target: mr.target ?? 'main', state: mr.state ?? 'opened', author: mr.author ?? 'learner', notes: mr.notes ?? [] });
      }
    });
  }

  for (const r of spec.repos ?? []) {
    const path = r.path.startsWith('~') ? home + r.path.slice(1) : r.path;
    const { repo } = Repo.init(fs, path, { branch: r.initialBranch ?? 'main', clock });
    if (r.remote) {
      // Start from the forge history when the project already has one.
      const forge = ForgeProject.exists(fs, r.remote) ? new ForgeProject(fs, r.remote, clock) : ForgeProject.create(fs, r.remote, clock);
      const main = forge.repo.readRef('refs/heads/main');
      if (main) {
        copyAll(forge.repo, repo);
        repo.writeRef('refs/heads/main', main, 'clone');
      }
    }
    for (const c of r.commits ?? []) commitSpec(repo, c, tick(), c.author ?? author);
    const checkout = r.checkout ?? r.initialBranch ?? 'main';
    if (repo.readRef(`refs/heads/${checkout}`) || !repo.headOid()) repo.fs.writeFile(repo.p('HEAD'), `ref: refs/heads/${checkout}\n`);
    const head = repo.headOid();
    repo.checkoutTree(repo.commitFiles(head), { from: new Map() });
    if (r.remote) {
      const forge = new ForgeProject(fs, r.remote, clock);
      copyAll(repo, forge.repo);
      repo.setConfig('remote.origin.url', forgeUrl(r.remote));
      repo.setConfig('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
      for (const [b, oid] of repo.branches()) {
        forge.repo.writeRef(`refs/heads/${b}`, oid, 'push');
        repo.writeRef(`refs/remotes/origin/${b}`, oid, 'update by push');
        repo.setConfig(`branch.${b}.remote`, 'origin');
        repo.setConfig(`branch.${b}.merge`, `refs/heads/${b}`);
      }
    }
    for (const [p, text] of Object.entries(r.worktree ?? {})) {
      const abs = `${path}/${p}`;
      if (text === null) {
        if (fs.exists(abs)) fs.unlink(abs);
      } else {
        const dir = abs.slice(0, abs.lastIndexOf('/'));
        if (!fs.exists(dir)) fs.mkdir(dir, { parents: true });
        fs.writeFile(abs, text);
      }
    }
    if (r.staged?.length) {
      const idx = repo.readIndex();
      for (const p of r.staged) {
        const abs = `${path}/${p}`;
        if (fs.exists(abs)) idx.set(p, { oid: repo.writeObject('blob', fs.readFile(abs)), mode: '100644' });
        else idx.delete(p);
      }
      repo.writeIndex(idx);
    }
    chownTree(m, path, login.uid, login.gid);
  }

  // Work that lands on the forge after the learner's clone ("someone pushed first").
  for (const f of spec.forge ?? []) {
    if (!f.later?.length) continue;
    const project = new ForgeProject(fs, f.project, clock);
    for (const c of f.later) commitSpec(project.repo, { ...c, branch: c.branch ?? 'main' }, tick(), c.author ?? BOT);
  }
}

function chownTree(m: SimMachineApi, path: string, uid: number, gid: number): void {
  const fs = m.rootFs;
  const walk = (p: string) => {
    fs.chown(p, uid, gid);
    if (fs.stat(p)?.type === 'd') for (const e of fs.readdir(p)) walk(`${p}/${e}`);
  };
  if (fs.exists(path)) walk(path);
  // Parent directories created for the repository belong to the user too.
  let parent = path.slice(0, path.lastIndexOf('/'));
  const home = m.users.find((u) => u.uid === uid)?.home ?? '';
  while (parent.length > home.length && parent.startsWith(home)) {
    fs.chown(parent, uid, gid);
    parent = parent.slice(0, parent.lastIndexOf('/'));
  }
}

// ── facts ──

function findRepos(fs: FsApi): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 5) return;
    let names: string[];
    try {
      names = fs.readdir(dir);
    } catch {
      return;
    }
    if (names.includes('.git') && fs.stat(`${dir}/.git/HEAD`)) out.push(dir);
    for (const n of names) {
      if (n === '.git' || n === 'node_modules') continue;
      const p = dir === '/' ? `/${n}` : `${dir}/${n}`;
      if (fs.stat(p)?.type === 'd') walk(p, depth + 1);
    }
  };
  for (const root of ['/home', '/root', '/srv/work', '/opt', '/builds']) if (fs.exists(root)) walk(root, 0);
  return out;
}

export interface CommitFact {
  oid: string;
  parents: string[];
  message: string;
  author: string;
  files: Record<string, string>;
}

function commitFacts(repo: Repo, starts: string[]): CommitFact[] {
  return repo.walk(starts, 200).map((c) => {
    const files: Record<string, string> = {};
    for (const [p, e] of repo.flatTree(c.tree)) files[p] = repo.readBlob(e.oid);
    return { oid: c.oid, parents: c.parents, message: c.message, author: `${c.author.name} <${c.author.email}>`, files };
  });
}

export function gitFacts(m: SimMachineApi) {
  const fs = m.rootFs;
  const repos = findRepos(fs).map((path) => {
    const repo = Repo.open(fs, path)!;
    const login = m.user();
    repo.homeDir = () => login.home;
    const head = repo.headOid();
    const branches = Object.fromEntries(repo.branches());
    const cfg = repo.readConfig(repo.p('config'));
    const remotes: Record<string, string> = {};
    for (const [k, v] of cfg) if (k.startsWith('remote.') && k.endsWith('.url')) remotes[k.slice(7, -4)] = v;
    const upstream: Record<string, string> = {};
    for (const b of Object.keys(branches)) {
      const r = cfg.get(`branch.${b}.remote`);
      const mg = cfg.get(`branch.${b}.merge`);
      if (r && mg) upstream[b] = `${r}/${mg.replace(/^refs\/heads\//, '')}`;
    }
    let status = { staged: [] as string[], unstaged: [] as string[], untracked: [] as string[], conflicted: [] as string[] };
    try {
      const s = repo.status();
      status = { staged: s.staged.map((e) => e.path), unstaged: s.unstaged.map((e) => e.path), untracked: s.untracked, conflicted: s.conflicted };
    } catch {
      /* a broken index shows as no status */
    }
    const index: Record<string, string> = {};
    for (const [p, e] of repo.readIndex()) index[p] = e.oid;
    return {
      path,
      branch: repo.currentBranch(),
      head,
      detached: !repo.currentBranch(),
      merging: fs.exists(repo.p('MERGE_HEAD')),
      branches,
      tags: Object.fromEntries([...repo.tags()].map(([k, v]) => [k, repo.peel(v)])),
      remotes,
      upstream,
      remoteBranches: Object.fromEntries(repo.remoteBranches()),
      commits: head || Object.keys(branches).length ? commitFacts(repo, [...new Set([head, ...Object.values(branches)].filter(Boolean) as string[])]) : [],
      status,
      index,
      identity: repo.identity(false),
    };
  });
  const forge = ForgeProject.list(fs).map((project) => {
    const p = new ForgeProject(fs, project);
    const s = p.state();
    const branches = Object.fromEntries(p.repo.branches());
    return {
      project,
      branches,
      tags: Object.fromEntries([...p.repo.tags()].map(([k, v]) => [k, p.repo.peel(v)])),
      commits: Object.keys(branches).length ? commitFacts(p.repo, Object.values(branches)) : [],
      mrs: s.mrs,
      variables: s.variables.map((v) => ({ key: v.key, protected: v.protected, masked: v.masked })),
      deployments: s.deployments,
      registry: s.registry,
    };
  });
  return { repos, forge };
}

export const gitFactsProvider: FactsProvider = { scope: 'git', collect: gitFacts };
export const gitSetupHook: SetupHook = { key: 'git', apply: applyGitSetup };

export type GitFacts = ReturnType<typeof gitFacts>;
export type RepoFact = GitFacts['repos'][number];
export type ForgeFact = GitFacts['forge'][number];

/** Facts helper for checks: the repository at `path`. */
export function repoFact(facts: Record<string, unknown>, path: string): RepoFact | undefined {
  return (facts.git as GitFacts | undefined)?.repos.find((r) => r.path === path);
}

export function forgeFact(facts: Record<string, unknown>, project: string): ForgeFact | undefined {
  return (facts.git as GitFacts | undefined)?.forge.find((r) => r.project === project);
}
