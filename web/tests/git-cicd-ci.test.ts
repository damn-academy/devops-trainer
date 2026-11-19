import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { gitCommand } from '../src/blocks/git-cicd/git/cli';
import { gitFactsProvider, gitSetupHook } from '../src/blocks/git-cicd/git/setup';
import { glabCommand } from '../src/blocks/git-cicd/ci/glab';
import { ciFactsProvider, lastPipeline } from '../src/blocks/git-cicd/ci/facts';
import { decide, evalIf, parseCi } from '../src/blocks/git-cicd/ci/config';
import { imageExists, setJobBaseRegistry } from '../src/blocks/git-cicd/ci/run';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, gitCommand, glabCommand]) reg.commands.add(c);
reg.facts.push(gitFactsProvider, ciFactsProvider);
reg.setup.push(gitSetupHook);
setJobBaseRegistry(reg);

const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

const SITE = {
  'index.html': '<h1>Site</h1>\n',
  'test.sh': '#!/bin/sh\ngrep -q "<h1>" index.html || exit 1\necho "tests passed"\n',
  'build.sh': '#!/bin/sh\nmkdir -p dist\ncp index.html dist/index.html\necho built\n',
  'package.json': JSON.stringify({ name: 'site', version: '1.0.0', scripts: { test: './test.sh', build: './build.sh' }, dependencies: { express: '^5.1.0' } }) + '\n',
  'package-lock.json': JSON.stringify({ name: 'site', lockfileVersion: 3, packages: { '': { dependencies: { express: '^5.1.0' } } } }) + '\n',
};

const CI = `stages: [build, test, deploy]

build:
  stage: build
  image: node:24-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  cache:
    key: npm-$CI_COMMIT_REF_SLUG
    paths: [.npm/]
  artifacts:
    paths: [dist/]

test:
  stage: test
  image: node:24-alpine
  script:
    - npm test
    - test -f dist/index.html

deploy_staging:
  stage: deploy
  image: alpine:3.22
  script:
    - echo "deploying $CI_COMMIT_SHORT_SHA"
  environment: staging
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy_production:
  stage: deploy
  image: alpine:3.22
  script:
    - echo "release"
  environment: production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
`;

const mk = (files: Record<string, string>) =>
  createSimMachine({ ext: { git: { identity: { name: 'Ada', email: 'ada@example.com' }, config: { 'init.defaultBranch': 'main', 'pull.rebase': 'false' }, forge: [{ project: 'team/site' }], repos: [{ path: '~/site', remote: 'team/site', commits: [{ message: 'Site', files }] }] } } }, { registry: reg });

describe('ci config', () => {
  it('reports GitLab-style errors', () => {
    expect(parseCi('build:\n  stage: biuld\n  script: echo').errors[0].message).toContain('chosen stage biuld does not exist');
    expect(parseCi('build:\n  scirpt: [echo]').errors.map((e) => e.message).join('\n')).toContain('config contains unknown keys: scirpt');
    expect(parseCi('a:\n  script: x\n  needs: [b]').errors[0].message).toContain("'a' job needs 'b' job, but 'b' does not exist");
    expect(parseCi('.tpl:\n  script: x').errors[0].message).toBe('jobs config should contain at least one visible job');
    expect(parseCi('a:\n  script: [x\n').errors[0].message).toMatch(/line \d+/);
  });
  it('resolves extends and default', () => {
    const r = parseCi('default:\n  image: alpine:3.22\n.deploy:\n  stage: deploy\n  script: [./deploy.sh]\nstaging:\n  extends: .deploy\n  environment: staging\n');
    expect(r.errors).toEqual([]);
    const j = r.config!.jobs[0];
    expect([j.name, j.stage, j.image, j.script[0], j.environment?.name]).toEqual(['staging', 'deploy', 'alpine:3.22', './deploy.sh', 'staging']);
  });
  it('evaluates rules:if', () => {
    const env = { CI_COMMIT_BRANCH: 'main', CI_DEFAULT_BRANCH: 'main', CI_COMMIT_TAG: '' };
    expect(evalIf('$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH', env)).toBe(true);
    expect(evalIf('$CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/', { CI_COMMIT_TAG: 'v1.4.0' })).toBe(true);
    expect(evalIf('$CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/', { CI_COMMIT_TAG: 'test-1' })).toBe(false);
    expect(evalIf('$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"', { CI_PIPELINE_SOURCE: 'push', CI_COMMIT_BRANCH: 'main' })).toBe(true);
    expect(evalIf('$UNSET', {})).toBe(false);
    const job = parseCi('docs:\n  script: [x]\n  rules:\n    - changes: [docs/**/*]\n').config!.jobs[0];
    expect(decide(job, { CI_PIPELINE_SOURCE: 'push' }, ['docs/a/b.md']).included).toBe(true);
    expect(decide(job, { CI_PIPELINE_SOURCE: 'push' }, ['src/x.js']).included).toBe(false);
  });
  it('knows images', () => {
    expect(imageExists('node:24-alpine')).toBe(true);
    expect(imageExists('nod:24')).toBe(false);
    expect(imageExists('node:99')).toBe(false);
  });
});

