// Shared bits of the Git and CI/CD content: the training project files, setup
// builders and check helpers over the `git` and `ci` fact scopes.

import type { Facts, TerminalSetup } from '../../../core/types';
import type { GitSetup } from '../git/setup';
import { repoFact, forgeFact, type RepoFact } from '../git/setup';
import { lastPipeline, type CiFacts } from '../ci/facts';

export const HOME = '/home/learner';
export const SITE = `${HOME}/site`;

export const CONFIG = { 'init.defaultBranch': 'main', 'pull.rebase': 'false' };
export const ADA = { name: 'Ada Lovelace', email: 'ada@example.com' };

export const PAGES = {
  'index.html': '<!doctype html>\n<title>Edu Cafe</title>\n<h1>Edu Cafe</h1>\n<p>Coffee and code since 2026.</p>\n',
  'about.html': '<!doctype html>\n<title>About</title>\n<h1>About us</h1>\n<p>We are a small team.</p>\n',
};

/** A plain directory with the site, no repository yet. */
export function siteFiles(): TerminalSetup['files'] {
  return Object.entries(PAGES).map(([p, content]) => ({ path: `${SITE}/${p}`, content }));
}

export function gitSetup(g: GitSetup, extra: Partial<TerminalSetup> = {}): TerminalSetup {
  return { cwd: '~/site', ...extra, ext: { git: { identity: ADA, config: CONFIG, ...g }, ...(extra.ext ?? {}) } };
}

export const repo = (f: Facts, path = SITE): RepoFact | undefined => repoFact(f, path);
export const forge = (f: Facts, project = 'team/site') => forgeFact(f, project);
export const head = (f: Facts, path = SITE) => {
  const r = repo(f, path);
  return r?.commits.find((c) => c.oid === r.head);
};
export const ci = (f: Facts) => f.ci as CiFacts | undefined;
export { lastPipeline };

// ── the project of the CI/CD block ──

export const TEST_SH = '#!/bin/sh\n# The site must have a page title and a heading.\nfor f in src/*.html; do\n  grep -q "<title>" "$f" || { echo "FAIL: $f has no <title>"; exit 1; }\n  grep -q "<h1>" "$f" || { echo "FAIL: $f has no <h1>"; exit 1; }\ndone\necho "OK: all pages have a title and a heading"\n';
export const BUILD_SH = '#!/bin/sh\n# Copy the pages into dist/ and stamp the version.\nmkdir -p dist\ncp src/*.html dist/\necho "$CI_COMMIT_SHORT_SHA" > dist/version.txt\necho "built the site into dist/"\n';
export const LINT_SH = '#!/bin/sh\n# House style: no inline styles in the pages.\nif grep -l "style=" src/*.html; then\n  echo "lint: inline styles found"\n  exit 1\nfi\necho "lint: clean"\n';
export const DEPLOY_SH = '#!/bin/sh\n# Deploy dist/ to an environment of the training cloud.\nenv="$1"\ntest -n "$env" || { echo "usage: deploy.sh ENVIRONMENT"; exit 2; }\ntest -n "$DEPLOY_TOKEN" || { echo "deploy.sh: DEPLOY_TOKEN is not set"; exit 1; }\ntest -f dist/index.html || { echo "deploy.sh: dist/index.html not found (no artifact?)"; exit 1; }\necho "deploying $(cat dist/version.txt) to $env"\necho "done: https://$env.site.edu"\n';

export const PKG = JSON.stringify({ name: 'site', version: '1.0.0', private: true, scripts: { test: './test.sh', build: './build.sh', lint: './lint.sh' }, dependencies: { 'html-minifier-terser': '^7.2.0' } }, null, 2) + '\n';
export const LOCK = JSON.stringify({ name: 'site', version: '1.0.0', lockfileVersion: 3, requires: true, packages: { '': { name: 'site', version: '1.0.0', dependencies: { 'html-minifier-terser': '^7.2.0' } } } }, null, 2) + '\n';

export const PROJECT = {
  'src/index.html': PAGES['index.html'],
  'src/about.html': PAGES['about.html'],
  'test.sh': TEST_SH,
  'build.sh': BUILD_SH,
  'lint.sh': LINT_SH,
  'deploy.sh': DEPLOY_SH,
  'package.json': PKG,
  'package-lock.json': LOCK,
  '.gitignore': 'node_modules/\ndist/\n.npm/\n',
};

/** The project already on the forge and cloned to ~/site. */
export function projectSetup(files: Record<string, string | null> = {}, g: Partial<GitSetup> = {}): TerminalSetup {
  return gitSetup({
    forge: [{ project: 'team/site', ...(g.forge?.[0] ?? {}) }],
    repos: [{ path: '~/site', remote: 'team/site', commits: [{ message: 'Start the site', files: { ...PROJECT, ...files } }] }],
    ...Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'forge')),
  });
}

export const jobOf = (f: Facts, name: string, o: { ref?: string; source?: string } = {}) => lastPipeline(f, o)?.jobs.find((j) => j.name === name);
