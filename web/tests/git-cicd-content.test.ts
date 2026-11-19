// Every lab of the Git and CI/CD blocks is solvable: a reference solution runs
// on the simulator and every goal passes; a known mistake triggers its hint.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { Lesson, Task, TerminalSection, DocsSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';

function lab(lessonId: string, sectionId: string): { setup: TerminalSetup; tasks: Task[] } {
  const l = registry.lessons.get(lessonId) as Lesson;
  const s = l.sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}

async function machine(setup: TerminalSetup): Promise<SimMachine> {
  return createSimMachine(setup);
}

function write(m: SimMachine, path: string, text: string): void {
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
}

async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) {
    const r = await m.exec(l);
    out += r.out;
  }
  return out;
}

async function passes(m: SimMachine, task: Task): Promise<boolean> {
  return evaluateCheck(task.check, await m.facts()).pass;
}

const SITE = '/home/learner/site';

describe('git-yaml labs', () => {
  it('repo lab', async () => {
    const { setup, tasks } = lab('git-yaml.repo', 'lab');
    const m = await machine(setup);
    await sh(m, 'git config --global user.name "Ada"', 'git config --global user.email ada@example.com');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'git init');
    expect(await passes(m, tasks[1])).toBe(true);
    await sh(m, 'git add .', 'git commit -m all');
    expect(await passes(m, tasks[2])).toBe(false);
    expect(evaluateCheck(tasks[2].check, await m.facts()).say).toBeDefined();
    const m2 = await machine(setup);
    await sh(m2, 'git config --global user.name "Ada"', 'git config --global user.email ada@example.com', 'git init', 'git add index.html', 'git commit -m "Add the home page"');
    expect(await passes(m2, tasks[2])).toBe(true);
    write(m2, `${SITE}/index.html`, (await sh(m2, 'cat index.html')).replace('<h1>Edu Cafe</h1>', '<h1>Edu Cafe — open daily</h1>'));
    await sh(m2, 'git add index.html');
    expect(evaluateCheck(tasks[3].check, await m2.facts()).say).toBeDefined();
    await sh(m2, 'git add about.html', 'git commit -m "Open daily, add About"');
    expect(await passes(m2, tasks[3])).toBe(true);
    await sh(m2, 'git log --oneline');
    expect(await passes(m2, tasks[4])).toBe(true);
  });

  it('branches and conflict labs', async () => {
    const { setup, tasks } = lab('git-yaml.branches', 'lab');
    const m = await machine(setup);
    await sh(m, 'git switch -c contacts', 'echo "<h1>Contacts</h1>" > contacts.html', 'git add contacts.html', 'git commit -m contacts');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'git switch main', 'git merge contacts');
    expect(await passes(m, tasks[1])).toBe(true);
    await sh(m, 'git log --oneline --graph --all');
    expect(await passes(m, tasks[2])).toBe(true);
    const c = lab('git-yaml.branches', 'conflict');
    const m2 = await machine(c.setup);
    const out = await sh(m2, 'git merge team-text');
    expect(out).toContain('CONFLICT');
    expect(evaluateCheck(c.tasks[0].check, await m2.facts()).say).toBeDefined();
    write(m2, `${SITE}/about.html`, '<!doctype html>\n<title>About</title>\n<h1>About us</h1>\n<p>We are a small team of baristas.</p>\n<p>Open daily 8–20.</p>\n');
    await sh(m2, 'git add about.html', 'git commit');
    expect(await passes(m2, c.tasks[0])).toBe(true);
  });

  it('ignore lab and the forcing task', async () => {
    const { setup, tasks } = lab('git-yaml.ignore', 'lab');
    const m = await machine(setup);
    write(m, `${SITE}/.gitignore`, 'node_modules/\ndist/\n*.log\n.env\n');
    await sh(m, 'git add .gitignore .env.example', 'git commit -m "Ignore local files"');
    expect(await passes(m, tasks[0])).toBe(true);
    const f = lab('git-yaml.ignore', 'forcing');
    const m2 = await machine(f.setup);
    await sh(m2, 'git log --oneline -- about.html');
    expect(await passes(m2, f.tasks[0])).toBe(true);
    await sh(m2, 'git log --oneline');
    expect(await passes(m2, f.tasks[0])).toBe(false);
  });

  it('yaml lab', async () => {
    const { setup, tasks } = lab('git-yaml.yaml', 'lab');
    const m = await machine(setup);
    expect((await m.exec('yamllint menu.yaml site.yaml team.yaml')).exit).toBe(1);
    write(m, '/home/learner/cfg/menu.yaml', '---\nmenu:\n  - name: espresso\n    price: 2.5\n  - name: latte\n    price: 3.5\n');
    write(m, '/home/learner/cfg/site.yaml', '---\nsite:\n  name: edu-cafe\n  port: 8080\n');
    write(m, '/home/learner/cfg/team.yaml', '---\nteam:\n  lead: Ada\n');
    expect((await m.exec('yamllint menu.yaml site.yaml team.yaml')).exit).toBe(0);
    expect(await passes(m, tasks[0])).toBe(true);
  });
});