describe('pipeline on push', () => {
  it('runs build → test → deploy with artifacts, cache and a manual gate', async () => {
    const m = await mk({ ...SITE, '.gitlab-ci.yml': CI });
    await run(m, 'cd ~/site && echo "<h1>Site v2</h1>" > index.html && git commit -am "v2"');
    const push = await run(m, 'git push');
    expect(push.exit).toBe(0);
    const f = await m.facts();
    const p = lastPipeline(f, { ref: 'main' })!;
    expect(p.jobs.map((j) => `${j.name}:${j.status}`)).toEqual(['build:success', 'test:success', 'deploy_staging:success', 'deploy_production:manual']);
    // A manual job from rules has allow_failure: false, so the pipeline waits for it.
    expect(p.status).toBe('blocked');
    expect(p.jobs[0].cacheHit).toBe(false);
    expect(p.jobs[0].log).toContain('dist/: found 1 matching artifact files and directories');
    expect(p.jobs[1].log).toContain('tests passed');
    const status = await run(m, 'glab ci status');
    expect(status.out).toContain('(manual)');
    const trig = await run(m, 'glab ci trigger deploy_production');
    expect(trig.out).toContain('deploy_production: success');
    expect(lastPipeline(await m.facts(), { ref: 'main' })!.status).toBe('success');
    // Second push: the cache is warm and npm ci is faster.
    await run(m, 'echo "<h1>Site v3</h1>" > index.html && git commit -am v3 && git push');
    const f2 = await m.facts();
    const p2 = lastPipeline(f2, { ref: 'main' })!;
    expect(p2.jobs[0].cacheHit).toBe(true);
    const d1 = p.jobs[0].end! - p.jobs[0].start!;
    const d2 = p2.jobs[0].end! - p2.jobs[0].start!;
    expect(d2).toBeLessThan(d1);
    const deps = (f2.ci as { deployments: { env: string }[] }).deployments.map((d) => d.env);
    expect(deps).toEqual(['staging', 'production', 'staging']);
  });

  it('fails the job on a non-zero exit and skips the later stages', async () => {
    const m = await mk({ ...SITE, '.gitlab-ci.yml': CI });
    await run(m, 'cd ~/site && echo "no heading" > index.html && git commit -am broken && git push');
    const p = lastPipeline(await m.facts())!;
    expect(p.jobs.find((j) => j.name === 'test')!.status).toBe('failed');
    expect(p.jobs.find((j) => j.name === 'test')!.log).toContain('ERROR: Job failed: exit code 1');
    expect(p.jobs.find((j) => j.name === 'deploy_staging')!.status).toBe('skipped');
    expect(p.status).toBe('failed');
  });

  it('a missing artifact breaks the next job; a missing runner tag leaves it pending', async () => {
    const noArt = CI.replace('  artifacts:\n    paths: [dist/]\n', '');
    const m = await mk({ ...SITE, '.gitlab-ci.yml': noArt });
    await run(m, 'cd ~/site && git commit --allow-empty -m again && git push');
    const p = lastPipeline(await m.facts())!;
    expect(p.jobs.find((j) => j.name === 'test')!.status).toBe('failed');
    const tagged = CI.replace('build:\n  stage: build\n', 'build:\n  stage: build\n  tags: [dokcer]\n');
    const m2 = await mk({ ...SITE, '.gitlab-ci.yml': tagged });
    await run(m2, 'cd ~/site && git commit --allow-empty -m again && git push');
    const p2 = lastPipeline(await m2.facts())!;
    expect(p2.status).toBe('pending');
    expect((await run(m2, 'glab ci status')).out).toContain("any of these tags assigned to them: dokcer");
  });

  it('masks variables and hides protected ones from other branches', async () => {
    const ci = `show:\n  image: alpine:3.22\n  script:\n    - echo "token=$DEPLOY_TOKEN"\n`;
    const m = await mk({ ...SITE, '.gitlab-ci.yml': ci });
    await run(m, 'cd ~/site && glab variable set DEPLOY_TOKEN s3cr3t-t0ken --masked --protected');
    await run(m, 'git commit --allow-empty -m a && git push');
    expect(lastPipeline(await m.facts())!.jobs[0].log).toContain('token=[MASKED]');
    await run(m, 'git switch -c feature && git commit --allow-empty -m b && git push -u origin feature');
    expect(lastPipeline(await m.facts(), { ref: 'feature' })!.jobs[0].log).toContain('token=\n');
  });

  it('lints a local file', async () => {
    const m = await mk({ ...SITE, '.gitlab-ci.yml': 'build:\n  stage: nope\n  script: [x]\n' });
    const r = await run(m, 'cd ~/site && glab ci lint');
    expect(r.exit).toBe(1);
    expect(r.out).toContain('chosen stage nope does not exist');
  });
});
