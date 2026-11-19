// The pipeline simulator (06 §3.1): a push to the training forge creates a
// pipeline from the pushed .gitlab-ci.yml; the runner model picks jobs by
// stage or `needs`, matches runner tags, and every job runs its script for
// real on a fresh simulated machine with the repository checked out at the
// commit. Artifacts and caches are files carried between those machines.
// The log copies GitLab Runner's format, because reading it is the skill.

import type { ShellCommand, SimMachineApi } from '../../../core/types';
import { createSimMachine, stripAnsi } from '../../../engine/terminal/shell';
import { createTerminalRegistry, terminalRegistry, type TerminalRegistry } from '../../../engine/terminal/registry';
import { ForgeProject, onForgePush, type ForgeState, type PushEvent } from '../git/forge';
import { publish } from '../shared/hub';
import { decide, globMatch, parseCi, type CiConfig, type CiJob, type When } from './config';
import { registerBuiltImage, shareCluster } from './kube';
import { dockerModel, jobFallbacks, npmModel, type JobContext } from './models';

export const RUNNER_VERSION = '18.5.0';

export type JobStatus = 'created' | 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'manual' | 'canceled';

export interface JobRec {
  id: number;
  name: string;
  stage: string;
  status: JobStatus;
  when: When;
  allowFailure: boolean;
  needs: string[] | null;
  log: string;
  /** Model seconds since the pipeline started. */
  start?: number;
  end?: number;
  runner?: string;
  /** Why it is pending, skipped or failed, in GitLab's words. */
  reason?: string;
  env?: string;
  image: string;
  tags: string[];
  artifacts?: Record<string, string>;
  cacheKey?: string;
  cacheHit?: boolean;
  attempt: number;
}

export interface PipelineRec {
  id: number;
  project: string;
  ref: string;
  sha: string;
  source: 'push' | 'merge_request_event' | 'web';
  tag?: string;
  mr?: number;
  status: 'created' | 'running' | 'success' | 'failed' | 'blocked' | 'skipped' | 'pending';
  errors?: { line: number; message: string }[];
  jobs: JobRec[];
  excluded: { name: string; reason: string }[];
  stages: string[];
  changed: string[];
  duration: number;
  at: number;
}

// ── images ──

const IMAGES: Record<string, RegExp> = {
  alpine: /^(latest|3(\.\d+){0,2})$/,
  node: /^(latest|lts|current|(18|20|22|24|25)(\.\d+){0,2})(-(alpine|slim|bookworm|trixie)(\d+(\.\d+)?)?)?$/,
  python: /^(latest|3(\.(9|1[0-4]))?(\.\d+)?)(-(alpine|slim))?$/,
  docker: /^(latest|2[4-9](\.\d+){0,2})(-(dind|cli))?$/,
  nginx: /^(latest|stable|mainline|alpine|1\.\d+(\.\d+)?(-alpine)?)$/,
  debian: /^(latest|bookworm|trixie|12|13)(-slim)?$/,
  ubuntu: /^(latest|22\.04|24\.04|26\.04)$/,
  busybox: /^latest$/,
  'bitnami/kubectl': /^(latest|1\.\d+(\.\d+)?)$/,
  'alpine/helm': /^(latest|[34]\.\d+(\.\d+)?)$/,
  'hashicorp/terraform': /^(latest|1\.\d+(\.\d+)?)$/,
  'ghcr.io/opentofu/opentofu': /^(latest|1\.\d+(\.\d+)?)$/,
  'golang': /^(latest|1\.\d+(\.\d+)?)(-alpine)?$/,
};

export function imageExists(image: string): boolean {
  const at = image.lastIndexOf(':');
  const hasTag = at > image.lastIndexOf('/');
  const repo = (hasTag ? image.slice(0, at) : image).replace(/^docker\.io\/(library\/)?/, '');
  const tag = hasTag ? image.slice(at + 1) : 'latest';
  if (repo.startsWith('registry.forge.edu/')) return true;
  const re = IMAGES[repo];
  return !!re && re.test(tag);
}

