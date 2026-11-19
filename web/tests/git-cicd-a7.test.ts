// The new Git/CI content is solvable: the A7 lab (a pipeline that deploys to
// the kube-lite cluster), the new documentation-ladder tasks, both block
// exams; plus the engine pieces they need (File-type variables, the job's
// access to the learner's cluster, images built from a Dockerfile base) and
// the numbers of the new explainers.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { DocsSection, Exam, Facts, Lesson, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import { A7_GOOD_CI } from '../src/blocks/git-cicd/content/cicd-k8s';
import { artNumbers, artifactsModel, dagModel, dagTimes, kubeDeployModel, mergeKind, mergeModel } from '../src/blocks/git-cicd/explainers-flow';
import { lookupImage } from '../src/engine/kube-lite/images';

const SITE = '/home/learner/site';

function lab(lessonId: string, sectionId: string): { setup: TerminalSetup; tasks: Task[] } {
  const l = registry.lessons.get(lessonId) as Lesson;
  const s = l.sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}

function write(m: SimMachine, path: string, text: string): void {
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
}

async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) out += stripAnsi((await m.exec(l)).out);
  return out;
}

const check = async (m: SimMachine, t: Task, start?: Facts) => evaluateCheck(t.check, await m.facts(), start);
const passes = async (m: SimMachine, t: Task, start?: Facts) => (await check(m, t, start)).pass;
const k8sWeb = (f: Facts) => (f.k8s as { deployments: { ns: string; name: string; image: string }[] }).deployments.find((d) => d.ns === 'staging' && d.name === 'web');

describe('engine: File variables and the cluster of the learner', () => {
  it('glab stores a File variable from stdin and the runner hands the job a path', async () => {
    const { setup } = lab('cicd-k8s.deploy', 'lab');
    const m = await createSimMachine(setup);
    const out = await sh(m, 'glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig', 'glab variable list');
    expect(out).toContain('(file)');
    expect(out).toMatch(/KUBECONFIG\tfile\ttrue\tfalse\t\(file contents\)/);
    write(m, `${SITE}/.gitlab-ci.yml`, 'show:\n  image: alpine:3.22\n  script:\n    - echo "$KUBECONFIG"\n    - cat "$KUBECONFIG"\n');
    await sh(m, 'git commit -am show', 'git push');
    const log = await sh(m, 'glab ci trace show');
    expect(log).toContain('/builds/team/site.tmp/KUBECONFIG');
    expect(log).toContain('current-context: deployer@staging');
    expect((await m.exec('glab variable set X --type yaml v')).exit).toBe(1);
  });

  it('an image pushed by a job runs in kube-lite like the base of its Dockerfile', async () => {
    const { setup } = lab('cicd-k8s.deploy', 'lab');
    const m = await createSimMachine(setup);
    write(m, `${SITE}/.gitlab-ci.yml`, A7_GOOD_CI);
    await sh(m, 'glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig', 'git commit -am good', 'git push');
    const f = await m.facts();
    const img = k8sWeb(f)!.image;
    expect(img).toMatch(/^registry\.forge\.edu\/team\/site:[0-9a-f]{8}$/);
    expect(lookupImage(img)?.body).toContain(`version ${img.split(':')[1]}`);
    expect(await sh(m, 'kubectl get pods')).toMatch(/Running/);
  });
});

