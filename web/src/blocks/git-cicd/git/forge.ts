// The training forge (a small GitLab): bare repositories under /srv/forge on
// the same simulated machine, plus project state in forge.json next to each
// bare repository — merge requests, pipelines, CI/CD variables, runners,
// environments and the image registry. Because all of it is in the virtual
// file system, a snapshot of the machine keeps the forge too.
//
// URLs: https://forge.edu/<group>/<name>.git ↔ /srv/forge/<group>/<name>.git

import type { FsApi, SimMachineApi } from '../../../core/types';
import { Repo } from './repo';

export const FORGE_HOST = 'forge.edu';
export const FORGE_ROOT = '/srv/forge';

export interface MergeRequest {
  iid: number;
  title: string;
  source: string;
  target: string;
  state: 'opened' | 'merged' | 'closed';
  author: string;
  mergeCommit?: string;
  notes: { author: string; body: string }[];
}

export interface CiVariable {
  key: string;
  value: string;
  protected: boolean;
  masked: boolean;
  /** A File-type variable: the runner writes the value to a temporary file and the variable holds its path. */
  file?: boolean;
}

export interface Runner {
  id: number;
  description: string;
  tags: string[];
  online: boolean;
  executor: 'docker' | 'shell';
  /** Jobs this runner runs at the same time (`concurrent` in config.toml). */
  concurrent: number;
}

export interface Deployment {
  env: string;
  sha: string;
  ref: string;
  job: string;
  pipeline: number;
  at: number;
  status: 'success' | 'failed';
}

export interface ForgeState {
  project: string;
  defaultBranch: string;
  protectedBranches: string[];
  mrs: MergeRequest[];
  /** Pipelines are kept as opaque records owned by the CI engine. */
  pipelines: unknown[];
  variables: CiVariable[];
  runners: Runner[];
  deployments: Deployment[];
  registry: { image: string; tag: string; sha: string; pipeline: number }[];
  /** Runner-local caches: key → files. */
  cache: Record<string, Record<string, string>>;
  next: { mr: number; pipeline: number; job: number };
}

export function defaultForgeState(project: string): ForgeState {
  return {
    project,
    defaultBranch: 'main',
    protectedBranches: ['main'],
    mrs: [],
    pipelines: [],
    variables: [],
    runners: [{ id: 1, description: 'edu-docker-runner-1', tags: ['docker', 'linux'], online: true, executor: 'docker', concurrent: 2 }],
    deployments: [],
    registry: [],
    cache: {},
    next: { mr: 1, pipeline: 101, job: 1001 },
  };
}

/** Parse a forge URL into the project path ('team/site'), or null if it is not ours. */
export function projectOfUrl(url: string): string | null {
  const m = /^(?:https?:\/\/forge\.edu\/|git@forge\.edu:|ssh:\/\/git@forge\.edu\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? m[1] : null;
}

export function forgeUrl(project: string): string {
  return `https://${FORGE_HOST}/${project}.git`;
}

export function forgePath(project: string): string {
  return `${FORGE_ROOT}/${project}.git`;
}

export class ForgeProject {
  readonly repo: Repo;
  constructor(
    readonly fs: FsApi,
    readonly project: string,
    clock?: () => number,
  ) {
    const r = Repo.open(fs, forgePath(project), clock);
    if (!r) throw new Error(`no forge project ${project}`);
    this.repo = r;
  }

  static exists(fs: FsApi, project: string): boolean {
    return fs.exists(`${forgePath(project)}/HEAD`);
  }

  static create(fs: FsApi, project: string, clock?: () => number): ForgeProject {
    if (!ForgeProject.exists(fs, project)) {
      Repo.init(fs, forgePath(project), { bare: true, clock });
      fs.writeFile(`${forgePath(project)}/forge.json`, JSON.stringify(defaultForgeState(project), null, 1));
    }
    return new ForgeProject(fs, project, clock);
  }

  /** Every project on the forge. */
  static list(fs: FsApi): string[] {
    const out: string[] = [];
    if (!fs.exists(FORGE_ROOT)) return out;
    for (const g of fs.readdir(FORGE_ROOT)) {
      const gd = `${FORGE_ROOT}/${g}`;
      if (fs.stat(gd)?.type !== 'd') continue;
      for (const n of fs.readdir(gd)) if (n.endsWith('.git') && fs.exists(`${gd}/${n}/HEAD`)) out.push(`${g}/${n.slice(0, -4)}`);
    }
    return out;
  }

  get statePath(): string {
    return `${forgePath(this.project)}/forge.json`;
  }

  state(): ForgeState {
    try {
      return { ...defaultForgeState(this.project), ...(JSON.parse(this.fs.readFile(this.statePath)) as Partial<ForgeState>) };
    } catch {
      return defaultForgeState(this.project);
    }
  }

  save(s: ForgeState): void {
    this.fs.writeFile(this.statePath, JSON.stringify(s, null, 1));
  }

  update<T>(fn: (s: ForgeState) => T): T {
    const s = this.state();
    const r = fn(s);
    this.save(s);
    return r;
  }
}

/** What a push hook sees: the forge project after the refs were updated. */
export interface PushEvent {
  machine: SimMachineApi;
  forge: ForgeProject;
  ref: string;
  before: string | null;
  after: string | null;
  /** 'push' for a branch push, 'tag' when a tag was pushed. */
  kind: 'push' | 'tag';
  user: string;
}

type PushHook = (ev: PushEvent) => Promise<string[]> | string[];
const pushHooks: PushHook[] = [];

/** The CI engine registers here to create pipelines on push; returns lines printed as "remote: …". */
export function onForgePush(hook: PushHook): void {
  if (!pushHooks.includes(hook)) pushHooks.push(hook);
}

export async function firePush(ev: PushEvent): Promise<string[]> {
  const out: string[] = [];
  for (const h of pushHooks) out.push(...(await h(ev)));
  return out;
}
