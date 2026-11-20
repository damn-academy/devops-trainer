// The cloud lab of the IaC block (blocks/iac/cloudlab): facts of the in-tab
// cloud for checks, state files in object storage, the CI bridge (pipelines
// from .gitlab-ci.yml on push, rules, stages, manual jobs, artifacts) and the
// checks of the lessons on facts recorded from a run. No emulator here: the
// cloud uses the mock VM backend and the runner is scripted.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import type { Facts, Task } from '../src/core/types';
import { Cloud } from '../src/engine/cloud/api';
import { S3Store } from '../src/engine/cloud/s3';
import { MockVmBackend } from '../src/engine/cloud/vm-backend';
import type { HttpRequest } from '../src/engine/labhost/http';
import { objectId, serializeCommit, serializeTree, type GitObject } from '../src/engine/labhost/git/objects';
import { GitServer } from '../src/engine/labhost/git/server';
import { GitStore } from '../src/engine/labhost/git/store';
import { CiBridge, jobScript, type Runner } from '../src/blocks/iac/cloudlab/ci';
import { cloudScope, parseTfState, ruleLine, s3Scope } from '../src/blocks/iac/cloudlab/facts';
import { cloudExam, lessons3 } from '../src/blocks/iac/content-3';
import { parseCi } from '../src/blocks/git-cicd/ci/config';

const enc = new TextEncoder();

function req(method: string, target: string, body?: unknown, auth?: string, from = '10.0.0.10'): HttpRequest {
  const [path, qs] = target.split('?');
  return {
    method,
    target,
    path,
    query: new URLSearchParams(qs ?? ''),
    version: 'HTTP/1.1',
    headers: { 'content-type': 'application/json', host: 'api.cloud.lab', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? new Uint8Array() : enc.encode(JSON.stringify(body)),
    host: 'api.cloud.lab',
    remote: { ip: from, port: 40000 },
    local: { ip: '10.0.0.1', port: 80 },
    vlan: 1,
  };
}

const STATE = JSON.stringify({
  version: 4,
  terraform_version: '1.10.0',
  serial: 3,
  lineage: 'abc',
  outputs: { ip: { value: '10.0.0.21', type: 'string' } },
  resources: [
    { mode: 'data', type: 'lab_images', name: 'all', provider: 'provider["registry.opentofu.org/lab/lab"]', instances: [{ attributes: { id: 'images', names: ['lab-node'] } }] },
    { mode: 'managed', type: 'lab_vm', name: 'web', provider: 'p', instances: [{ attributes: { id: 'vm-1', name: 'web-1' } }] },
    { module: 'module.web', mode: 'managed', type: 'lab_vm', name: 'this', provider: 'p', instances: [{ index_key: 'a', attributes: { id: 'vm-2', name: 'web-a' } }, { index_key: 'b', attributes: { id: 'vm-3', name: 'web-b' } }] },
  ],
});

describe('cloud lab facts', () => {
  it('parses a state file with modules, keys and data sources', () => {
    const st = parseTfState(STATE)!;
    expect(st.serial).toBe(3);
    expect(st.outputs).toEqual(['ip']);
    expect(st.resources.map((r) => r.address)).toEqual(['data.lab_images.all', 'lab_vm.web', 'module.web.lab_vm.this["a"]', 'module.web.lab_vm.this["b"]']);
    expect(st.resources[1].id).toBe('vm-1');
    expect(parseTfState('{"version": 3}')).toBeNull();
    expect(parseTfState('not json')).toBeNull();
  });

  it('flattens the cloud, the storage and the requests for predicates', async () => {
    const cloud = new Cloud({ backend: new MockVmBackend({ bootMs: 1, totalMB: 1024 }), delays: { disk: 1, lb: 1 } });
    const s3 = new S3Store(cloud);
    const token = cloud.state.bootstrapSecret;
    const requests: { method: string; path: string; status: number; from: string }[] = [];
    cloud.on((e) => {
      if (e.t === 'request') requests.push({ method: e.method, path: e.path, status: e.status, from: e.from });
    });
    expect((await cloud.handleHttp(req('GET', '/v1/whoami'))).status).toBe(401);
    expect((await cloud.handleHttp(req('POST', '/v1/projects/default/buckets', { name: 'tfstate' }, token))).status).toBe(201);
    const created = await cloud.handleHttp(req('POST', '/v1/projects/default/vms', { name: 'api-1', flavor: 'lab.small', image: 'alpine-3.20', ssh_authorized_keys: ['ssh-ed25519 AAAA learner@ws'] }, token));
    expect(created.status).toBe(202);
    const op = JSON.parse(String(created.body)).id as string;
    const done = await cloud.handleHttp(req('GET', `/v1/operations/${op}?wait=5`, undefined, token));
    expect(JSON.parse(String(done.body)).status).toBe('DONE');
    s3.put('tfstate', 'lab/terraform.tfstate', enc.encode(STATE), 'application/json');

    const objects = s3.keys('tfstate').map((key) => ({ bucket: 'tfstate', key, body: s3.get('tfstate', key)!.body, contentType: 'application/json' }));
    const facts = { cloud: cloudScope(cloud.state, requests), s3: s3Scope(objects) } as unknown as Facts;
    const yes = (when: string) => expect(evaluateCheck({ when }, facts).pass, when).toBe(true);
    yes('cloud.buckets[name=tfstate]');
    yes('cloud.vms[name=api-1].status=RUNNING');
    yes('cloud.vms[name=api-1].keys=1');
    yes("cloud.requests[from='10.0.0.10'][status=401]");
    yes('cloud.ops[kind=vm.create].status=DONE');
    yes("s3.states[key='lab/terraform.tfstate'].resources[address='lab_vm.web'].id=vm-1");
    yes("cloud.sgs[name=default].rules has 'ingress tcp 22 0.0.0.0/0'");
    expect(ruleLine({ direction: 'ingress', protocol: 'tcp', port_min: 3306, port_max: 3306, cidr: '0.0.0.0/0' })).toBe('ingress tcp 3306 0.0.0.0/0');
  });
});

// ── the CI bridge ──

function commit(store: GitStore, repo: string, files: Record<string, string>, parent?: string): string {
  const objs = new Map<string, GitObject>();
  const put = (type: GitObject['type'], body: Uint8Array) => {
    const id = objectId(type, body);
    objs.set(id, { type, body });
    return id;
  };
  const entries = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, text]) => ({ mode: '100644', name, oid: put('blob', enc.encode(text)) }));
  const tree = put('tree', serializeTree(entries));
  const c = put('commit', serializeCommit({ tree, parents: parent ? [parent] : [], author: 'L <l@ws> 1700000000 +0000', committer: 'L <l@ws> 1700000000 +0000', message: 'x\n' }));
  store.putObjects(repo, objs);
  return c;
}

