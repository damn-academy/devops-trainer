// Facts scope `ci`: what the forge knows about pipelines, deployments and the
// image registry, so goals check the effect of a push.
//   ci.pipelines[project=team/site][last].status=success
//   ci.pipelines[ref=main][last].jobs[name=test].status=failed
//   ci.deployments[env=staging].sha

import type { FactsProvider, SimMachineApi } from '../../../core/types';
import { ForgeProject } from '../git/forge';
import { plainLog, readPipelines, type PipelineRec } from './run';

export interface CiFacts {
  pipelines: (Omit<PipelineRec, 'jobs'> & { jobs: { name: string; stage: string; status: string; start?: number; end?: number; log: string; cacheHit?: boolean; env?: string; allowFailure: boolean; when: string; artifacts: string[] }[] })[];
  deployments: { project: string; env: string; sha: string; ref: string; job: string; pipeline: number }[];
  registry: { project: string; image: string; tag: string; sha: string }[];
  variables: { project: string; key: string; protected: boolean; masked: boolean; file: boolean }[];
}

export function ciFacts(m: SimMachineApi): CiFacts {
  const out: CiFacts = { pipelines: [], deployments: [], registry: [], variables: [] };
  for (const project of ForgeProject.list(m.rootFs)) {
    const f = new ForgeProject(m.rootFs, project);
    const s = f.state();
    for (const p of readPipelines(f))
      out.pipelines.push({
        ...p,
        jobs: p.jobs.map((j) => ({ name: j.name, stage: j.stage, status: j.status, start: j.start, end: j.end, log: plainLog(j), cacheHit: j.cacheHit, env: j.env, allowFailure: j.allowFailure, when: j.when, artifacts: Object.keys(j.artifacts ?? {}) })),
      });
    for (const d of s.deployments) out.deployments.push({ project, env: d.env, sha: d.sha, ref: d.ref, job: d.job, pipeline: d.pipeline });
    for (const r of s.registry) out.registry.push({ project, ...r });
    for (const v of s.variables) out.variables.push({ project, key: v.key, protected: v.protected, masked: v.masked, file: !!v.file });
  }
  out.pipelines.sort((a, b) => a.id - b.id);
  return out;
}

export const ciFactsProvider: FactsProvider = { scope: 'ci', collect: ciFacts };

/** Last pipeline of a project (optionally for a ref and source), for function checks. */
export function lastPipeline(facts: Record<string, unknown>, o: { ref?: string; source?: string } = {}): CiFacts['pipelines'][number] | undefined {
  const ps = ((facts.ci as CiFacts | undefined)?.pipelines ?? []).filter((p) => (!o.ref || p.ref === o.ref) && (!o.source || p.source === o.source));
  return ps[ps.length - 1];
}
