// The undo lesson, rebase and the checks added after the persona walk-through:
// every new lab is solvable on the simulator, and the known mistakes get their hint.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { DocsSection, Lesson, PlacementTask, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import { dagModel } from '../src/blocks/git-cicd/explainers-flow';

function lab(lessonId: string, sectionId: string): { setup: TerminalSetup; tasks: Task[] } {
  const l = registry.lessons.get(lessonId) as Lesson;
  const s = l.sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}
const sh = async (m: SimMachine, ...lines: string[]) => {
  let out = '';
  for (const l of lines) out += stripAnsi((await m.exec(l)).out);
  return out;
};
const check = async (m: SimMachine, t: Task) => evaluateCheck(t.check, await m.facts());

describe('git-yaml.undo', () => {
  it('brings a commit back from the reflog after reset --hard', async () => {
    const { setup, tasks } = lab('git-yaml.undo', 'lab');
    const m = await createSimMachine(setup);
    expect((await check(m, tasks[0])).pass).toBe(false);
    const log = await sh(m, 'git reflog');
    expect(log).toMatch(/HEAD@\{0\}: reset: moving to HEAD~2/);
    expect(log).toMatch(/HEAD@\{2\}: commit: Add the menu/);
    await sh(m, 'git reset --hard HEAD@{1}');
    const r = await check(m, tasks[0]);
    expect(r.pass).toBe(false);
    expect(r.say).toBeDefined();
    await sh(m, 'git reset --hard HEAD~1');
    expect((await check(m, tasks[0])).pass).toBe(true);
  });

  it('reverts a commit from the middle of a shared history', async () => {
    const { setup, tasks } = lab('git-yaml.undo', 'lab-revert');
    const m = await createSimMachine(setup);
    const bad = await createSimMachine(setup);
    await sh(bad, 'git reset --hard HEAD~2');
    expect((await check(bad, tasks[0])).say).toBeDefined();
    const oid = (await sh(m, 'git log --oneline')).split('\n').find((l) => l.includes('Raise the prices'))!.slice(0, 7);
    const out = await sh(m, `git revert ${oid}`);
    expect(out).toContain('Revert "Raise the prices"');
    expect((await check(m, tasks[0])).pass).toBe(true);
  });

  it('keeps a commit made in the detached HEAD state, either way', async () => {
    const { setup, tasks } = lab('git-yaml.undo', 'lab-detached');
    const a = await createSimMachine(setup);
    expect(await sh(a, 'git status')).toContain('HEAD detached at');
    await sh(a, 'git switch -c add-year', 'git switch main');
    expect((await check(a, tasks[0])).pass).toBe(true);
    const b = await createSimMachine(setup);
    const warn = stripAnsi((await b.exec('git switch main')).out);
    expect(warn).toContain('leaving 1 commit behind');
    expect((await check(b, tasks[0])).say).toBeDefined();
    await sh(b, 'git branch add-year HEAD@{1}');
    expect((await check(b, tasks[0])).pass).toBe(true);
  });

  it('the experienced placement accepts the reflog fix', async () => {
    const p = registry.blocks.get('git-yaml')!.placement!.find((x) => x.id === 'git-yaml.place.reflog') as PlacementTask & { kind: 'task' };
    const m = await createSimMachine(p.setup);
    await sh(m, 'git reset --hard HEAD@{2}');
    expect(evaluateCheck(p.task.check, await m.facts()).pass).toBe(true);
  });
});

describe('git rebase in the simulator', () => {
  it('pull --rebase replays a local commit on top of the server history', async () => {
    const { setup, tasks } = lab('cicd.remote', 'reject');
    const m = await createSimMachine(setup);
    await sh(m, 'echo "<p>Hi</p>" >> about.html', 'git commit -am "Greet"');
    expect(await sh(m, 'git push')).toContain('rejected');
    expect(await sh(m, 'git pull --rebase')).toContain('Successfully rebased');
    const log = await sh(m, 'git log --oneline');
    expect(log.split('\n')[0]).toContain('Greet');
    expect(log).not.toContain('Merge');
    await sh(m, 'git push');
    expect((await check(m, tasks[0])).pass).toBe(true);
  });
});

describe('the needs explainer', () => {
  it('ends the pipeline with its last job, the linter included', () => {
    const steps = dagModel.run({ needs: true, lint: 90, runners: 2 }, new Set());
    expect(steps[steps.length - 1].metrics?.total).toBe(90);
    const short = dagModel.run({ needs: true, lint: 10, runners: 2 }, new Set());
    expect(short[short.length - 1].metrics?.total).toBe(65);
  });
});