// ── the job machine registry ──

let baseRegistry: TerminalRegistry = terminalRegistry;
/** Tests pass the registry their machines use. */
export function setJobBaseRegistry(r: TerminalRegistry): void {
  baseRegistry = r;
  jobReg = null;
}
let jobReg: TerminalRegistry | null = null;
function jobRegistry(): TerminalRegistry {
  if (jobReg) return jobReg;
  const r = createTerminalRegistry();
  const seen = new Set<string>();
  for (const c of baseRegistry.commands.list()) {
    r.commands.add(c);
    seen.add(c.name);
    for (const a of c.aliases ?? []) seen.add(a);
  }
  // sleep always uses model time on job machines; the other fallbacks fill gaps only.
  for (const c of jobFallbacks) if (!seen.has(c.name) || c.name === 'sleep') r.commands.add({ ...c, override: true });
  for (const c of [npmModel, dockerModel] as ShellCommand[]) r.commands.add(c);
  r.facts.push(...baseRegistry.facts);
  jobReg = r;
  return r;
}

// ── helpers ──

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);

function changedFiles(forge: ForgeProject, before: string | null, after: string): string[] {
  const a = before && forge.repo.hasObject(before) ? forge.repo.commitFiles(before) : new Map();
  const b = forge.repo.commitFiles(after);
  return [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k)?.oid !== b.get(k)?.oid).sort();
}

function isProtected(s: ForgeState, ref: string, tag: boolean): boolean {
  return tag ? /^v/.test(ref) : s.protectedBranches.includes(ref);
}

export function pipelineEnv(s: ForgeState, p: PipelineRec, mrInfo?: { source: string; target: string }): Record<string, string> {
  const env: Record<string, string> = {
    CI: 'true',
    GITLAB_CI: 'true',
    CI_SERVER_HOST: 'forge.edu',
    CI_SERVER_URL: 'https://forge.edu',
    CI_PROJECT_PATH: p.project,
    CI_PROJECT_NAME: p.project.split('/')[1],
    CI_PROJECT_NAMESPACE: p.project.split('/')[0],
    CI_PROJECT_DIR: `/builds/${p.project}`,
    CI_PROJECT_URL: `https://forge.edu/${p.project}`,
    CI_DEFAULT_BRANCH: s.defaultBranch,
    CI_COMMIT_SHA: p.sha,
    CI_COMMIT_SHORT_SHA: p.sha.slice(0, 8),
    CI_COMMIT_REF_NAME: p.ref,
    CI_COMMIT_REF_SLUG: slug(p.ref),
    CI_PIPELINE_SOURCE: p.source,
    CI_PIPELINE_ID: String(p.id),
    CI_REGISTRY: 'registry.forge.edu',
    CI_REGISTRY_IMAGE: `registry.forge.edu/${p.project}`,
    CI_REGISTRY_USER: 'gitlab-ci-token',
    CI_REGISTRY_PASSWORD: `glcbt-${p.sha.slice(0, 20)}`,
    CI_COMMIT_REF_PROTECTED: String(isProtected(s, p.ref, !!p.tag)),
  };
  if (p.tag) env.CI_COMMIT_TAG = p.tag;
  else if (p.source !== 'merge_request_event') env.CI_COMMIT_BRANCH = p.ref;
  if (mrInfo && p.mr) {
    env.CI_MERGE_REQUEST_IID = String(p.mr);
    env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME = mrInfo.source;
    env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME = mrInfo.target;
  }
  return env;
}

/** Where the runner writes File-type variables (GitLab: <builds dir>.tmp/<KEY>). */
const fileVarPath = (project: string, key: string) => `/builds/${project}.tmp/${key}`;

