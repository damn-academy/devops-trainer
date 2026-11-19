// `glab`, the GitLab CLI, against the training forge: CI lint, pipeline status,
// job logs, manual jobs, merge requests and CI/CD variables. The subcommands
// and their flags are those of the real glab; output is shortened but keeps
// the same shape.

import type { CmdContext, ShellCommand } from '../../../core/types';
import { bi } from '../../../core/i18n';
import { ForgeProject, projectOfUrl } from '../git/forge';
import { Repo } from '../git/repo';
import { parseCi } from './config';
import { advance, createPipeline, playJob, plainLog, readPipelines, type JobRec, type PipelineRec } from './run';

const ST: Record<string, string> = {
  success: '\x1b[32m',
  failed: '\x1b[31m',
  running: '\x1b[34m',
  pending: '\x1b[33m',
  manual: '\x1b[35m',
  blocked: '\x1b[35m',
  skipped: '\x1b[90m',
  created: '\x1b[90m',
  canceled: '\x1b[90m',
};
const paint = (ctx: CmdContext, status: string, s: string) => (ctx.isatty ? `${ST[status] ?? ''}${s}\x1b[0m` : s);
const dur = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}m ${String(Math.round(sec % 60)).padStart(2, '0')}s`;

function project(ctx: CmdContext): { forge: ForgeProject; repo: Repo | null } {
  const repo = Repo.find(ctx.fs, ctx.cwd);
  const url = repo?.readConfig(repo.p('config')).get('remote.origin.url');
  const p = url ? projectOfUrl(url) : null;
  if (!p || !ForgeProject.exists(ctx.machine.rootFs, p)) throw new Error('none of the git remotes configured for this repository points to a known GitLab host. Please use `glab auth login` to authenticate and configure a new host for glab.');
  return { forge: new ForgeProject(ctx.machine.rootFs, p, () => (ctx.machine as unknown as { now(): number }).now?.() ?? Date.now()), repo };
}

function flag(args: string[], ...names: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    for (const n of names) {
      if (args[i] === n) return args[i + 1];
      if (args[i].startsWith(n + '=')) return args[i].slice(n.length + 1);
    }
  }
  return undefined;
}

function latest(forge: ForgeProject, ref?: string): PipelineRec | undefined {
  const ps = readPipelines(forge).filter((p) => !ref || p.ref === ref);
  return ps[ps.length - 1];
}

function findJob(p: PipelineRec | undefined, name: string): JobRec | undefined {
  return p?.jobs.find((j) => j.name === name || String(j.id) === name);
}

function printStatus(ctx: CmdContext, p: PipelineRec): void {
  if (p.errors?.length) {
    ctx.out(`${paint(ctx, 'failed', `(${p.status})`)} • yaml invalid\n${p.errors.map((e) => `  line ${e.line}: ${e.message}`).join('\n')}\n`);
  }
  for (const j of p.jobs) {
    const time = j.start !== undefined && j.end !== undefined ? ` • ${dur(j.end - j.start)}` : '';
    ctx.out(`${paint(ctx, j.status, `(${j.status})`)}${time}\t${j.stage}\t\t${j.name}${j.env ? `  → ${j.env}` : ''}${j.allowFailure && j.status === 'failed' ? '  (allowed to fail)' : ''}\n`);
  }
  ctx.out(`\nhttps://forge.edu/${p.project}/-/pipelines/${p.id}\nSHA: ${p.sha}\nPipeline state: ${paint(ctx, p.status, p.status)}${p.duration ? ` • ${dur(p.duration)}` : ''}\n`);
  for (const j of p.jobs) if ((j.status === 'pending' || j.status === 'skipped') && j.reason) ctx.out(`  ${j.name}: ${j.reason}\n`);
}