/** A runner that "runs" a job by its name: jobs whose name contains "fail" exit 1. */
function scriptedRunner(): Runner & { scripts: string[] } {
  const scripts: string[] = [];
  let current = '';
  return {
    scripts,
    async exec(cmd) {
      const m = /cat > (\S+)\.sh <<'DT_CI_EOF'\n([\s\S]*?)DT_CI_EOF/.exec(cmd);
      if (m) {
        current = m[2];
        scripts.push(m[2]);
        return { out: '', exit: 0 };
      }
      if (cmd.startsWith('cat ')) {
        const name = /export CI_JOB_NAME='([^']*)'/.exec(current)?.[1] ?? '';
        const code = /fail/.test(name) ? 1 : 0;
        return { out: `${code}\n@@DT@@\nlog of ${name}\n`, exit: 0 };
      }
      return { out: '', exit: 0 };
    },
  };
}

const YML = `stages: [plan, apply]
plan:
  stage: plan
  script:
    - tofu init -input=false
    - tofu plan -input=false -out=plan.tfplan
  artifacts:
    paths: [plan.tfplan]
apply:
  stage: apply
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - tofu init -input=false
    - tofu apply -input=false plan.tfplan
`;

async function settle(ci: CiBridge) {
  for (let i = 0; i < 200 && ci.pipelines.some((p) => p.status === 'pending' || p.status === 'running'); i++) await new Promise((r) => setTimeout(r, 1));
}