function projectVars(s: ForgeState, p: PipelineRec): Record<string, string> {
  const prot = isProtected(s, p.ref, !!p.tag);
  const out: Record<string, string> = {};
  for (const v of s.variables) if (!v.protected || prot) out[v.key] = v.file ? fileVarPath(p.project, v.key) : v.value;
  return out;
}

function maskLog(log: string, s: ForgeState): string {
  let out = log;
  for (const v of s.variables) if (v.masked && v.value.length >= 8) out = out.split(v.value).join('[MASKED]');
  return out;
}

export function readPipelines(forge: ForgeProject): PipelineRec[] {
  return forge.state().pipelines as PipelineRec[];
}

function savePipeline(forge: ForgeProject, p: PipelineRec): void {
  forge.update((s) => {
    const i = (s.pipelines as PipelineRec[]).findIndex((x) => x.id === p.id);
    if (i >= 0) s.pipelines[i] = p;
    else s.pipelines.push(p);
  });
}

function configAt(forge: ForgeProject, sha: string): { text: string | null; parsed: ReturnType<typeof parseCi> | null } {
  const files = forge.repo.commitFiles(sha);
  const e = files.get('.gitlab-ci.yml');
  if (!e) return { text: null, parsed: null };
  const text = forge.repo.readBlob(e.oid);
  return { text, parsed: parseCi(text) };
}

// ── creating a pipeline ──

export async function createPipeline(
  machine: SimMachineApi,
  forge: ForgeProject,
  o: { ref: string; sha: string; source: PipelineRec['source']; tag?: boolean; before?: string | null; mr?: { iid: number; source: string; target: string } },
): Promise<PipelineRec | null> {
  const cfg = configAt(forge, o.sha);
  if (!cfg.text) return null;
  const s = forge.state();
  const id = forge.update((st) => st.next.pipeline++);
  const p: PipelineRec = {
    id,
    project: forge.project,
    ref: o.ref,
    sha: o.sha,
    source: o.source,
    tag: o.tag ? o.ref : undefined,
    mr: o.mr?.iid,
    status: 'created',
    jobs: [],
    excluded: [],
    stages: [],
    changed: changedFiles(forge, o.before ?? null, o.sha),
    duration: 0,
    at: (machine as unknown as { now?: () => number }).now?.() ?? Date.now(),
  };
  if (!cfg.parsed?.config) {
    p.status = 'failed';
    p.errors = cfg.parsed?.errors ?? [{ line: 1, message: 'Invalid configuration format' }];
    savePipeline(forge, p);
    publish({ t: 'ci.pipeline', id: p.id, project: p.project, status: p.status, pipeline: p });
    return p;
  }
  const config = cfg.parsed.config;
  const env = { ...config.variables, ...projectVars(s, p), ...pipelineEnv(s, p, o.mr) };
  for (const j of config.jobs) {
    let d;
    try {
      d = decide(j, env, p.changed);
    } catch (e) {
      p.status = 'failed';
      p.errors = [{ line: j.line, message: `jobs:${j.name}:rules:rule if ${(e as Error).message}` }];
      savePipeline(forge, p);
      return p;
    }
    if (!d.included) {
      p.excluded.push({ name: j.name, reason: d.reason });
      continue;
    }
    const jid = forge.update((st) => st.next.job++);
    p.jobs.push({
      id: jid,
      name: j.name,
      stage: j.stage,
      status: 'created',
      when: d.when,
      allowFailure: d.allowFailure,
      needs: j.needs ? j.needs.map((n) => n.job) : null,
      log: '',
      image: j.image ?? 'ruby:3.3',
      tags: j.tags,
      env: j.environment?.name,
      attempt: 0,
    });
  }
  // needs on a job that rules removed: GitLab refuses the pipeline.
  for (const j of config.jobs) {
    if (!p.jobs.some((x) => x.name === j.name)) continue;
    for (const n of j.needs ?? []) {
      if (!n.optional && !p.jobs.some((x) => x.name === n.job)) {
        p.status = 'failed';
        p.errors = [{ line: j.line, message: `'${j.name}' job needs '${n.job}' job, but '${n.job}' does not exist in the pipeline. This might be because of the only, except, or rules keywords. To need a job that sometimes does not exist in the pipeline, use needs:optional.` }];
        p.jobs = [];
        savePipeline(forge, p);
        publish({ t: 'ci.pipeline', id: p.id, project: p.project, status: p.status, pipeline: p });
        return p;
      }
    }
  }
  p.stages = config.stages.filter((st) => p.jobs.some((j) => j.stage === st));
  if (!p.jobs.length) {
    // GitLab creates no pipeline when rules leave no jobs (a manual run reports why).
    if (o.source !== 'web') {
      publish({ t: 'ci.pipeline', id: p.id, project: p.project, status: 'none', pipeline: { ...p, status: 'skipped' } });
      return null;
    }
    p.status = 'skipped';
    p.errors = [{ line: 1, message: 'Pipeline will not run for the selected trigger. The rules configuration prevented any jobs from being added to the pipeline.' }];
    savePipeline(forge, p);
    publish({ t: 'ci.pipeline', id: p.id, project: p.project, status: p.status, pipeline: p });
    return p;
  }
  savePipeline(forge, p);
  machine.emit({ t: 'ci.pipeline', id: String(p.id), ref: p.ref, source: p.source, status: 'created' });
  await advance(machine, forge, p.id);
  return readPipelines(forge).find((x) => x.id === p.id) ?? p;
}

