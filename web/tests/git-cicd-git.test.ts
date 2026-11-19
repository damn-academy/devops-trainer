import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { gitCommand } from '../src/blocks/git-cicd/git/cli';
import { diffLines, merge3, unifiedHunks } from '../src/blocks/git-cicd/git/diff';
import { isIgnored, parseIgnore } from '../src/blocks/git-cicd/git/ignore';
import { gitFactsProvider, gitSetupHook, repoFact, forgeFact } from '../src/blocks/git-cicd/git/setup';
import { objectId, sha1 } from '../src/blocks/git-cicd/git/sha1';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, gitCommand]) reg.commands.add(c);
reg.facts.push(gitFactsProvider);
reg.setup.push(gitSetupHook);

const ID = { identity: { name: 'Ada', email: 'ada@example.com' }, config: { 'init.defaultBranch': 'main', 'pull.rebase': 'false' } };
const mk = (ext?: Record<string, unknown>) => createSimMachine({ ext: ext ?? { git: ID } }, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

describe('sha1 and objects', () => {
  it('matches known digests', () => {
    expect(sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    // `printf 'hello\n' | git hash-object --stdin`
    expect(objectId('blob', 'hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
});

describe('diff and merge', () => {
  it('diffs lines and prints hunks', () => {
    const ops = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(ops.map((o) => o.kind)).toEqual(['eq', 'del', 'add', 'eq']);
    expect(unifiedHunks('a\nb\nc\n', 'a\nx\nc\n')).toBe('@@ -1,3 +1,3 @@\n a\n-b\n+x\n c\n');
  });
  it('merges separate edits and conflicts on the same line', () => {
    const base = 'one\ntwo\nthree\nfour\nfive\n';
    expect(merge3(base, 'ONE\ntwo\nthree\nfour\nfive\n', 'one\ntwo\nthree\nfour\nFIVE\n', { ours: 'HEAD', theirs: 'f' })).toEqual({ text: 'ONE\ntwo\nthree\nfour\nFIVE\n', conflicts: 0 });
    const r = merge3(base, 'one\nTWO\nthree\nfour\nfive\n', 'one\nzwei\nthree\nfour\nfive\n', { ours: 'HEAD', theirs: 'feature' });
    expect(r.conflicts).toBe(1);
    expect(r.text).toBe('one\n<<<<<<< HEAD\nTWO\n=======\nzwei\n>>>>>>> feature\nthree\nfour\nfive\n');
  });
});

describe('gitignore', () => {
  it('follows gitignore(5)', () => {
    const r = parseIgnore('node_modules/\n*.log\n/build\n!keep.log\nsecret/**\n');
    expect(isIgnored(r, 'node_modules/x/y.js')).toBe(true);
    expect(isIgnored(r, 'app.log')).toBe(true);
    expect(isIgnored(r, 'logs/app.log')).toBe(true);
    expect(isIgnored(r, 'keep.log')).toBe(false);
    expect(isIgnored(r, 'build')).toBe(true);
    expect(isIgnored(r, 'src/build')).toBe(false);
    expect(isIgnored(r, 'secret/a/b')).toBe(true);
    expect(isIgnored(r, 'index.html')).toBe(false);
  });
});

describe('git porcelain', () => {
  it('asks for an identity before the first commit', async () => {
    const m = await mk({});
    await run(m, 'mkdir site && cd site && git init -b main');
    await run(m, 'echo hi > a.txt && git add a.txt');
    const r = await run(m, 'git commit -m first');
    expect(r.exit).toBe(128);
    expect(r.out).toContain('Author identity unknown');
  });

  it('init, add, commit, status, log', async () => {
    const m = await mk();
    expect((await run(m, 'mkdir site && cd site && git init')).out).toContain('Initialized empty Git repository in /home/learner/site/.git/');
    await run(m, 'echo "<h1>Hi</h1>" > index.html');
    await run(m, 'echo todo > notes.txt');
    let s = await run(m, 'git status');
    expect(s.out).toContain('No commits yet');
    expect(s.out).toContain('Untracked files:');
    await run(m, 'git add index.html');
    s = await run(m, 'git status --short');
    expect(s.out).toBe('A  index.html\n?? notes.txt\n');
    const c = await run(m, 'git commit -m "Add index page"');
    expect(c.out).toMatch(/^\[main \(root-commit\) [0-9a-f]{7}\] Add index page\n 1 file changed, 1 insertion\(\+\)\n create mode 100644 index.html\n$/);
    await run(m, 'echo "<h1>Hello</h1>" > index.html');
    s = await run(m, 'git status');
    expect(s.out).toContain('modified:   index.html');
    const d = await run(m, 'git diff');
    expect(d.out).toContain('-<h1>Hi</h1>\n+<h1>Hello</h1>');
    await run(m, 'git commit -am "Say hello"');
    const log = await run(m, 'git log --oneline');
    expect(log.out).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) Say hello\n[0-9a-f]{7} Add index page\n$/);
    const f = await m.facts();
    const repo = repoFact(f, '/home/learner/site')!;
    expect(repo.commits.length).toBe(2);
    expect(repo.commits[0].files['index.html']).toBe('<h1>Hello</h1>\n');
    expect(repo.status.untracked).toEqual(['notes.txt']);
  });

  it('branches, fast-forward, merge commit and conflict', async () => {
    const m = await mk();
    await run(m, 'mkdir s && cd s && git init');
    await run(m, 'echo "title" > about.html && git add . && git commit -m base');
    await run(m, 'git switch -c feature');
    await run(m, 'echo contacts > contacts.html && git add contacts.html && git commit -m contacts');
    await run(m, 'git switch main');
    expect((await run(m, 'git merge feature')).out).toContain('Fast-forward');
    // Diverge: both sides edit about.html.
    await run(m, 'git switch -c other');
    await run(m, 'echo "their title" > about.html && git commit -am theirs');
    await run(m, 'git switch main');
    await run(m, 'echo "our title" > about.html && git commit -am ours');
    const r = await run(m, 'git merge other');
    expect(r.exit).toBe(1);
    expect(r.out).toContain('CONFLICT (content): Merge conflict in about.html');
    expect((await run(m, 'cat about.html')).out).toBe('<<<<<<< HEAD\nour title\n=======\ntheir title\n>>>>>>> other\n');
    expect((await run(m, 'git commit -m x')).exit).toBe(128);
    await run(m, 'echo "our title" > about.html && echo "their title" >> about.html');
    await run(m, 'git add about.html');
    const c = await run(m, 'git commit');
    expect(c.exit).toBe(0);
    const repo = repoFact(await m.facts(), '/home/learner/s')!;
    expect(repo.commits[0].parents.length).toBe(2);
    expect(repo.commits[0].message).toBe("Merge branch 'other'\n\n# Conflicts:\n#\tabout.html");
    const g = await run(m, 'git log --oneline --graph');
    expect(g.out.split('\n')[0]).toMatch(/^\*   [0-9a-f]{7} \(HEAD -> main\) Merge branch 'other'/);
    expect(g.out).toContain('|\\');
    expect(g.out).toContain('|/');
  });

  it('ignores files from .gitignore and refuses to add them', async () => {
    const m = await mk();
    await run(m, 'mkdir p && cd p && git init');
    await run(m, 'echo "*.env" > .gitignore && echo PASS=1 > prod.env && echo x > app.js');
    expect((await run(m, 'git status --short')).out).toBe('?? .gitignore\n?? app.js\n');
    const r = await run(m, 'git add prod.env');
    expect(r.exit).toBe(1);
    expect(r.out).toContain('The following paths are ignored');
  });

  it('pushes to the forge, rejects a non-fast-forward, pulls and merges', async () => {
    const m = await mk({
      git: {
        ...ID,
        forge: [{ project: 'team/site', commits: [{ message: 'Initial site', files: { 'index.html': '<h1>Site</h1>\n' } }], later: [{ message: 'Update footer', files: { 'footer.html': 'footer\n' } }] }],
        repos: [{ path: '~/site', remote: 'team/site' }],
      },
    });
    const cl = await run(m, 'git clone https://forge.edu/team/site.git copy');
    expect(cl.exit).toBe(0);
    expect((await run(m, 'ls copy')).out).toContain('footer.html');
    await run(m, 'cd site && echo about > about.html && git add about.html && git commit -m "Add about"');
    const p = await run(m, 'git push');
    expect(p.exit).toBe(1);
    expect(p.out).toContain('! [rejected]        main -> main (fetch first)');
    const pl = await run(m, 'git pull');
    expect(pl.exit).toBe(0);
    const p2 = await run(m, 'git push');
    expect(p2.exit).toBe(0);
    const f = forgeFact(await m.facts(), 'team/site')!;
    const tip = f.commits.find((c) => c.oid === f.branches.main)!;
    expect(tip.parents.length).toBe(2);
    expect(Object.keys(tip.files).sort()).toEqual(['about.html', 'footer.html', 'index.html']);
    await run(m, 'git switch -c feature/x');
    const p3 = await run(m, 'git push -u origin feature/x');
    expect(p3.out).toContain('* [new branch]      feature/x -> feature/x');
    expect(p3.out).toContain("branch 'feature/x' set up to track 'origin/feature/x'.");
  });

  it('reverts and resets, with a reflog', async () => {
    const m = await mk();
    await run(m, 'mkdir r && cd r && git init');
    await run(m, 'echo 1 > f && git add f && git commit -m one');
    await run(m, 'echo 2 > f && git commit -am two');
    const rv = await run(m, 'git revert HEAD');
    expect(rv.out).toContain('Revert "two"');
    expect((await run(m, 'cat f')).out).toBe('1\n');
    await run(m, 'git reset --hard HEAD~2');
    expect((await run(m, 'git log --oneline')).out.split('\n').filter(Boolean).length).toBe(1);
    expect((await run(m, 'git reflog')).out).toContain('HEAD@{1}: revert: Revert "two"');
    await run(m, 'git reset --hard HEAD@{1}'.replace('HEAD@{1}', (await run(m, 'git reflog')).out.split('\n')[1].slice(0, 7)));
    expect((await run(m, 'cat f')).out).toBe('1\n');
  });
});