const SITE = '/home/learner/site';
const write = (m: SimMachine, path: string, text: string) => {
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
};
const placement = (block: string, id: string) => registry.blocks.get(block)!.placement!.find((x) => x.id === id) as PlacementTask & { kind: 'task' };

describe('CI checks added after the walk-through', () => {
  it('a job-level when next to rules gets its own hint', async () => {
    const { setup, tasks } = lab('cicd.variables-envs', 'lab');
    const m = await createSimMachine(setup);
    await sh(m, 'glab variable set DEPLOY_TOKEN edu-deploy-7Kq2 --masked --protected');
    const ci = (await sh(m, 'cat .gitlab-ci.yml')).replace('    - ./deploy.sh production\n', '    - ./deploy.sh production\n  when: manual\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am manual', 'git push');
    const r = await check(m, tasks[1]);
    expect(r.pass).toBe(false);
    expect(r.say?.ru).toContain('на уровне джобы');
  });

  it('a cache key the shell emptied does not count as a key by branch', async () => {
    const { setup, tasks } = lab('cicd.artifacts-cache', 'lab');
    const m = await createSimMachine(setup);
    const ci = (await sh(m, 'cat .gitlab-ci.yml')).replace('  stage: build\n  image: node:24-alpine\n', '  stage: build\n  image: node:24-alpine\n  cache:\n    key: npm-\n    paths: [.npm/]\n').replace('    - npm run build\n', '    - npm run build\n  artifacts:\n    paths: [dist/]\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am cache', 'git push', 'git commit --allow-empty -m again', 'git push');
    const r = await check(m, tasks[1]);
    expect(r.pass).toBe(false);
    expect(r.say?.ru).toContain('CI_COMMIT_REF_SLUG');
  });

  it('a merge request without its own pipeline says so', async () => {
    const { setup, tasks } = lab('cicd.rules-needs', 'lab');
    const m = await createSimMachine(setup);
    const ci = (await sh(m, 'cat .gitlab-ci.yml')).replace('  environment: staging\n', '  environment: staging\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am rules', 'git push', 'git switch -c feature/menu', 'git commit --allow-empty -m menu', 'git push -u origin feature/menu', 'glab mr create --fill --target-branch main');
    expect(await sh(m, 'glab mr view 1')).toContain('(source: push)');
    const r = await check(m, tasks[1]);
    expect(r.pass).toBe(false);
    expect(r.say?.ru).toContain('merge_request_event');
  });

  it('the experienced CI/CD placement task is solvable', async () => {
    const p = placement('cicd', 'cicd.place.mr');
    const m = await createSimMachine(p.setup);
    const checks = '  rules:\n    - if: $CI_PIPELINE_SOURCE == "merge_request_event"\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n';
    const ci = (await sh(m, 'cat .gitlab-ci.yml'))
      .replace('build:\n  stage: build\n  image: node:24-alpine\n', `build:\n  stage: build\n  image: node:24-alpine\n${checks}`)
      .replace('lint:\n  stage: build\n  image: node:24-alpine\n', `lint:\n  stage: build\n  image: node:24-alpine\n${checks}`)
      .replace('test:\n  stage: test\n  image: node:24-alpine\n', `test:\n  stage: test\n  image: node:24-alpine\n  needs: [build]\n${checks}`)
      .replace('  environment: staging\n', '  environment: staging\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am rules', 'git push', 'git switch -c feature/menu', 'git commit --allow-empty -m menu', 'git push -u origin feature/menu', 'glab mr create --fill --target-branch main');
    expect(evaluateCheck(p.task.check, await m.facts()).pass).toBe(true);
  });

  it('the experienced deploy placement task is solvable and the deploy job takes the waited time', async () => {
    const p = placement('cicd-k8s', 'cicd-k8s.place.wait');
    const m = await createSimMachine(p.setup);
    await sh(m, 'git commit --allow-empty -m first', 'git push');
    const ci = (await sh(m, 'cat .gitlab-ci.yml')).replace('web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n', 'web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n    - kubectl rollout status deployment/web --timeout=120s\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am wait', 'git push');
    write(m, `${SITE}/Dockerfile`, 'FROM trainer/web:2.0\nCOPY src/ /usr/share/web/\n');
    await sh(m, 'git commit -am base', 'git push');
    expect(evaluateCheck(p.task.check, await m.facts()).pass).toBe(true);
    const st = await sh(m, 'glab ci status');
    expect(st).toMatch(/failed[^\n]*0[2-9]m \d\ds[^\n]*deploy_staging/);
  });
});