// ── scheduling ──

const finished = (s: JobStatus) => s === 'success' || s === 'failed' || s === 'skipped' || s === 'canceled';

function stageIndex(p: PipelineRec, stage: string): number {
  return p.stages.indexOf(stage);
}

function depsOf(p: PipelineRec, j: JobRec): JobRec[] {
  if (j.needs) return p.jobs.filter((x) => j.needs!.includes(x.name));
  return p.jobs.filter((x) => stageIndex(p, x.stage) < stageIndex(p, j.stage));
}

/** Run every job that can run now, in model-time order; stops at manual gates and stuck jobs. */
export async function advance(machine: SimMachineApi, forge: ForgeProject, pipelineId: number, play?: string): Promise<PipelineRec> {
  let p = readPipelines(forge).find((x) => x.id === pipelineId)!;
  const cfg = configAt(forge, p.sha).parsed?.config;
  if (!cfg) return p;
  const s = forge.state();
  const slots: { runner: string; tags: string[]; free: number }[] = [];
  for (const r of s.runners.filter((x) => x.online)) for (let i = 0; i < r.concurrent; i++) slots.push({ runner: `${r.description} #${r.id}`, tags: r.tags, free: 0 });
  // Slots are busy until the end of jobs that already ran.
  const busyUntil = Math.max(0, ...p.jobs.filter((j) => j.end !== undefined).map((j) => j.end!));
  if (play) for (const sl of slots) sl.free = Math.max(sl.free, busyUntil);
  for (let guard = 0; guard < 200; guard++) {
    let progressed = false;
    for (const j of p.jobs) {
      if (j.status !== 'created' && !(j.status === 'manual' && j.name === play)) continue;
      const deps = depsOf(p, j);
      if (j.status === 'manual' && j.name === play) {
        play = undefined;
      } else {
        if (deps.some((d) => !finished(d.status) && !(d.status === 'manual' && d.allowFailure))) continue;
        const failedDep = deps.find((d) => d.status === 'failed' && !d.allowFailure);
        const skippedDep = deps.find((d) => d.status === 'skipped' || d.status === 'canceled');
        if (j.when === 'on_failure') {
          if (!failedDep) {
            j.status = 'skipped';
            j.reason = 'when: on_failure — nothing failed';
            progressed = true;
            continue;
          }
        } else if (j.when !== 'always' && (failedDep || skippedDep)) {
          j.status = 'skipped';
          j.reason = failedDep ? `${failedDep.name} failed` : `${skippedDep!.name} was skipped`;
          progressed = true;
          continue;
        }
        if (j.when === 'manual') {
          j.status = 'manual';
          j.end = Math.max(0, ...deps.map((d) => d.end ?? 0));
          progressed = true;
          continue;
        }
      }
      const ready = Math.max(0, ...deps.map((d) => d.end ?? 0));
      const fits = slots.filter((sl) => j.tags.every((tg) => sl.tags.includes(tg)));
      if (!fits.length) {
        j.status = 'pending';
        j.reason = j.tags.length
          ? `This job is stuck because you don't have any active runners online or available with any of these tags assigned to them: ${j.tags.join(', ')}`
          : "This job is stuck because the project doesn't have any runners online assigned to it.";
        j.log = `Waiting for a runner to pick up this job...\n${j.reason}\n`;
        progressed = true;
        continue;
      }
      const slot = fits.sort((a, b) => a.free - b.free)[0];
      const start = Math.max(ready, slot.free) + 1;
      const job = cfg.jobs.find((x) => x.name === j.name)!;
      const deployQueued = job.resourceGroup ? Math.max(0, ...p.jobs.filter((x) => x !== j && x.env === j.env && x.end !== undefined && x.status === 'success').map((x) => x.end!)) : 0;
      j.status = 'running';
      j.runner = slot.runner;
      j.start = Math.max(start, deployQueued);
      p.status = 'running';
      savePipeline(forge, p);
      publish({ t: 'ci.pipeline', id: p.id, project: p.project, status: 'running', pipeline: p });
      const result = await runJob(machine, forge, p, j, job, cfg);
      j.end = j.start + result.seconds;
      slot.free = j.end;
      progressed = true;
      // Read back what the job wrote to the forge (registry, deployments) and merge our record.
      const fresh = readPipelines(forge).find((x) => x.id === p.id)!;
      fresh.jobs = p.jobs;
      p = fresh;
      savePipeline(forge, p);
    }
    if (!progressed) break;
  }
  p.status = pipelineStatus(p);
  p.duration = Math.max(0, ...p.jobs.map((j) => j.end ?? 0));
  savePipeline(forge, p);
  machine.emit({ t: 'ci.pipeline', id: String(p.id), ref: p.ref, source: p.source, status: p.status });
  publish({ t: 'ci.pipeline', id: p.id, project: p.project, status: p.status, pipeline: p });
  return p;
}