describe('CI bridge', () => {
  it('runs plan then apply on the default branch, plan only on a feature branch', async () => {
    const store = new GitStore();
    const git = new GitServer(store);
    const runner = scriptedRunner();
    const ci = new CiBridge(git, () => runner, { pollMs: 0, sleep: async () => undefined });
    store.create('infra');
    const c1 = commit(store, 'infra', { '.gitlab-ci.yml': YML, 'main.tf': 'x' });
    const lines = ci.onPush({ repo: 'infra', from: '10.0.0.10', updates: [{ ref: 'refs/heads/main', before: null, after: c1 }] }, store);
    expect(lines[0]).toMatch(/pipeline #1 for main: plan, apply/);
    await settle(ci);
    const p1 = ci.pipelines[0];
    expect(p1.status).toBe('success');
    expect(p1.jobs.map((j) => `${j.name}:${j.status}`)).toEqual(['plan:success', 'apply:success']);
    expect(p1.jobs[0].log).toMatch(/log of plan/);
    // The plan job uploads its artifact; the apply job downloads it.
    expect(runner.scripts[0]).toMatch(/Uploading artifacts: plan\.tfplan/);
    expect(runner.scripts[1]).toMatch(/Downloading artifacts/);
    expect(runner.scripts[1]).toMatch(/export CI_COMMIT_BRANCH='main'/);

    const c2 = commit(store, 'infra', { '.gitlab-ci.yml': YML, 'main.tf': 'y' }, c1);
    ci.onPush({ repo: 'infra', from: '10.0.0.10', updates: [{ ref: 'refs/heads/resize', before: null, after: c2 }] }, store);
    await settle(ci);
    expect(ci.pipelines[1].jobs.map((j) => j.name)).toEqual(['plan']);

    const facts = { ci: ci.facts() } as unknown as Facts;
    expect(evaluateCheck({ when: 'ci.pipelines[ref=main].jobs[name=apply].status=success' }, facts).pass).toBe(true);
    expect(evaluateCheck({ when: 'ci.pipelines[ref=resize].jobs[name=apply]' }, facts).pass).toBe(false);
  });

  it('skips later stages after a failure, keeps manual jobs until played, reports bad YAML', async () => {
    const store = new GitStore();
    const git = new GitServer(store);
    const runner = scriptedRunner();
    const ci = new CiBridge(git, () => runner, { pollMs: 0, sleep: async () => undefined });
    store.create('app');
    const failing = 'stages: [test, deploy]\ntest-fail:\n  stage: test\n  script: [exit 1]\ndeploy:\n  stage: deploy\n  script: [echo deploy]\n';
    const c1 = commit(store, 'app', { '.gitlab-ci.yml': failing });
    ci.onPush({ repo: 'app', from: '10.0.0.10', updates: [{ ref: 'refs/heads/main', before: null, after: c1 }] }, store);
    await settle(ci);
    expect(ci.pipelines[0].status).toBe('failed');
    expect(ci.pipelines[0].jobs.map((j) => j.status)).toEqual(['failed', 'skipped']);

    const manual = 'stages: [plan, apply]\nplan:\n  stage: plan\n  script: [echo plan]\napply:\n  stage: apply\n  when: manual\n  script: [echo apply]\n';
    const c2 = commit(store, 'app', { '.gitlab-ci.yml': manual }, c1);
    ci.onPush({ repo: 'app', from: '10.0.0.10', updates: [{ ref: 'refs/heads/main', before: c1, after: c2 }] }, store);
    await settle(ci);
    const p = ci.pipelines[1];
    expect(p.jobs.map((j) => j.status)).toEqual(['success', 'manual']);
    expect(ci.play(p.id, 'apply')).toBe(true);
    await settle(ci);
    expect(p.jobs[1].status).toBe('success');

    const c3 = commit(store, 'app', { '.gitlab-ci.yml': 'stages: [a\n' }, c2);
    const lines = ci.onPush({ repo: 'app', from: '10.0.0.10', updates: [{ ref: 'refs/heads/main', before: c2, after: c3 }] }, store);
    expect(lines[0]).toMatch(/invalid/);
    expect(ci.pipelines[2].status).toBe('failed');
    // ci.lab answers curl.
    const page = ci.handle(req('GET', '/pipelines/2'));
    expect(new TextDecoder().decode(page.body as Uint8Array)).toMatch(/pipeline #2 app main/);
  });

  it('writes a job script that a POSIX shell parses', async () => {
    const job = parseCi(YML).config!.jobs[0];
    const s = jobScript({ repo: 'infra', sha: 'a'.repeat(40), env: { CI_COMMIT_BRANCH: "it's main" } }, job, '/builds/infra', 'http://git.lab/infra.git', '/var/lib/lab-ci/p1/artifacts');
    const { execFileSync } = await import('node:child_process');
    // -n: read the script, run nothing.
    execFileSync('sh', ['-n', '-c', s]);
    expect(s).toMatch(/export CI_COMMIT_BRANCH='it'\\''s main'/);
    expect(s).toMatch(/set -e/);
  });
});

// ── the lessons' checks on recorded facts ──

const task = (tasks: Task[], id: string) => tasks.find((x) => x.id === id)!;
const tasksOf = (l: { sections: { kind: string; props?: unknown }[] }) => ((l.sections.find((s) => s.kind === 'widget') as { props: { tasks: Task[] } }).props.tasks);

describe('cloud lab lesson checks', () => {
  it('lesson cloud-api: the 401 must be seen and the operation polled', () => {
    const tasks = tasksOf(lessons3.apiLesson as never);
    const base = { cloud: { vms: [], ops: [], requests: [] as unknown[] } };
    const f = (requests: unknown[], vms: unknown[] = []) => ({ ...base, cloud: { ...base.cloud, requests, vms } }) as unknown as Facts;
    const auth = task(tasks, 'auth');
    expect(evaluateCheck(auth.check, f([{ method: 'GET', path: '/v1/whoami', status: 200, from: '10.0.0.10' }])).pass).toBe(false);
    expect(evaluateCheck(auth.check, f([{ method: 'GET', path: '/v1/whoami', status: 401, from: '10.0.0.10' }, { method: 'GET', path: '/v1/whoami', status: 200, from: '10.0.0.10' }])).pass).toBe(true);
    const create = task(tasks, 'create');
    const vm = { name: 'api-1', status: 'RUNNING', keys: 1 };
    expect(evaluateCheck(create.check, f([], [vm])).pass).toBe(false);
    expect(evaluateCheck(create.check, f([{ method: 'GET', path: '/v1/operations/op-1?wait=30', status: 200, from: '10.0.0.10' }], [vm])).pass).toBe(true);
    const ssh = task(tasks, 'ssh');
    expect(evaluateCheck(ssh.check, { vms: { 'api-1': { files: { '/root/hello': { type: 'f' } } } } } as unknown as Facts).pass).toBe(true);
  });

  it('lesson cloud-api: creation and the SSH visit still count after the VM is deleted', () => {
    const tasks = tasksOf(lessons3.apiLesson as never);
    const polled = [{ method: 'GET', path: '/v1/operations/op-1?wait=30', status: 200, from: '10.0.0.10' }];
    const gone = { cloud: { vms: [], ops: [{ kind: 'vm.create', target: 'api-1', status: 'DONE' }], requests: polled } } as unknown as Facts;
    expect(evaluateCheck(task(tasks, 'create').check, gone).pass).toBe(true);
    const ssh = task(tasks, 'ssh');
    const term = (line: string, exit = 0) => ({ term: { main: [{ line, exit, out: '' }] } }) as unknown as Facts;
    expect(evaluateCheck(ssh.check, term('ssh root@api-1.vm.lab "touch /root/hello"')).pass).toBe(true);
    expect(evaluateCheck(ssh.check, term('ssh root@api-1.vm.lab "touch /root/hello"', 255)).pass).toBe(false);
    expect(evaluateCheck(ssh.check, term('ssh root@api-1.vm.lab')).pass).toBe(false);
  });

  it('lesson remote-state: import must keep the hand-made record', () => {
    const tasks = tasksOf(lessons3.stateLesson as never);
    const imp = task(tasks, 'import');
    const start = { cloud: { records: [{ id: 'rec-1', fqdn: 'www.shop.lab' }] } } as unknown as Facts;
    const state = (id: string) => ({ bucket: 'tfstate', key: 'lab/terraform.tfstate', serial: 2, lineage: 'x', outputs: [], resources: [{ address: 'lab_dns_zone.shop', type: 'lab_dns_zone', mode: 'managed', id: 'zone-1', attrs: {} }, { address: 'lab_dns_record.www', type: 'lab_dns_record', mode: 'managed', id, attrs: {} }] });
    const f = (id: string, out: string) => ({ cloud: { records: [{ id, fqdn: 'www.shop.lab' }], requests: [] }, s3: { objects: [], states: [state(id)] }, term: { main: [{ line: '', exit: 0, out }] } }) as unknown as Facts;
    expect(evaluateCheck(imp.check, f('rec-1', 'No changes. Your infrastructure matches the configuration.'), start).pass).toBe(true);
    expect(evaluateCheck(imp.check, f('rec-2', 'No changes.'), start).pass).toBe(false);
    expect(evaluateCheck(imp.check, f('rec-1', 'Plan: 1 to import'), start).pass).toBe(false);
  });

  it('the in-tab exam judges goals on the cloud pseudo-machine', () => {
    expect(cloudExam.inTab?.widget).toBe('iac.cloudlab');
    const vmTask = cloudExam.tasks.find((x) => x.id === 'vm')!;
    if (vmTask.kind !== 'real') throw new Error('kind');
    const goal = vmTask.real.goals!.find((g) => g.id === 'state')!;
    const cloud = { s3: { objects: [], states: [{ bucket: 'tfstate', key: 'exam/terraform.tfstate', serial: 1, lineage: '', outputs: [], resources: [{ address: 'lab_vm.api', type: 'lab_vm', mode: 'managed', id: 'vm-9', attrs: { name: 'api-1' } }] }] } } as unknown as Facts;
    expect(evaluateCheck(goal.check, cloud).pass).toBe(true);
  });
});