/** The pipeline graph: one column per stage, as on the pipeline page. */
function printView(ctx: CmdContext, p: PipelineRec): void {
  const cols = p.stages.map((st) => ({ st, jobs: p.jobs.filter((j) => j.stage === st) }));
  const icon = (s: string) => ({ success: '✓', failed: '✗', running: '◐', pending: '◯', manual: '▶', skipped: '»', created: '○', canceled: '⊘' })[s] ?? '?';
  const w = Math.max(14, ...p.jobs.map((j) => j.name.length + 3));
  ctx.out(`Pipeline #${p.id} · ${p.ref} · ${p.sha.slice(0, 8)} · ${p.source} · ${paint(ctx, p.status, p.status)}\n\n`);
  ctx.out(cols.map((c) => c.st.padEnd(w)).join('  ') + '\n');
  const rows = Math.max(...cols.map((c) => c.jobs.length));
  for (let r = 0; r < rows; r++) {
    ctx.out(
      cols
        .map((c) => {
          const j = c.jobs[r];
          if (!j) return ' '.repeat(w);
          return paint(ctx, j.status, `${icon(j.status)} ${j.name}`.padEnd(w));
        })
        .join('  ') + '\n',
    );
  }
  const needs = p.jobs.filter((j) => j.needs);
  if (needs.length) ctx.out(`\nneeds:\n${needs.map((j) => `  ${j.name} ← ${j.needs!.length ? j.needs!.join(', ') : '(nothing: starts at once)'}`).join('\n')}\n`);
  if (p.excluded.length) ctx.out(`\nnot in this pipeline:\n${p.excluded.map((e) => `  ${e.name}: ${e.reason}`).join('\n')}\n`);
}

const HELP = `Work with GitLab CI/CD pipelines, merge requests and variables.

USAGE
  glab <command> <subcommand> [flags]

CORE COMMANDS
  ci:          Work with GitLab CI/CD pipelines and jobs
  mr:          Create, view, and manage merge requests
  variable:    Manage variables for a GitLab project or group

CI SUBCOMMANDS
  glab ci lint                 Checks if your .gitlab-ci.yml file is valid
  glab ci status               View a running CI/CD pipeline on current or other branch
  glab ci view                 View, run, trace, log, and cancel CI/CD job's current pipeline
  glab ci list                 Get the list of CI/CD pipelines
  glab ci trace <job>          Trace a CI/CD job log in real time
  glab ci trigger <job>        Trigger a manual CI/CD job
  glab ci retry <job>          Retry a CI/CD job
  glab ci run [-b <branch>]    Create or run a new CI/CD pipeline

MR SUBCOMMANDS
  glab mr create -s <source> -b <target> -t <title>
  glab mr list | view <id> | merge <id>

VARIABLE SUBCOMMANDS
  glab variable set <key> <value> [--masked] [--protected] [--type env_var|file]
  glab variable set <key> --type file < <file>
  glab variable list | delete <key>
`;