export function pipelineStatus(p: PipelineRec): PipelineRec['status'] {
  if (p.errors?.length) return p.status === 'skipped' ? 'skipped' : 'failed';
  const js = p.jobs;
  if (js.some((j) => j.status === 'pending')) return 'pending';
  if (js.some((j) => j.status === 'failed' && !j.allowFailure)) return 'failed';
  if (js.some((j) => j.status === 'manual' && !j.allowFailure)) return 'blocked';
  if (js.some((j) => j.status === 'created' || j.status === 'running')) return 'running';
  return 'success';
}

// ── one job on one machine ──

async function runJob(machine: SimMachineApi, forge: ForgeProject, p: PipelineRec, rec: JobRec, job: CiJob, cfg: CiConfig): Promise<{ seconds: number }> {
  const s = forge.state();
  const dir = `/builds/${p.project}`;
  const mrInfo = p.mr ? s.mrs.find((m) => m.iid === p.mr) : undefined;
  const env: Record<string, string> = {
    ...cfg.variables,
    ...job.variables,
    ...projectVars(s, p),
    ...pipelineEnv(s, p, mrInfo ? { source: mrInfo.source, target: mrInfo.target } : undefined),
    CI_JOB_NAME: job.name,
    CI_JOB_STAGE: job.stage,
    CI_JOB_ID: String(rec.id),
    CI_JOB_URL: `https://forge.edu/${p.project}/-/jobs/${rec.id}`,
    CI_BUILDS_DIR: '/builds',
  };
  if (job.environment) env.CI_ENVIRONMENT_NAME = job.environment.name;
  let seconds = 0;
  const lines: string[] = [];
  const log = (l: string) => lines.push(l);
  const section = (l: string) => lines.push(`\x1b[0K\x1b[36;1m${l}\x1b[0;m`);
  log(`Running with gitlab-runner ${RUNNER_VERSION} (edu)`);
  log(`  on ${rec.runner?.replace(/ #\d+$/, '')} t3_xY9k${rec.id % 10}, system ID: s_4f1e0${rec.id % 7}`);
  section('Preparing the "docker" executor');
  log(`Using Docker executor with image ${rec.image} ...`);
  log(`Pulling docker image ${rec.image} ...`);
  seconds += 4;
  if (!imageExists(rec.image)) {
    const repo = rec.image.split(':')[0];
    log(`\x1b[31;1mERROR: Job failed: failed to pull image "${rec.image}" with specified policies [always]: Error response from daemon: ${IMAGES[repo.replace(/^docker\.io\/(library\/)?/, '')] ? `manifest for ${rec.image} not found: manifest unknown: manifest unknown` : `pull access denied for ${repo}, repository does not exist or may require 'docker login': denied: requested access to the resource is denied`} (manager.go:250:0s)\x1b[0;m`);
    rec.status = 'failed';
    rec.reason = 'image pull failure';
    rec.log = lines.join('\n') + '\n';
    return { seconds };
  }
  section('Preparing environment');
  log(`Running on runner-t3xy9k-project-12-concurrent-0 via ${rec.runner?.replace(/ #\d+$/, '')}...`);
  section('Getting source from Git repository');
  log('Fetching changes with git depth set to 20...');
  log(`Initialized empty Git repository in ${dir}/.git/`);
  log(`Created fresh repository.`);
  log(`Checking out ${p.sha.slice(0, 8)} as detached HEAD (ref is ${p.ref})...`);
  seconds += 2;
  const m = await createSimMachine({ user: 'root', hostname: `runner-${rec.id}`, cwd: dir, env }, { registry: jobRegistry(), id: `job-${rec.id}` });
  const jobState: JobContext = {
    addTime: (sec) => (seconds += sec),
    pushImage: (image, tag, from) => {
      registerBuiltImage(image, tag, from);
      forge.update((st) => {
        st.registry = st.registry.filter((r) => !(r.image === image && r.tag === tag));
        st.registry.push({ image, tag, sha: p.sha, pipeline: p.id });
      });
    },
    registryLoggedIn: false,
  };
  m.ext('ci.job', () => jobState);
  shareCluster(m, machine);
  const fs = m.rootFs;
  fs.mkdir(dir, { parents: true });
  const prot = isProtected(s, p.ref, !!p.tag);
  for (const v of s.variables) if (v.file && (!v.protected || prot)) writeTo(fs, fileVarPath(p.project, v.key), v.value.endsWith('\n') ? v.value : `${v.value}\n`);
  for (const [path, e] of forge.repo.commitFiles(p.sha)) {
    const abs = `${dir}/${path}`;
    const d = abs.slice(0, abs.lastIndexOf('/'));
    if (!fs.exists(d)) fs.mkdir(d, { parents: true });
    fs.writeFile(abs, forge.repo.readBlob(e.oid));
    fs.chmod(abs, e.mode === '100755' ? 0o755 : 0o644);
  }
  log('Skipping Git submodules setup');
  // Cache: restore.
  let cacheKey: string | undefined;
  if (job.cache && job.cache.paths.length) {
    cacheKey = resolveCacheKey(job, env, (f) => (fs.exists(`${dir}/${f}`) ? fs.readFile(`${dir}/${f}`) : ''));
    rec.cacheKey = cacheKey;
    section('Restoring cache');
    if (job.cache.policy !== 'push') {
      log(`Checking cache for ${cacheKey}-protected...`);
      const stored = s.cache[cacheKey];
      if (stored) {
        log('No URL provided, cache will not be downloaded from shared cache server. Instead a local version of cache will be extracted.');
        for (const [path, text] of Object.entries(stored)) writeTo(fs, `${dir}/${path}`, text);
        log('Successfully extracted cache');
        rec.cacheHit = true;
      } else {
        log('\x1b[0;33mWARNING: file does not exist                       \x1b[0;m');
        log('\x1b[0;33mFailure reason: file does not exist\x1b[0;m');
        rec.cacheHit = false;
      }
      seconds += 1;
    }
  }
  // Artifacts from earlier jobs.
  const deps = depsOf(p, rec).filter((d) => d.status === 'success' && d.artifacts && (!job.needs || job.needs.find((n) => n.job === d.name)?.artifacts !== false));
  if (deps.length) {
    section('Downloading artifacts');
    for (const d of deps) {
      log(`Downloading artifacts for ${d.name} (${d.id})...`);
      for (const [path, text] of Object.entries(d.artifacts!)) writeTo(fs, `${dir}/${path}`, text);
      log(`Downloading artifacts from coordinator... ok        host=forge.edu id=${d.id} responseStatus=200 OK token=glcbt-…`);
    }
  }
  section('Executing "step_script" stage of the job script');
  let exit = 0;
  const runLines = async (cmds: string[]) => {
    for (const line of cmds) {
      log(`\x1b[32;1m$ ${line}\x1b[0;m`);
      const r = await m.exec(line);
      seconds += 0.4;
      const out = r.out.replace(/\n$/, '');
      if (out) log(out);
      if (r.exit !== 0) return r.exit;
    }
    return 0;
  };
  exit = await runLines([...job.beforeScript, ...job.script]);
  if (job.afterScript.length) {
    section('Running after_script');
    log('Running after script...');
    await runLines(job.afterScript);
  }
  const success = exit === 0;
  // Cache: save.
  if (job.cache && job.cache.paths.length && cacheKey && job.cache.policy !== 'pull' && success) {
    section('Saving cache for successful job');
    log(`Creating cache ${cacheKey}-protected...`);
    const files: Record<string, string> = {};
    for (const pat of job.cache.paths) {
      const hits = collect(fs, dir, pat);
      log(hits.length ? `${pat}: found ${hits.length} matching artifact files and directories` : `\x1b[0;33mWARNING: ${pat}: no matching files. Ensure that the artifact path is relative to the working directory (${dir})\x1b[0;m`);
      for (const h of hits) files[h] = fs.readFile(`${dir}/${h}`);
    }
    log('No URL provided, cache will not be uploaded to shared cache server. Cache will be stored only locally.');
    log('Created cache');
    forge.update((st) => (st.cache[cacheKey!] = files));
    seconds += 1;
  }
  // Artifacts: upload.
  if (job.artifacts && job.artifacts.paths.length && (job.artifacts.when === 'always' || (job.artifacts.when === 'on_success') === success)) {
    section(`Uploading artifacts for ${success ? 'successful' : 'failed'} job`);
    log('Uploading artifacts...');
    const files: Record<string, string> = {};
    let any = false;
    for (const pat of job.artifacts.paths) {
      const hits = collect(fs, dir, pat);
      if (hits.length) {
        any = true;
        log(`${pat}: found ${hits.length} matching artifact files and directories`);
      } else log(`\x1b[0;33mWARNING: ${pat}: no matching files. Ensure that the artifact path is relative to the working directory (${dir})\x1b[0;m`);
      for (const h of hits) files[h] = fs.readFile(`${dir}/${h}`);
    }
    if (any) {
      log(`Uploading artifacts as "archive" to coordinator... 201 Created  id=${rec.id} responseStatus=201 Created token=glcbt-…`);
      rec.artifacts = files;
    } else log('\x1b[31;1mERROR: No files to upload                          \x1b[0;m');
    seconds += 1;
  }
  section('Cleaning up project directory and file based variables');
  if (success) {
    log('\x1b[32;1mJob succeeded\x1b[0;m');
    rec.status = 'success';
    if (job.environment) {
      forge.update((st) => st.deployments.push({ env: job.environment!.name, sha: p.sha, ref: p.ref, job: job.name, pipeline: p.id, at: p.at + (rec.start ?? 0) * 1000, status: 'success' }));
    }
  } else {
    log(`\x1b[31;1mERROR: Job failed: exit code ${exit}\x1b[0;m`);
    rec.status = 'failed';
    rec.reason = `script failure (exit code ${exit})`;
    if (rec.attempt < job.retry) {
      rec.attempt++;
      log(`\x1b[0;33mRetrying the job (attempt ${rec.attempt + 1} of ${job.retry + 1})\x1b[0;m`);
      const again = await runJob(machine, forge, p, { ...rec, status: 'running' }, job, cfg);
      rec.log = maskLog(lines.join('\n') + '\n', s);
      return { seconds: seconds + again.seconds };
    }
  }
  rec.log = maskLog(lines.join('\n') + '\n', s);
  machine.emit({ t: 'ci.job', pipeline: String(p.id), job: job.name, status: rec.status, runner: rec.runner });
  m.dispose();
  return { seconds: Math.round(seconds) };
}