describe('cicd labs', () => {
  it('remote lab', async () => {
    const { setup, tasks } = lab('cicd.remote', 'lab');
    const m = await machine(setup);
    await sh(m, 'git remote add origin https://forge.edu/team/site.git', 'git push -u origin main');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'git switch -c feature/hours', 'echo "<h1>Hours</h1>" > hours.html', 'git add hours.html', 'git commit -m "Add hours"', 'git push -u origin feature/hours', 'glab mr create -s feature/hours -b main -t "Add opening hours"');
    expect(await passes(m, tasks[1])).toBe(true);
    await sh(m, 'glab mr merge 1', 'git switch main', 'git pull');
    expect(await passes(m, tasks[2])).toBe(true);
    const r = lab('cicd.remote', 'reject');
    const m2 = await machine(r.setup);
    await sh(m2, 'echo "<p>New text</p>" >> about.html', 'git commit -am "Edit about"');
    expect((await m2.exec('git push')).exit).toBe(1);
    await sh(m2, 'git pull', 'git push');
    expect(await passes(m2, r.tasks[0])).toBe(true);
  });

  it('first pipeline lab', async () => {
    const { setup, tasks } = lab('cicd.first-pipeline', 'lab');
    const m = await machine(setup);
    write(m, `${SITE}/.gitlab-ci.yml`, 'test:\n  image: alpine:3.22\n  script:\n    - ./test.sh\n');
    expect((await m.exec('glab ci lint')).exit).toBe(0);
    await sh(m, 'git add .gitlab-ci.yml', 'git commit -m "Add CI"', 'git push');
    expect(await passes(m, tasks[0])).toBe(true);
    write(m, `${SITE}/.gitlab-ci.yml`, 'stages: [build, test]\n\nbuild:\n  stage: build\n  image: alpine:3.22\n  script:\n    - ./build.sh\n\ntest:\n  stage: test\n  image: alpine:3.22\n  script:\n    - ./test.sh\n\nlint:\n  stage: test\n  image: alpine:3.22\n  script:\n    - ./lint.sh\n');
    await sh(m, 'git commit -am "Stages"', 'git push');
    expect(await passes(m, tasks[1])).toBe(true);
    write(m, `${SITE}/src/menu.html`, '<p>Espresso 2.50</p>\n');
    await sh(m, 'git add src/menu.html', 'git commit -m "Add menu"', 'git push');
    expect(evaluateCheck(tasks[2].check, await m.facts()).pass).toBe(false);
    expect(evaluateCheck(tasks[2].check, await m.facts()).say).toBeDefined();
    write(m, `${SITE}/src/menu.html`, '<title>Menu</title>\n<h1>Menu</h1>\n<p>Espresso 2.50</p>\n');
    await sh(m, 'git commit -am "Fix the menu page"', 'git push');
    expect(await passes(m, tasks[2])).toBe(true);
  });

  it('artifacts and cache lab', async () => {
    const { setup, tasks } = lab('cicd.artifacts-cache', 'lab');
    const m = await machine(setup);
    await sh(m, 'git commit --allow-empty -m "Run CI"', 'git push');
    expect(await passes(m, tasks[0])).toBe(false);
    const ci = (await sh(m, 'cat .gitlab-ci.yml')).replace('    - npm run build\n', '    - npm run build\n  artifacts:\n    paths: [dist/]\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am "Pass dist on"', 'git push');
    expect(await passes(m, tasks[0])).toBe(true);
    write(m, `${SITE}/.gitlab-ci.yml`, ci.replace('  artifacts:\n', '  cache:\n    key: npm-$CI_COMMIT_REF_SLUG\n    paths: [.npm/]\n  artifacts:\n'));
    await sh(m, 'git commit -am "Cache npm"', 'git push', 'git commit --allow-empty -m again', 'git push');
    expect(await passes(m, tasks[1])).toBe(true);
    write(m, `${SITE}/.gitlab-ci.yml`, ci.replace('    paths: [dist/]\n', '    paths: [dist/]\n    expire_in: 1 week\n'));
    await sh(m, 'git commit -am "Expire"', 'git push');
    expect(await passes(m, tasks[2])).toBe(true);
  });

  it('variables and environments lab', async () => {
    const { setup, tasks } = lab('cicd.variables-envs', 'lab');
    const m = await machine(setup);
    await sh(m, 'git commit --allow-empty -m first', 'git push');
    expect(evaluateCheck(tasks[0].check, await m.facts()).say).toBeDefined();
    await sh(m, 'glab variable set DEPLOY_TOKEN edu-deploy-7Kq2 --masked --protected', 'git commit --allow-empty -m again', 'git push');
    expect(await passes(m, tasks[0])).toBe(true);
    const ci = (await sh(m, 'cat .gitlab-ci.yml')).replace('    - ./deploy.sh production\n  environment: production\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n', '    - ./deploy.sh production\n  environment: production\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n      when: manual\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am "Manual production"', 'git push');
    expect(evaluateCheck(tasks[1].check, await m.facts()).say).toBeDefined();
    await sh(m, 'glab ci trigger deploy_production');
    expect(await passes(m, tasks[1])).toBe(true);
  });

  it('rules and needs lab, and the forcing task', async () => {
    const { setup, tasks } = lab('cicd.rules-needs', 'lab');
    const m = await machine(setup);
    let ci = (await sh(m, 'cat .gitlab-ci.yml')).replace('  script:\n    - npm test\n', '  needs: [build]\n  script:\n    - npm test\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am needs', 'git push');
    expect(await passes(m, tasks[0])).toBe(true);
    const checks = "  rules:\n    - if: $CI_PIPELINE_SOURCE == \"merge_request_event\"\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n";
    ci = ci.replace('  image: node:24-alpine\n  script:\n    - npm ci', `  image: node:24-alpine\n${checks}  script:\n    - npm ci`).replace('lint:\n  stage: build\n  image: node:24-alpine\n', `lint:\n  stage: build\n  image: node:24-alpine\n${checks}`).replace('test:\n  stage: test\n  image: node:24-alpine\n', `test:\n  stage: test\n  image: node:24-alpine\n${checks}`).replace('  environment: staging\n', '  environment: staging\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ci);
    await sh(m, 'git commit -am rules', 'git push', 'git switch -c feature/menu', 'git commit --allow-empty -m menu', 'git push -u origin feature/menu', 'glab mr create --fill --target-branch main');
    expect(await passes(m, tasks[0])).toBe(true);
    expect(await passes(m, tasks[1])).toBe(true);
    const f = lab('cicd.rules-needs', 'forcing');
    const m2 = await machine(f.setup);
    const ci2 = (await sh(m2, 'cat .gitlab-ci.yml')).replace('    - ./lint.sh\n', '    - ./lint.sh\n  allow_failure: true\n');
    write(m2, `${SITE}/.gitlab-ci.yml`, ci2);
    await sh(m2, 'git commit -am "lint may fail"', 'git push');
    expect(await passes(m2, f.tasks[0])).toBe(true);
  });

  it('placement tasks are solvable', async () => {
    const b = registry.blocks.get('cicd')!;
    const t = b.placement.find((p) => p.id === 'cicd.place.stuck')!;
    if (t.kind !== 'task') throw new Error('task expected');
    const m = await machine(t.setup);
    write(m, `${SITE}/.gitlab-ci.yml`, 'test:\n  image: alpine:3.22\n  tags: [docker]\n  script: [./test.sh]\n');
    await sh(m, 'git commit -am "Fix the runner tag"', 'git push');
    expect(await passes(m, t.task)).toBe(true);
  });
});