async function ci(ctx: CmdContext, args: string[]): Promise<number> {
  const sub = args[0];
  if (sub === 'lint') {
    const file = args[1] ?? '.gitlab-ci.yml';
    if (!ctx.fs.exists(file)) {
      ctx.err(`ERROR: ${file}: no such file or directory\n`);
      return 1;
    }
    ctx.out(`Getting contents in ${file}\nValidating...\n`);
    const r = parseCi(ctx.fs.readFile(file));
    if (r.errors.length) {
      ctx.out(`${paint(ctx, 'failed', `${file} is invalid`)}\n`);
      r.errors.forEach((e, i) => ctx.out(`${i + 1} line ${e.line}: ${e.message}\n`));
      return 1;
    }
    for (const w of r.warnings) ctx.out(`${paint(ctx, 'pending', 'warning')} line ${w.line}: ${w.message}\n`);
    ctx.out(`${paint(ctx, 'success', '✓ CI/CD YAML is valid!')}\n`);
    return 0;
  }
  const { forge, repo } = project(ctx);
  const branch = flag(args, '-b', '--branch') ?? repo?.currentBranch() ?? 'main';
  if (sub === 'status' || sub === 'view' || sub === 'get') {
    const pid = flag(args, '-p', '--pipeline-id');
    const p = pid ? readPipelines(forge).find((x) => String(x.id) === pid) : latest(forge, branch);
    if (!p) {
      ctx.out(`No pipelines running or available on branch: ${branch}\n`);
      return 0;
    }
    if (sub === 'view') printView(ctx, p);
    else printStatus(ctx, p);
    return 0;
  }
  if (sub === 'list') {
    const ps = readPipelines(forge).slice(-15).reverse();
    ctx.out(`Showing ${ps.length} pipelines on ${forge.project}.\n\n`);
    for (const p of ps) ctx.out(`${paint(ctx, p.status, `(${p.status})`.padEnd(11))} • #${p.id}\t${p.ref}\t${p.source}\t${p.sha.slice(0, 8)}\n`);
    return 0;
  }
  if (sub === 'trace' || sub === 'trigger' || sub === 'retry') {
    const name = args.slice(1).find((a) => !a.startsWith('-'));
    const pid = flag(args, '-p', '--pipeline-id');
    const ps = readPipelines(forge);
    const p = pid ? ps.find((x) => String(x.id) === pid) : [...ps].reverse().find((x) => (!name || findJob(x, name)) && x.ref === branch) ?? [...ps].reverse().find((x) => name && findJob(x, name));
    const j = name ? findJob(p, name) : p?.jobs.find((x) => x.status === 'failed') ?? p?.jobs[p.jobs.length - 1];
    if (!p || !j) {
      ctx.err(`ERROR: no job ${name ?? ''} found${p ? ` in pipeline #${p.id}` : ''}\n`);
      return 1;
    }
    if (sub === 'trace') {
      ctx.out(`Getting job trace...\n${ctx.isatty ? j.log.replace(/\x1b\[0K/g, '') : plainLog(j)}`);
      return 0;
    }
    if (sub === 'trigger') {
      if (j.status !== 'manual') {
        ctx.err(`ERROR: job ${j.name} is not a manual job (status: ${j.status})\n`);
        return 1;
      }
      ctx.out(`Triggered job (id: ${j.id}), status: pending, ref: ${p.ref}, weburl: https://forge.edu/${p.project}/-/jobs/${j.id}\n`);
      const after = await playJob(ctx.machine, forge, p.id, j.name);
      const jj = findJob(after, j.name)!;
      ctx.out(`${j.name}: ${paint(ctx, jj.status, jj.status)}\n`);
      return 0;
    }
    // retry: the job and everything after it runs again on the same commit.
    if (!['failed', 'success', 'canceled', 'skipped'].includes(j.status)) {
      ctx.err(`ERROR: job ${j.name} cannot be retried (status: ${j.status})\n`);
      return 1;
    }
    forge.update((s) => {
      const rec = (s.pipelines as PipelineRec[]).find((x) => x.id === p.id)!;
      for (const x of rec.jobs) if (x.name === j.name || ((x.status === 'skipped' || x.status === 'failed') && x !== j)) Object.assign(x, { status: 'created', log: '', start: undefined, end: undefined, reason: undefined, attempt: 0 });
    });
    const after = await advance(ctx.machine, forge, p.id);
    ctx.out(`Retried job (id: ${j.id}), status: ${findJob(after, j.name)?.status}, ref: ${p.ref}\nPipeline state: ${paint(ctx, after.status, after.status)}\n`);
    return 0;
  }
  if (sub === 'run') {
    const sha = forge.repo.readRef(`refs/heads/${branch}`);
    if (!sha) {
      ctx.err(`ERROR: branch ${branch} does not exist on the forge (push it first)\n`);
      return 1;
    }
    const p = await createPipeline(ctx.machine, forge, { ref: branch, sha, source: 'web' });
    if (!p) {
      ctx.err('ERROR: 400 Bad Request: Missing CI config file\n');
      return 1;
    }
    ctx.out(`Created pipeline (id: ${p.id}), status: ${p.status}, ref: ${p.ref}, weburl: https://forge.edu/${p.project}/-/pipelines/${p.id}\n`);
    return 0;
  }
  ctx.err(`Unknown command "${sub ?? ''}" for "glab ci"\n`);
  return 1;
}

async function mr(ctx: CmdContext, args: string[]): Promise<number> {
  const sub = args[0];
  const { forge, repo } = project(ctx);
  const st = forge.state();
  if (sub === 'create') {
    const source = flag(args, '-s', '--source-branch') ?? repo?.currentBranch() ?? '';
    const target = flag(args, '-b', '--target-branch') ?? st.defaultBranch;
    const head = forge.repo.readRef(`refs/heads/${source}`);
    if (!head) {
      ctx.err(`ERROR: the source branch ${source} is not on the forge. Push it first: git push -u origin ${source}\n`);
      return 1;
    }
    if (st.mrs.some((m) => m.state === 'opened' && m.source === source && m.target === target)) {
      ctx.err(`ERROR: 409 Conflict: Another open merge request already exists for this source branch\n`);
      return 1;
    }
    const last = forge.repo.readCommit(head).message.split('\n')[0];
    const title = flag(args, '-t', '--title') ?? (args.includes('-f') || args.includes('--fill') ? last : '');
    if (!title) {
      ctx.err('ERROR: title can\'t be blank (use --title or --fill)\n');
      return 1;
    }
    const iid = forge.update((s) => {
      const id = s.next.mr++;
      s.mrs.push({ iid: id, title, source, target, state: 'opened', author: ctx.user.name, notes: [] });
      return id;
    });
    ctx.out(`\nCreating merge request for ${source} into ${target} in ${forge.project}\n\n!${iid} ${title} (${source})\n https://forge.edu/${forge.project}/-/merge_requests/${iid}\n\n`);
    await createPipeline(ctx.machine, forge, { ref: source, sha: head, source: 'merge_request_event', mr: { iid, source, target } });
    return 0;
  }
  if (sub === 'list') {
    const open = st.mrs.filter((m) => m.state === 'opened');
    ctx.out(open.length ? `Showing ${open.length} open merge requests on ${forge.project}.\n\n${open.map((m) => `!${m.iid}\t${forge.project}!${m.iid}\t${m.title}\t(${m.target}) ← (${m.source})`).join('\n')}\n` : `No open merge requests match your search in ${forge.project}.\n`);
    return 0;
  }
  const id = Number((args[1] ?? '').replace(/^!/, ''));
  const m = st.mrs.find((x) => x.iid === id) ?? (args[1] ? undefined : st.mrs.find((x) => x.state === 'opened' && x.source === repo?.currentBranch()));
  if (!m) {
    ctx.err(`ERROR: merge request ${args[1] ?? ''} not found\n`);
    return 1;
  }
  const head = forge.repo.readRef(`refs/heads/${m.source}`);
  const pipe = [...readPipelines(forge)].reverse().find((p) => p.sha === head && (p.source === 'merge_request_event' || p.ref === m.source));
  if (sub === 'view') {
    const tgt = forge.repo.readRef(`refs/heads/${m.target}`);
    const behind = tgt && head ? [...forge.repo.ancestors(tgt)].filter((x) => !forge.repo.ancestors(head).has(x)).length : 0;
    ctx.out(`title:\t${m.title}\nstate:\t${m.state}\nauthor:\t${m.author}\nsource:\t${m.source}\ntarget:\t${m.target}\npipeline:\t${pipe ? `#${pipe.id} ${pipe.status}` : 'none'}\n${behind ? `behind:\t${m.source} is ${behind} commit(s) behind ${m.target}\n` : ''}url:\thttps://forge.edu/${forge.project}/-/merge_requests/${m.iid}\n`);
    for (const n of m.notes) ctx.out(`\n${n.author}: ${n.body}\n`);
    return 0;
  }
  if (sub === 'merge') {
    if (m.state !== 'opened') {
      ctx.err(`ERROR: merge request !${m.iid} is ${m.state}\n`);
      return 1;
    }
    if (pipe && pipe.status === 'failed') {
      ctx.err(`ERROR: merge request !${m.iid} is not mergeable: the pipeline #${pipe.id} failed. Fix it and push again.\n`);
      return 1;
    }
    if (pipe && (pipe.status === 'running' || pipe.status === 'pending')) {
      ctx.err(`ERROR: merge request !${m.iid} is not mergeable yet: pipeline #${pipe.id} is ${pipe.status}.\n`);
      return 1;
    }
    const tgt = forge.repo.readRef(`refs/heads/${m.target}`);
    if (!head || !tgt) {
      ctx.err('ERROR: branch not found\n');
      return 1;
    }
    let result = head;
    if (!forge.repo.isAncestor(tgt, head)) {
      // A merge commit made by the forge; conflicts cannot be resolved on the server.
      const base = forge.repo.mergeBase(tgt, head);
      const a = forge.repo.commitFiles(base);
      const b = forge.repo.commitFiles(tgt);
      const c = forge.repo.commitFiles(head);
      const files = new Map(b);
      for (const p of new Set([...a.keys(), ...b.keys(), ...c.keys()])) {
        const x = a.get(p)?.oid;
        const y = b.get(p)?.oid;
        const z = c.get(p)?.oid;
        if (y === z || z === x) continue;
        if (y === x) {
          if (c.get(p)) files.set(p, c.get(p)!);
          else files.delete(p);
          continue;
        }
        ctx.err(`ERROR: merge request !${m.iid} cannot be merged: merge conflicts in ${p}. Merge ${m.target} into ${m.source} locally, resolve and push.\n`);
        return 1;
      }
      const who = { name: ctx.user.name, email: `${ctx.user.name}@forge.edu`, time: (ctx.machine as unknown as { now?: () => number }).now?.() ?? Date.now(), tz: '+0000' };
      result = forge.repo.writeCommit({ tree: forge.repo.buildTree(files), parents: [tgt, head], author: who, committer: who, message: `Merge branch '${m.source}' into '${m.target}'\n\n${m.title}\n\nSee merge request ${forge.project}!${m.iid}` });
    }
    forge.repo.writeRef(`refs/heads/${m.target}`, result, `merge !${m.iid}`);
    forge.update((s) => {
      const x = s.mrs.find((y) => y.iid === m.iid)!;
      x.state = 'merged';
      x.mergeCommit = result;
    });
    ctx.out(`✓ Merged !${m.iid} ${m.title} into ${m.target}\n`);
    await createPipeline(ctx.machine, forge, { ref: m.target, sha: result, source: 'push', before: tgt });
    return 0;
  }
  ctx.err(`Unknown command "${sub ?? ''}" for "glab mr"\n`);
  return 1;
}

function variable(ctx: CmdContext, args: string[]): number {
  const sub = args[0];
  const { forge } = project(ctx);
  if (sub === 'set') {
    const rest: string[] = [];
    let type = 'env_var';
    for (let i = 1; i < args.length; i++) {
      const x = args[i];
      if (x === '--type' || x === '-t') type = args[++i] ?? '';
      else if (x.startsWith('--type=')) type = x.slice(7);
      else if (!x.startsWith('-')) rest.push(x);
    }
    const [key] = rest;
    // Like glab: without a value argument the value is read from standard input.
    const value = rest[1] ?? (ctx.stdin ? ctx.stdin : undefined);
    const masked = args.includes('--masked') || args.includes('-m');
    const prot = args.includes('--protected') || args.includes('-p');
    if (!key || value === undefined) {
      ctx.err('ERROR: usage: glab variable set <key> <value> [--masked] [--protected] [--type env_var|file]\n');
      return 1;
    }
    if (type !== 'env_var' && type !== 'file') {
      ctx.err(`ERROR: invalid type "${type}": must be env_var or file\n`);
      return 1;
    }
    if (!/^[A-Za-z0-9_]+$/.test(key)) {
      ctx.err(`ERROR: 400 Bad Request: {key: [can contain only letters, digits and '_'.]}\n`);
      return 1;
    }
    if (masked && (value.length < 8 || /\s/.test(value))) {
      ctx.err('ERROR: 400 Bad Request: {value: [is invalid]}\n(a masked value must be at least 8 characters long and must not contain spaces)\n');
      return 1;
    }
    const file = type === 'file';
    forge.update((s) => {
      s.variables = s.variables.filter((v) => v.key !== key);
      s.variables.push({ key, value, masked, protected: prot, ...(file ? { file: true } : {}) });
    });
    ctx.out(`✓ Created variable ${key} for ${forge.project}${prot ? ' (protected)' : ''}${masked ? ' (masked)' : ''}${file ? ' (file)' : ''}\n`);
    return 0;
  }
  if (sub === 'list') {
    const vs = forge.state().variables;
    ctx.out(`KEY\tTYPE\tPROTECTED\tMASKED\tVALUE\n${vs.map((v) => `${v.key}\t${v.file ? 'file' : 'env_var'}\t${v.protected}\t${v.masked}\t${v.masked ? '********' : v.file ? '(file contents)' : v.value}`).join('\n')}\n`);
    return 0;
  }
  if (sub === 'delete') {
    forge.update((s) => (s.variables = s.variables.filter((v) => v.key !== args[1])));
    ctx.out(`✓ Deleted variable ${args[1]}\n`);
    return 0;
  }
  ctx.err(`Unknown command "${sub ?? ''}" for "glab variable"\n`);
  return 1;
}

export const glabCommand: ShellCommand = {
  name: 'glab',
  summary: bi('GitLab CLI: пайплайны, merge request и переменные учебного forge.', 'GitLab CLI: pipelines, merge requests and variables on the training forge.'),
  help: HELP,
  async run(ctx) {
    const [group, ...rest] = ctx.argv.slice(1);
    try {
      if (group === 'ci') return await ci(ctx, rest);
      if (group === 'mr') return await mr(ctx, rest);
      if (group === 'variable') return variable(ctx, rest);
      if (!group || group === 'help') {
        ctx.out(HELP);
        return 0;
      }
      ctx.err(`Unknown command "${group}" for "glab"\n`);
      return 1;
    } catch (e) {
      ctx.err(`ERROR: ${(e as Error).message}\n`);
      return 1;
    }
  },
  complete(args) {
    if (args.length <= 1) return ['ci', 'mr', 'variable'];
    if (args[0] === 'ci') return ['lint', 'status', 'view', 'list', 'trace', 'trigger', 'retry', 'run'];
    if (args[0] === 'mr') return ['create', 'list', 'view', 'merge'];
    if (args[0] === 'variable') return ['set', 'list', 'delete'];
    return [];
  },
};