function writeTo(fs: SimMachineApi['rootFs'], abs: string, text: string): void {
  const d = abs.slice(0, abs.lastIndexOf('/'));
  if (!fs.exists(d)) fs.mkdir(d, { parents: true });
  fs.writeFile(abs, text);
}

/** Files under `dir` matching an artifact/cache path (a file, a directory, or a glob). */
function collect(fs: SimMachineApi['rootFs'], dir: string, pattern: string): string[] {
  const all: string[] = [];
  const walk = (abs: string, rel: string) => {
    for (const e of fs.readdir(abs)) {
      if (!rel && e === '.git') continue;
      const a = `${abs}/${e}`;
      const r = rel ? `${rel}/${e}` : e;
      if (fs.stat(a)?.type === 'd') walk(a, r);
      else all.push(r);
    }
  };
  walk(dir, '');
  const p = pattern.replace(/^\.\//, '');
  return all.filter((f) => globMatch(p, f));
}

function resolveCacheKey(job: CiJob, env: Record<string, string>, read: (f: string) => string): string {
  if (job.cache!.keyFiles?.length) {
    let h = 0;
    for (const f of job.cache!.keyFiles) for (const ch of read(f)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `${h.toString(16).padStart(8, '0')}${'0'.repeat(32)}`.slice(0, 40);
  }
  return job.cache!.key.replace(/\$\{?([A-Z_][A-Z0-9_]*)\}?/g, (_, v: string) => env[v] ?? '');
}

/** Play a manual job. */
export async function playJob(machine: SimMachineApi, forge: ForgeProject, pipelineId: number, job: string): Promise<PipelineRec> {
  return advance(machine, forge, pipelineId, job);
}

/** The push hook: branch and tag pushes create pipelines. */
export async function onPush(ev: PushEvent): Promise<string[]> {
  if (!ev.after) return [];
  await createPipeline(ev.machine, ev.forge, { ref: ev.ref, sha: ev.after, source: 'push', tag: ev.kind === 'tag', before: ev.before });
  if (ev.kind === 'push') {
    // A push to the source branch of an open merge request also runs a merge request pipeline.
    const mr = ev.forge.state().mrs.find((m) => m.state === 'opened' && m.source === ev.ref);
    if (mr) await createPipeline(ev.machine, ev.forge, { ref: ev.ref, sha: ev.after, source: 'merge_request_event', before: ev.before, mr: { iid: mr.iid, source: mr.source, target: mr.target } });
  }
  return [];
}

onForgePush(onPush);

export function plainLog(j: JobRec): string {
  return stripAnsi(j.log).replace(/\x1b\[0K/g, '');
}