describe('A7 — deploying to Kubernetes from CI', () => {
  it('the lab is solvable and the known mistakes get their explanations', async () => {
    const { setup, tasks } = lab('cicd-k8s.deploy', 'lab');
    const m = await createSimMachine(setup);
    await sh(m, 'git commit --allow-empty -m deploy', 'git push');
    expect(await sh(m, 'glab ci trace deploy_staging')).toContain('localhost:8080');
    let r = await check(m, tasks[0]);
    expect(r.pass).toBe(false);
    expect(r.say).toBeDefined();
    // An ordinary variable: kubectl gets the text instead of a path.
    await sh(m, 'glab variable set KUBECONFIG --protected < ~/deployer.kubeconfig', 'git commit --allow-empty -m again', 'git push');
    r = await check(m, tasks[0]);
    expect(r.pass).toBe(false);
    expect(r.say?.en).toContain('File');
    await sh(m, 'glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig', 'git commit --allow-empty -m again', 'git push');
    expect(await passes(m, tasks[0])).toBe(true);

    // latest: green, unchanged, old version.
    expect(await sh(m, 'glab ci trace deploy_staging')).toContain('unchanged');
    r = await check(m, tasks[1]);
    expect(r.pass).toBe(false);
    expect(r.say).toBeDefined();
    let ciText = (await sh(m, 'cat .gitlab-ci.yml'))
      .replace(/\$CI_REGISTRY_IMAGE:latest/g, '$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA')
      .replace('    - kubectl apply -f k8s/\n', '    - kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ciText);
    await sh(m, 'git commit -am "Deploy the commit tag"', 'git push');
    expect(await passes(m, tasks[1])).toBe(true);

    // The crashing base without a wait: green job, a hint.
    write(m, `${SITE}/Dockerfile`, 'FROM trainer/web:2.0\nCOPY src/ /usr/share/web/\n');
    await sh(m, 'git commit -am "Move to web 2.0"', 'git push');
    r = await check(m, tasks[2]);
    expect(r.pass).toBe(false);
    expect(r.say?.en).toContain('rollout status');
    // A wait but no rollback: red, broken version stays, a hint.
    ciText = ciText.replace('web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n', 'web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n    - kubectl rollout status deployment/web --timeout=120s\n');
    write(m, `${SITE}/.gitlab-ci.yml`, ciText);
    await sh(m, 'git commit -am "Wait for the rollout"', 'git push');
    r = await check(m, tasks[2]);
    expect(r.pass).toBe(false);
    expect(r.say?.en).toContain('on_failure');
    // The rollback job.
    ciText = ciText.replace('stages: [build, deploy]', 'stages: [build, deploy, rollback]') + '\nrollback_staging:\n  stage: rollback\n  image: bitnami/kubectl:1.34\n  when: on_failure\n  script:\n    - kubectl rollout undo deployment/web\n';
    write(m, `${SITE}/.gitlab-ci.yml`, ciText);
    await sh(m, 'git commit -am "Roll back a failed rollout"', 'git push');
    expect(await passes(m, tasks[2])).toBe(true);
    expect(await sh(m, 'glab ci status')).toContain('rollback_staging');
  }, 60_000);

  it('a committed kubeconfig is reported as leaked', async () => {
    const { setup, tasks } = lab('cicd-k8s.deploy', 'lab');
    const m = await createSimMachine(setup);
    await sh(m, 'cp ~/deployer.kubeconfig kubeconfig', 'git add kubeconfig', 'git commit -m "Add the key"', 'git push');
    const r = await check(m, tasks[0]);
    expect(r.pass).toBe(false);
    expect(r.say?.en).toContain('history');
  });

  it('the forcing task: resource_group', async () => {
    const { setup, tasks } = lab('cicd-k8s.deploy', 'forcing');
    const m = await createSimMachine(setup);
    await sh(m, 'git commit --allow-empty -m deploy', 'git push');
    expect(await passes(m, tasks[0])).toBe(false);
    write(m, `${SITE}/.gitlab-ci.yml`, A7_GOOD_CI.replace('  environment: staging\n', '  environment: staging\n  resource_group: staging\n'));
    await sh(m, 'git commit -am "One deploy at a time"', 'git push');
    expect(await passes(m, tasks[0])).toBe(true);
  });

  it('the placement task is solvable', async () => {
    const b = registry.blocks.get('cicd-k8s')!;
    const t = b.placement.find((p) => p.id === 'cicd-k8s.place.tag')!;
    if (t.kind !== 'task') throw new Error('task expected');
    const m = await createSimMachine(t.setup);
    write(m, `${SITE}/.gitlab-ci.yml`, A7_GOOD_CI);
    await sh(m, 'git commit -am "Commit tags"', 'git push');
    expect(await passes(m, t.task)).toBe(true);
  });

  it('the block comes after the first Kubernetes stage', () => {
    const ids = registry.orderedLessons().map((l) => l.id);
    expect(ids.indexOf('cicd-k8s.deploy')).toBeGreaterThan(ids.indexOf('k8s-1.deployments'));
    expect(ids.indexOf('cicd-k8s.deploy')).toBeGreaterThan(ids.indexOf('cicd.rules-needs'));
  });
});

describe('new documentation-ladder tasks', () => {
  it('git merge --abort (DL4)', async () => {
    const { setup, tasks } = lab('git-yaml.branches', 'abort');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    expect(await passes(m, tasks[0], start)).toBe(false);
    expect(await sh(m, 'git status')).toContain('Unmerged');
    await sh(m, 'git merge --abort');
    expect(await passes(m, tasks[0], start)).toBe(true);
  });

  it('yamllint --strict (DL3)', async () => {
    const { setup, tasks } = lab('git-yaml.yaml', 'strict');
    const m = await createSimMachine(setup);
    await sh(m, 'yamllint flags.yaml');
    expect(await passes(m, tasks[0])).toBe(false);
    await sh(m, 'yamllint -s flags.yaml');
    expect(await passes(m, tasks[0])).toBe(true);
  });

  it('cache:policy pull (DL4)', async () => {
    const { setup, tasks } = lab('cicd.artifacts-cache', 'forcing');
    const m = await createSimMachine(setup);
    await sh(m, 'git commit --allow-empty -m run', 'git push');
    expect(await passes(m, tasks[0])).toBe(false);
    const ciText = (await sh(m, 'cat .gitlab-ci.yml')).replace(/(test:\n  stage: test\n  image: node:24-alpine\n  cache:\n    key: npm-\$CI_COMMIT_REF_SLUG\n    paths: \[\.npm\/\]\n)/, '$1    policy: pull\n');
    expect(ciText).toContain('policy: pull');
    write(m, `${SITE}/.gitlab-ci.yml`, ciText);
    await sh(m, 'git commit -am "test only pulls the cache"', 'git push');
    expect(await passes(m, tasks[0])).toBe(true);
  });

  it('the new docs sections point at real pages and sections', () => {
    for (const [l, s] of [['git-yaml.branches', 'merge-anatomy'], ['cicd.first-pipeline', 'anatomy'], ['cicd-k8s.deploy', 'anatomy']] as const) {
      const sec = (registry.lessons.get(l) as Lesson).sections.find((x) => x.id === s) as DocsSection;
      expect(registry.corpus.get(sec.ref.page!)?.sections.some((x) => x.id === sec.answer)).toBe(true);
    }
  });
});

async function examTask(exam: Exam, id: string) {
  const t = exam.tasks.find((x) => x.id === id)!;
  if (t.kind !== 'task') throw new Error('task expected');
  const m = await createSimMachine(t.setup);
  return { m, task: t.task, start: await m.facts() };
}

describe('block exams', () => {
  const gy = registry.exams.get('git-yaml.exam.config')!;
  const cd = registry.exams.get('cicd.exam.release')!;

  it('are listed by their blocks and carry DL5 tasks beyond the course', () => {
    expect(registry.blocks.get('git-yaml')!.exam).toBe(gy.id);
    expect(registry.blocks.get('cicd')!.exam).toBe(cd.id);
    for (const ex of [gy, cd]) {
      const beyond = ex.tasks.filter((t) => t.beyond && t.kind === 'task' && t.task.docStep === 5);
      expect(beyond.length).toBeGreaterThan(0);
      const total = ex.tasks.filter((t) => !t.pool || t.id === ex.tasks.find((x) => x.pool === t.pool)!.id).reduce((s, t) => s + t.weight, 0);
      expect(beyond.reduce((s, t) => s + t.weight, 0) / total).toBeGreaterThanOrEqual(0.1);
      expect(ex.tasks.some((t) => t.critical)).toBe(true);
    }
  });

  it('Git and YAML: every card is solvable', async () => {
    let x = await examTask(gy, 'prices');
    expect(await sh(x.m, 'git merge sizes')).toContain('CONFLICT');
    write(x.m, `${SITE}/menu.yaml`, '---\nmenu:\n  - name: espresso\n    price: 2.8\n    size: small\n  - name: latte\n    price: 3.5\n');
    await sh(x.m, 'git add menu.yaml', 'git commit -m "Merge sizes"');
    expect(await passes(x.m, x.task, x.start)).toBe(true);

    x = await examTask(gy, 'traps');
    write(x.m, `${SITE}/site.yaml`, '---\nsite:\n  name: edu-cafe\n  country: "NO"\n  version: "1.10"\n  delivery: true\n');
    expect((await x.m.exec('yamllint -s site.yaml')).exit).toBe(0);
    await sh(x.m, 'git commit -am "Quote the traps"');
    expect(await passes(x.m, x.task, x.start)).toBe(true);

    x = await examTask(gy, 'noff');
    await sh(x.m, 'git merge feature/hours');
    expect(await passes(x.m, x.task, x.start)).toBe(false);
    x = await examTask(gy, 'noff');
    await sh(x.m, 'git merge --no-ff -m "Merge hours" feature/hours');
    expect(await passes(x.m, x.task, x.start)).toBe(true);

    x = await examTask(gy, 'amend');
    await sh(x.m, 'git commit --allow-empty -m "Update menu prices"');
    expect(await passes(x.m, x.task, x.start)).toBe(false);
    x = await examTask(gy, 'amend');
    await sh(x.m, 'git commit --amend -m "Update menu prices"');
    expect(await passes(x.m, x.task, x.start)).toBe(true);
  });

  it('CI/CD: every card is solvable', async () => {
    let x = await examTask(cd, 'mr');
    const checks = '  rules:\n    - if: $CI_PIPELINE_SOURCE == "merge_request_event"\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n';
    write(x.m, `${SITE}/.gitlab-ci.yml`, `test:\n  image: alpine:3.22\n${checks}  script:\n    - ./test.sh\n\nlint:\n  image: alpine:3.22\n${checks}  script:\n    - ./lint.sh\n`);
    await sh(x.m, 'git add .gitlab-ci.yml', 'git commit -m "Checks on merge requests"', 'git push', 'git switch -c feature/menu', 'git commit --allow-empty -m menu', 'git push -u origin feature/menu', 'glab mr create --fill --target-branch main');
    expect(await passes(x.m, x.task, x.start)).toBe(true);

    x = await examTask(cd, 'artifact');
    await sh(x.m, 'git commit --allow-empty -m run', 'git push');
    expect(await passes(x.m, x.task, x.start)).toBe(false);
    write(x.m, `${SITE}/.gitlab-ci.yml`, (await sh(x.m, 'cat .gitlab-ci.yml')).replace('    - npm run build\n', '    - npm run build\n  artifacts:\n    paths: [dist/]\n'));
    await sh(x.m, 'git commit -am "Pass dist on"', 'git push');
    expect(await passes(x.m, x.task, x.start)).toBe(true);

    x = await examTask(cd, 'stuck');
    write(x.m, `${SITE}/.gitlab-ci.yml`, (await sh(x.m, 'cat .gitlab-ci.yml')).replace('tags: [dokcer]', 'tags: [docker]'));
    await sh(x.m, 'git commit -am "Fix the runner tag"', 'git push');
    expect(await passes(x.m, x.task, x.start)).toBe(true);

    x = await examTask(cd, 'release');
    const rel = (await sh(x.m, 'cat .gitlab-ci.yml')).replace('    - ./deploy.sh production\n  environment: production\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n', '    - ./deploy.sh production\n  environment: production\n  rules:\n    - if: $CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/\n      when: manual\n');
    expect(rel).toContain('CI_COMMIT_TAG');
    write(x.m, `${SITE}/.gitlab-ci.yml`, rel);
    await sh(x.m, 'glab variable set DEPLOY_TOKEN edu-deploy-7Kq2 --masked --protected', 'git commit -am "Production from tags by hand"', 'git push');
    let r = await check(x.m, x.task, x.start);
    expect(r.pass).toBe(false);
    expect(r.say).toBeDefined();
    await sh(x.m, 'git tag v1.0.0', 'git push origin v1.0.0');
    expect(await passes(x.m, x.task, x.start)).toBe(true);

    x = await examTask(cd, 'default');
    const dflt = (await sh(x.m, 'cat .gitlab-ci.yml')).replace(/  image: node:24-alpine\n/g, '').replace('stages: [build, test]\n', 'stages: [build, test]\n\ndefault:\n  image: node:24-alpine\n');
    write(x.m, `${SITE}/.gitlab-ci.yml`, dflt);
    await sh(x.m, 'git commit -am "One image for all jobs"', 'git push');
    r = await check(x.m, x.task, x.start);
    expect(r.pass).toBe(true);
  }, 60_000);
});

describe('the new explainers', () => {
  it('merge: fast-forward, merge commit, conflict, refusal', () => {
    const none = new Set<string>();
    expect(mergeKind({ mainMoved: false, noFf: false }, none)).toBe('ff');
    expect(mergeKind({ mainMoved: true, noFf: false }, none)).toBe('commit');
    expect(mergeKind({ mainMoved: false, noFf: true }, none)).toBe('commit');
    expect(mergeKind({ mainMoved: false, noFf: false }, new Set(['same-lines']))).toBe('conflict');
    const steps = mergeModel.run({ mainMoved: true, noFf: false }, none);
    expect(steps[steps.length - 1].metrics).toEqual({ created: 1, parents: 2, conflicts: 0 });
    expect(mergeModel.run({ mainMoved: false, noFf: false }, new Set(['dirty'])).some((s) => s.broken?.message.includes('would be overwritten'))).toBe(true);
  });

  it('artifacts and cache: a miss only slows down', () => {
    expect(artNumbers({ key: 'branch', lockChanged: true, otherRunner: false })).toEqual({ hit: true, npm2: 9 });
    expect(artNumbers({ key: 'lock', lockChanged: true, otherRunner: false })).toEqual({ hit: false, npm2: 52 });
    expect(artNumbers({ key: 'branch', lockChanged: false, otherRunner: true }).hit).toBe(false);
    const miss = artifactsModel.run({ key: 'lock', lockChanged: true, otherRunner: false }, new Set());
    expect(miss.some((s) => s.broken)).toBe(false);
    expect(artifactsModel.run({ key: 'branch', lockChanged: false, otherRunner: false }, new Set(['dist-in-cache'])).some((s) => s.broken?.at === 'deploy')).toBe(true);
  });

  it('stages and needs: needs shorten the pipeline only with free runners', () => {
    const stairs = dagTimes({ needs: false, lint: 90, runners: 2 });
    const graph = dagTimes({ needs: true, lint: 90, runners: 2 });
    expect(stairs.test[0]).toBe(90);
    expect(graph.test[0]).toBe(20);
    expect(graph.deploy[1]).toBeLessThan(stairs.deploy[1]);
    expect(dagTimes({ needs: true, lint: 90, runners: 1 }).test[0]).toBeGreaterThan(20);
    expect(dagModel.run({ needs: true, lint: 90, runners: 2 }, new Set(['needs-excluded'])).some((s) => s.broken?.message.includes('does not exist in the pipeline'))).toBe(true);
  });

  it('deploy to Kubernetes: latest changes nothing, a wait turns a crash red, pull needs no key', () => {
    const none = new Set<string>();
    const metricsOf = (p: { mode: string; tag: string; wait: boolean }, b = none) => {
      const s = kubeDeployModel.run(p, b);
      return s[s.length - 1].metrics;
    };
    expect(metricsOf({ mode: 'push', tag: 'sha', wait: true })).toEqual({ newPods: 3, oldPods: 0, jobOk: 1 });
    expect(metricsOf({ mode: 'push', tag: 'latest', wait: true })?.newPods).toBe(0);
    expect(metricsOf({ mode: 'push', tag: 'sha', wait: true }, new Set(['crash']))?.jobOk).toBe(0);
    expect(metricsOf({ mode: 'push', tag: 'sha', wait: false }, new Set(['crash']))?.jobOk).toBe(1);
    expect(kubeDeployModel.run({ mode: 'pull', tag: 'sha', wait: true }, none).some((s) => s.focus.includes('e-key'))).toBe(false);
  });
});
