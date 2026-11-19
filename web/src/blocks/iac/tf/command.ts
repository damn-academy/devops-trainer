// `terraform` and `tofu` on the simulated machine: init, validate, fmt, plan,
// apply, destroy, show, output, state list/show, version, providers and the
// -help pages. One command with two names, as in the course (06 §5.1).

import type { CmdContext, ShellCommand } from '../../../core/types';
import { bi } from '../../../core/i18n';
import { publish } from '../../git-cicd/shared/hub';
import { Cloud } from './cloud';
import { apply, buildState, changedOutputs, COLOR, emptyState, fmtValue, groupInstances, hasWork, loadConfig, NO_COLOR, parseAddr, parseTfvars, plan, PROVIDER, renderPlan, resolveVars, resourceDeps, stateInstances, summary, TF_VERSION, TfError, type Colors, type Plan, type StateFile } from './engine';
import { formatDiag, isUnknown } from './hcl';

const HELP: Record<string, string> = {
  main: `Usage: terraform [global options] <subcommand> [args]

The available commands for execution are listed below.
The primary workflow commands are given first, followed by
less common or more advanced commands.

Main commands:
  init          Prepare your working directory for other commands
  validate      Check whether the configuration is valid
  plan          Show changes required by the current configuration
  apply         Create or update infrastructure
  destroy       Destroy previously-created infrastructure

All other commands:
  fmt           Reformat your configuration in the standard style
  output        Show output values from your root module
  providers     Show the providers required for this configuration
  show          Show the current state or a saved plan
  import        Associate existing infrastructure with a Terraform resource
  state         Advanced state management
  version       Show the current Terraform version

Global options (use these before the subcommand, if any):
  -chdir=DIR    Switch to a different working directory before executing the
                given subcommand.
  -help         Show this help output, or the help for a specified subcommand.
  -version      An alias for the "version" subcommand.
`,
  plan: `Usage: terraform [global options] plan [options]

  Generates a speculative execution plan, showing what actions Terraform
  would take to apply the current configuration. This command will not
  actually perform the planned actions.

Plan Customization Options:

  The following options customize how Terraform will produce its plan. You
  can also use these options when you run "terraform apply" without passing
  it a saved plan, in order to plan and apply in a single command.

  -detailed-exitcode  Return detailed exit codes when the command exits. This
                      will change the meaning of exit codes to:
                      0 - Succeeded, diff is empty (no changes)
                      1 - Errored
                      2 - Succeeded, there is a diff

  -destroy            Select the "destroy" planning mode, which creates a plan
                      to destroy all objects currently managed by this
                      Terraform configuration instead of the usual behavior.

  -refresh-only       Select the "refresh only" planning mode, which checks
                      whether remote objects still match the outcome of the
                      most recent Terraform apply but does not propose any
                      actions to undo any changes made outside of Terraform.

  -refresh=false      Skip checking for external changes to remote objects
                      while creating the plan. This can potentially make
                      planning faster, but at the expense of possibly planning
                      against a stale record of the remote system state.

  -replace=resource   Force replacement of a particular resource instance using
                      its resource address. If the plan would've normally
                      produced an update or no-op action for this instance,
                      Terraform will plan to replace it instead. You can use
                      this option multiple times to replace more than one object.

  -target=resource    Limit the planning operation to only the given module,
                      resource, or resource instance and all of its
                      dependencies. You can use this option multiple times to
                      include more than one object. This is for exceptional
                      use only.

  -var 'foo=bar'      Set a value for one of the input variables in the root
                      module of the configuration. Use this option more than
                      once to set more than one variable.

  -var-file=filename  Load variable values from the given file, in addition
                      to the default files terraform.tfvars and *.auto.tfvars.
                      Use this option more than once to include more than one
                      variables file.

Other Options:

  -no-color           If specified, output won't contain any color.
`,
  apply: `Usage: terraform [global options] apply [options] [PLAN]

  Creates or updates infrastructure according to Terraform configuration
  files in the current directory.

  By default, Terraform will generate a new plan and present it for your
  approval before taking any action.

Options:

  -auto-approve          Skip interactive approval of plan before applying.

  -no-color              If specified, output won't contain any color.

  -parallelism=n         Limit the number of parallel resource operations.
                         Defaults to 10.

  If you don't provide a saved plan file then this command will also accept
  all of the plan-customization options accepted by the terraform plan command.
  For more information on those options, run:
      terraform plan -help
`,
  init: `Usage: terraform [global options] init [options]

  Initialize a new or existing Terraform working directory by creating
  initial files, loading any remote state, downloading modules, etc.

  This is the first command that should be run for any new or existing
  Terraform configuration per machine. This sets up all the local data
  necessary to run Terraform that is typically not committed to version
  control.

  This command is always safe to run multiple times.

Options:

  -upgrade                Install the latest module and provider versions
                          allowed within configured constraints.
`,
  destroy: `Usage: terraform [global options] destroy [options]

  Destroy Terraform-managed infrastructure.

  This command is a convenience alias for:
      terraform apply -destroy

  This command also accepts many of the plan-customization options accepted by
  the terraform plan command. For more information on those options, run:
      terraform plan -help
`,
  import: `Usage: terraform [global options] import [options] ADDR ID

  Import existing infrastructure into your Terraform state.

  This will find and import the specified resource into your Terraform
  state, allowing existing infrastructure to come under Terraform
  management without having to be initially created by Terraform.

  The ADDR specified is the address to import the resource to. Please
  see the documentation online for resource addresses. The ID is a
  resource-specific ID to identify that resource being imported. Please
  reference the documentation for the resource type you're importing to
  determine the ID syntax to use. It typically matches directly to the ID
  that the provider uses.

  This command will not modify your infrastructure, but it will make
  network requests to inspect parts of your infrastructure relevant to
  the resource being imported.

  The current implementation of Terraform import can only import resources
  into the state. It does not generate configuration. A future version of
  Terraform will also generate configuration.

  Because of this, prior to running terraform import it is necessary to write
  a resource configuration block for the resource manually, to which the
  imported object will be attached.

  Alternatively, an "import" block in the configuration brings the object in
  during the next "terraform apply" and shows it in the plan first.
`,
  state: `Usage: terraform [global options] state <subcommand> [options] [args]

  This command has subcommands for advanced state management.

Subcommands:
    list                List resources in the state
    mv                  Move an item in the state
    rm                  Remove instances from the state
    show                Show a resource in the state
`,
};

interface Opts {
  vars: Record<string, string>;
  varFiles: string[];
  autoApprove: boolean;
  refresh: boolean;
  replace: string[];
  target: string[];
  destroy: boolean;
  color: boolean;
  check: boolean;
  refreshOnly: boolean;
  detailedExit: boolean;
  rest: string[];
}

function parseOpts(args: string[]): Opts {
  const o: Opts = { vars: {}, varFiles: [], autoApprove: false, refresh: true, replace: [], target: [], destroy: false, color: true, check: false, refreshOnly: false, detailedExit: false, rest: [] };
  for (let i = 0; i < args.length; i++) {
    let a = args[i];
    if (a.startsWith('--')) a = a.slice(1);
    const val = () => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[++i] ?? '');
    if (a === '-auto-approve') o.autoApprove = true;
    else if (a === '-refresh=false') o.refresh = false;
    else if (a === '-refresh=true') o.refresh = true;
    else if (a.startsWith('-replace')) o.replace.push(val());
    else if (a.startsWith('-target')) o.target.push(val());
    else if (a === '-var' || a.startsWith('-var=')) {
      const kv = val();
      const eq = kv.indexOf('=');
      o.vars[kv.slice(0, eq)] = kv.slice(eq + 1).replace(/^"(.*)"$/, '$1');
    } else if (a.startsWith('-var-file')) o.varFiles.push(val());
    else if (a === '-destroy') o.destroy = true;
    else if (a === '-refresh-only') o.refreshOnly = true;
    else if (a === '-detailed-exitcode') o.detailedExit = true;
    else if (a === '-no-color') o.color = false;
    else if (a === '-check') o.check = true;
    else if (a === '-input=false' || a === '-upgrade' || a.startsWith('-parallelism') || a === '-compact-warnings' || a === '-recursive') continue;
    else o.rest.push(args[i]);
  }
  return o;
}

function clock(ctx: CmdContext): () => number {
  const m = ctx.machine as unknown as { now?: () => number };
  return () => m.now?.() ?? Date.now();
}

function readState(ctx: CmdContext): StateFile | null {
  if (!ctx.fs.exists('terraform.tfstate')) return null;
  try {
    return JSON.parse(ctx.fs.readFile('terraform.tfstate')) as StateFile;
  } catch {
    return null;
  }
}

function writeState(ctx: CmdContext, s: StateFile): void {
  if (ctx.fs.exists('terraform.tfstate')) ctx.fs.writeFile('terraform.tfstate.backup', ctx.fs.readFile('terraform.tfstate'));
  ctx.fs.writeFile('terraform.tfstate', JSON.stringify(s, null, 2) + '\n');
}

const initialized = (ctx: CmdContext) => ctx.fs.exists('.terraform.lock.hcl') && ctx.fs.exists('.terraform/providers');

function printDiags(ctx: CmdContext, e: TfError, files: Record<string, string>, col: Colors): number {
  for (const d of e.diags) ctx.err('\n' + formatDiag(d, files, col !== NO_COLOR));
  return 1;
}

function lineage(ctx: CmdContext): string {
  const n = clock(ctx)().toString(16);
  return `${n.slice(-8)}-1f2e-4d3c-8b7a-${n.padStart(12, '0').slice(-12)}`;
}

function vars(ctx: CmdContext, o: Opts, cfg: ReturnType<typeof loadConfig>) {
  const tfvars: Record<string, string> = {};
  for (const f of ['terraform.tfvars', ...ctx.fs.readdir('.').filter((n) => n.endsWith('.auto.tfvars')), ...o.varFiles]) {
    if (ctx.fs.exists(f)) Object.assign(tfvars, parseTfvars(ctx.fs.readFile(f)));
    else if (o.varFiles.includes(f)) throw new TfError([{ severity: 'error', summary: 'Failed to read variables file', detail: `Given variables file ${f} does not exist.` }]);
  }
  const r = resolveVars(cfg, o.vars, tfvars, ctx.env);
  if (r.diags.length) throw new TfError(r.diags);
  return r.vars;
}

function savePlanFact(ctx: CmdContext, p: Plan, kind: string, applied: boolean): void {
  const s = summary(p);
  if (!ctx.fs.exists('.terraform')) ctx.fs.mkdir('.terraform', { parents: true });
  const rec = { kind, applied, ...s, moved: p.moves, imported: p.imports.map((i) => i.addr), drift: p.drift.map((d) => ({ addr: d.addr, kind: d.kind })), actions: p.changes.filter((c) => c.action !== 'noop').map((c) => ({ addr: c.addr, action: c.action, forces: c.forces, createBeforeDestroy: c.createBeforeDestroy })), targeted: p.targeted, refresh: true };
  ctx.fs.writeFile('.terraform/last-plan.json', JSON.stringify(rec, null, 1) + '\n');
  ctx.machine.emit({ t: 'tf.step', phase: applied ? 'apply' : 'plan', ...s });
  publish({ t: 'tf.plan', dir: ctx.cwd, plan: rec });
}

async function run(ctx: CmdContext): Promise<number> {
  let args = ctx.argv.slice(1);
  const chdir = args.find((a) => a.startsWith('-chdir='));
  if (chdir) {
    args = args.filter((a) => a !== chdir);
    const dir = chdir.slice(7);
    const r = await ctx.shell.run(`cd ${dir} && ${ctx.argv[0]} ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`);
    ctx.out(r.out);
    ctx.err(r.err);
    return r.exit;
  }
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === '-help' || sub === '-h' || sub === '--help') {
    ctx.out(HELP.main);
    return sub ? 0 : 127;
  }
  if (rest.includes('-help') || rest.includes('--help') || rest.includes('-h')) {
    ctx.out(HELP[sub] ?? HELP.main);
    return 0;
  }
  if (sub === 'version' || sub === '-version' || sub === '-v' || sub === '--version') {
    ctx.out(`Terraform v${TF_VERSION}\non linux_amd64${ctx.fs.exists('.terraform/providers') ? `\n+ provider ${PROVIDER.source} v${PROVIDER.version}` : ''}\n`);
    return 0;
  }
  const o = parseOpts(rest);
  const col = o.color && ctx.isatty ? COLOR : NO_COLOR;
  const cloud = new Cloud(ctx.machine.rootFs, clock(ctx));
  let cfgFiles: Record<string, string> = {};
  try {
    if (sub === 'fmt') return fmt(ctx, o);
    if (sub === 'state') return stateCmd(ctx, o);
    if (sub === 'show') return show(ctx, col);
    if (sub === 'output') {
      const s = readState(ctx);
      const outs = Object.entries(s?.outputs ?? {});
      if (!outs.length) {
        ctx.err('\n' + formatDiag({ severity: 'warning', summary: 'No outputs found', detail: 'The state file either has no outputs defined, or all the defined outputs are empty. Please define an output in your configuration with the `output` keyword and run `terraform refresh` for it to become available. If you are using interpolation, please verify the interpolated value is not empty. You can use the `terraform console` command to assist.' }, {}, col !== NO_COLOR));
        return 0;
      }
      // Flags (-raw, -json, -no-color) land in o.rest too; the output name is the first non-flag.
      const name = o.rest.find((a) => !a.startsWith('-'));
      if (name) {
        const v = s!.outputs[name];
        if (!v) {
          ctx.err(`\n${formatDiag({ severity: 'error', summary: 'Output "' + name + '" not found', detail: 'The output variable requested could not be found in the state file. If you recently added this to your configuration, be sure to run `terraform apply`, since the state won\'t be updated with new output variables until that command is run.' }, {}, false)}`);
          return 1;
        }
        ctx.out((rest.includes('-raw') ? String(v.value) : fmtValue(v.value, '')) + (rest.includes('-raw') ? '' : '\n'));
        return 0;
      }
      for (const [k, v] of outs) ctx.out(`${k} = ${fmtValue(v.value, '')}\n`);
      return 0;
    }
    const cfg = loadConfig(ctx.fs, '.');
    cfgFiles = cfg.files;
    if (sub === 'init') {
      ctx.out(`\n${col.b('Initializing the backend...')}\n`);
      if (cfg.modules.size) {
        ctx.out(`${col.b('Initializing modules...')}\n`);
        for (const [n, m] of cfg.modules) ctx.out(`- ${n} in ${m.dir}\n`);
        ctx.fs.mkdir('.terraform/modules', { parents: true });
        ctx.fs.writeFile('.terraform/modules/modules.json', JSON.stringify({ Modules: [{ Key: '', Source: '', Dir: '.' }, ...[...cfg.modules].map(([n, m]) => ({ Key: n, Source: m.source, Dir: m.dir }))] }) + '\n');
      }
      ctx.out(`\n${col.b('Initializing provider plugins...')}\n- Finding edu/edu versions matching "~> 1.4"...\n- Installing edu/edu v${PROVIDER.version}...\n- Installed edu/edu v${PROVIDER.version} (signed by Edu Cloud)\n`);
      ctx.fs.mkdir('.terraform/providers/registry.terraform.io/edu/edu/1.4.0/linux_amd64', { parents: true });
      ctx.fs.writeFile('.terraform/providers/registry.terraform.io/edu/edu/1.4.0/linux_amd64/terraform-provider-edu_v1.4.0', '#!/usr/bin/sim\n# provider plugin (simulated)\n');
      if (!ctx.fs.exists('.terraform.lock.hcl')) {
        ctx.fs.writeFile('.terraform.lock.hcl', `# This file is maintained automatically by "terraform init".\n# Manual edits may be lost in future updates.\n\nprovider "${PROVIDER.source}" {\n  version     = "${PROVIDER.version}"\n  constraints = "~> 1.4"\n  hashes = [\n    "h1:Wq1r7J3Xc2y0vKZ9eW2kP8m3vT6nQ0yH5uB4aL1sD9g=",\n  ]\n}\n`);
        ctx.out(`\nTerraform has created a lock file ${col.b('.terraform.lock.hcl')} to record the provider\nselections it made above. Include this file in your version control repository\nso that Terraform can guarantee to make the same selections by default when\nyou run "terraform init" in the future.\n`);
      }
      ctx.out(`\n${col.g(col.b('Terraform has been successfully initialized!'))}\n\nYou may now begin working with Terraform. Try running "terraform plan" to see\nany changes that are required for your infrastructure. All Terraform commands\nshould now work.\n`);
      return 0;
    }
    if (!initialized(ctx)) {
      ctx.err('\n' + formatDiag({ severity: 'error', summary: 'Inconsistent dependency lock file', detail: `The following dependency selections recorded in the lock file are inconsistent with the\ncurrent configuration:\n  - provider ${PROVIDER.source}: required by this configuration but no version is selected\n\nTo make the initial dependency selections that will initialize the dependency lock file,\nrun:\n  terraform init` }, {}, col !== NO_COLOR));
      return 1;
    }
    const missing = [...cfg.modules.keys()].filter((n) => !installedModules(ctx).includes(n));
    if (missing.length) {
      ctx.err('\n' + formatDiag({ severity: 'error', summary: 'Module not installed', detail: `This module is not yet installed. Run "terraform init" to install all modules required by this configuration.`, context: `module "${missing[0]}"` }, {}, col !== NO_COLOR));
      return 1;
    }
    if (sub === 'import') return importCmd(ctx, cfg, cloud, o, col);
    if (sub === 'validate') {
      vars(ctx, { ...o }, cfg);
      ctx.out(`${col.g(col.b('Success!'))} The configuration is valid.\n\n`);
      return 0;
    }
    if (sub === 'providers') {
      ctx.out(`\nProviders required by configuration:\n.\n└── provider[${PROVIDER.source}] ~> 1.4\n\nProviders required by state:\n\n    provider[${PROVIDER.source}]\n\n`);
      return 0;
    }
    if (sub === 'plan' || sub === 'apply' || sub === 'destroy') {
      const destroy = sub === 'destroy' || o.destroy;
      const prior = readState(ctx);
      const p = plan(cfg, prior, cloud, { vars: vars(ctx, o, cfg), refresh: o.refresh, replace: o.replace, destroy, target: o.target });
      const refreshLines = o.refresh ? stateInstances(prior).map((i) => `${i.addr}: Refreshing state... [id=${i.attrs.id}]`).join('\n') : '';
      if (refreshLines) ctx.out(refreshLines + '\n');
      if (o.refreshOnly) return refreshOnly(ctx, sub, p, prior, o, col);
      ctx.out(renderPlan(p, col, destroy ? 'destroy' : sub === 'plan' ? 'plan' : 'apply'));
      const s = summary(p);
      const nothing = !hasWork(p) && (destroy || !changedOutputs(p).length);
      if (sub === 'plan') {
        if (!nothing) ctx.out(`\n${'─'.repeat(77)}\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run "terraform apply" now.\n`);
        savePlanFact(ctx, p, destroy ? 'destroy' : 'plan', false);
        return o.detailedExit && !nothing ? 2 : 0;
      }
      if (nothing) {
        const st = prior ?? emptyState(lineage(ctx));
        if (p.drift.length || !prior) writeState(ctx, { ...st, serial: st.serial + (p.drift.length ? 1 : 0), resources: prior ? st.resources : [] });
        ctx.out(`\n${col.g(col.b(`${destroy ? 'Destroy' : 'Apply'} complete! Resources: 0 ${destroy ? 'destroyed' : 'added, 0 changed, 0 destroyed'}.`))}\n`);
        savePlanFact(ctx, p, destroy ? 'destroy' : 'apply', true);
        return 0;
      }
      const yes = o.autoApprove || /^\s*yes\s*$/m.test(ctx.stdin);
      ctx.out(`\n${col.b(destroy ? 'Do you really want to destroy all resources?' : 'Do you want to perform these actions?')}\n  Terraform will perform the actions described above.\n  Only 'yes' will be accepted to ${destroy ? 'confirm' : 'approve'}.\n\n  ${col.b('Enter a value:')} ${yes ? 'yes' : ''}\n\n`);
      if (!yes) {
        ctx.err(`\n${formatDiag({ severity: 'error', summary: `${destroy ? 'Destroy' : 'Apply'} cancelled`, detail: 'The simulated terminal cannot answer prompts: pipe the answer in (echo yes | terraform apply) or pass -auto-approve.' }, {}, col !== NO_COLOR)}`);
        return 1;
      }
      const res = apply(cfg, prior ?? emptyState(lineage(ctx)), p, cloud, col, (st) => writeState(ctx, st));
      ctx.out(res.log);
      savePlanFact(ctx, p, destroy ? 'destroy' : 'apply', !res.error);
      if (res.error) return 1;
      ctx.out(
        destroy
          ? `\n${col.g(col.b(`Destroy complete! Resources: ${res.done.destroy} destroyed.`))}\n`
          : `\n${col.g(col.b(`Apply complete! Resources: ${res.done.import ? `${res.done.import} imported, ` : ''}${res.done.add} added, ${res.done.change} changed, ${res.done.destroy} destroyed.`))}\n`,
      );
      const outs = Object.entries(res.state.outputs);
      if (outs.length && !destroy) ctx.out(`\n${col.g(col.b('Outputs:'))}\n\n${outs.map(([k, v]) => `${k} = ${fmtValue(v.value, '')}`).join('\n')}\n`);
      void s;
      return 0;
    }
    ctx.err(`Terraform has no command named "${sub}".\n\nTo see all of Terraform's top-level commands, run:\n  terraform -help\n\n`);
    return 1;
  } catch (e) {
    if (e instanceof TfError) return printDiags(ctx, e, e.files ?? cfgFiles, col);
    throw e;
  }
}

function show(ctx: CmdContext, col: Colors): number {
  const s = readState(ctx);
  const insts = stateInstances(s);
  if (!insts.length) {
    ctx.out('No state.\n');
    return 0;
  }
  for (const i of insts) {
    const keys = Object.keys(i.attrs).sort();
    const w = Math.max(...keys.map((k) => k.length));
    ctx.out(`${col.b(`# ${i.addr}:`)}\nresource "${i.type}" "${i.name}" {\n${keys.map((k) => `    ${k.padEnd(w)} = ${fmtValue(i.attrs[k], '    ')}`).join('\n')}\n}\n\n`);
  }
  const outs = Object.entries(s?.outputs ?? {});
  if (outs.length) ctx.out(`\nOutputs:\n\n${outs.map(([k, v]) => `${k} = ${fmtValue(v.value, '')}`).join('\n')}\n`);
  return 0;
}

function stateCmd(ctx: CmdContext, o: Opts): number {
  const [sub, ...args] = o.rest;
  const s = readState(ctx);
  if (!s) {
    ctx.err('No state file was found!\n\nState management commands require a state file. Run this command\nin a directory where Terraform has been run or use the -state flag\nto point the command to another state file.\n');
    return 1;
  }
  const insts = stateInstances(s);
  if (sub === 'list') {
    for (const i of insts) if (!args.length || args.some((a) => i.addr === a || i.addr.startsWith(a + '[') || i.addr.startsWith(a + '.'))) ctx.out(i.addr + '\n');
    return 0;
  }
  if (sub === 'show') {
    const i = insts.find((x) => x.addr === args[0]);
    if (!i) {
      ctx.err(`No instance found for the given address!\n\nThis command requires that the address references one specific instance.\nTo view the available instances, use "terraform state list". Please modify\nthe address to reference a specific instance.\n`);
      return 1;
    }
    const keys = Object.keys(i.attrs).sort();
    const w = Math.max(...keys.map((k) => k.length));
    ctx.out(`# ${i.addr}:\nresource "${i.type}" "${i.name}" {\n${keys.map((k) => `    ${k.padEnd(w)} = ${fmtValue(i.attrs[k], '    ')}`).join('\n')}\n}\n`);
    return 0;
  }
  if (sub === 'rm') {
    const keep = insts.filter((i) => !args.includes(i.addr));
    const removed = insts.length - keep.length;
    if (!removed) {
      ctx.err(`Error: Invalid target address\n\nNo matching objects found.\n`);
      return 1;
    }
    for (const a of args) ctx.out(`Removed ${a}\n`);
    ctx.out(`Successfully removed ${removed} resource instance(s).\n`);
    writeState(ctx, { ...s, serial: s.serial + 1, resources: groupBack(keep) });
    return 0;
  }
  if (sub === 'mv') {
    const [from, to] = args;
    const i = insts.find((x) => x.addr === from);
    if (!i || !to) {
      ctx.err('Error: Invalid source address\n');
      return 1;
    }
    const m = parseAddr(to);
    if (!m) {
      ctx.err('Error: Invalid target address\n');
      return 1;
    }
    const moved = insts.map((x) => (x === i ? { ...x, addr: to, type: m.type, name: m.name, module: m.module, index: m.index } : x));
    writeState(ctx, { ...s, serial: s.serial + 1, resources: groupBack(moved) });
    ctx.out(`Move "${from}" to "${to}"\nSuccessfully moved 1 object(s).\n`);
    return 0;
  }
  ctx.out(HELP.state);
  return sub ? 1 : 0;
}

const groupBack = groupInstances;

function installedModules(ctx: CmdContext): string[] {
  try {
    return (JSON.parse(ctx.fs.readFile('.terraform/modules/modules.json')) as { Modules: { Key: string }[] }).Modules.map((m) => m.Key).filter(Boolean);
  } catch {
    return [];
  }
}

/** plan/apply -refresh-only: record what changed outside Terraform in the state, propose nothing. */
function refreshOnly(ctx: CmdContext, sub: string, p: Plan, prior: StateFile | null, o: Opts, col: Colors): number {
  const drift = p.drift;
  if (!drift.length) {
    ctx.out(`\n${col.g(col.b('No changes.'))} ${col.b('Your infrastructure still matches the configuration.')}\n\nTerraform has checked that the real remote objects still match the result of\nyour most recent changes, and found no differences.\n`);
    savePlanFact(ctx, { ...p, changes: [], moves: [], imports: [] }, 'refresh-only', sub === 'apply');
    return 0;
  }
  ctx.out(renderPlan({ ...p, changes: [], moves: [], imports: [] }, col, 'plan').replace(/\nUnless you have made equivalent changes[\s\S]*$/, '\n'));
  ctx.out(`\nThis is a refresh-only plan, so Terraform will not take any actions to undo\nthese. If you were expecting these changes then you can apply this plan to\nrecord the updated values in the Terraform state without changing any remote\nobjects.\n`);
  if (sub === 'plan') {
    savePlanFact(ctx, { ...p, changes: [], moves: [], imports: [] }, 'refresh-only', false);
    return o.detailedExit ? 2 : 0;
  }
  const yes = o.autoApprove || /^\s*yes\s*$/m.test(ctx.stdin);
  ctx.out(`\n${col.b('Would you like to update the Terraform state to reflect these detected changes?')}\n  Terraform will write these changes to the state without modifying any real\n  infrastructure.\n  There is no undo. Only 'yes' will be accepted to confirm.\n\n  ${col.b('Enter a value:')} ${yes ? 'yes' : ''}\n\n`);
  if (!yes) {
    ctx.err(`\n${formatDiag({ severity: 'error', summary: 'Apply cancelled', detail: 'The simulated terminal cannot answer prompts: pipe the answer in (echo yes | terraform apply -refresh-only) or pass -auto-approve.' }, {}, col !== NO_COLOR)}`);
    return 1;
  }
  const st = prior ?? emptyState(lineage(ctx));
  writeState(ctx, buildState(st, p.refreshed, st.outputs));
  savePlanFact(ctx, { ...p, changes: [], moves: [], imports: [] }, 'refresh-only', true);
  ctx.out(`\n${col.g(col.b('Apply complete! Resources: 0 added, 0 changed, 0 destroyed.'))}\n`);
  return 0;
}

/** terraform import ADDR ID: attach an existing cloud object to a resource block. */
function importCmd(ctx: CmdContext, cfg: ReturnType<typeof loadConfig>, cloud: Cloud, o: Opts, col: Colors): number {
  const [addr, id] = o.rest;
  if (!addr || !id) {
    ctx.err('The import command expects two arguments.\n' + HELP.import);
    return 1;
  }
  const pa = parseAddr(addr);
  const r = pa && cfg.resources.find((x) => x.type === pa.type && x.name === pa.name && x.module === pa.module);
  if (!pa || !r) {
    ctx.err('\n' + formatDiag({ severity: 'error', summary: 'resource address "' + addr + '" does not exist in the configuration.', detail: `Before importing this resource, please create its configuration in the root module. For example:\n\nresource "${pa?.type ?? 'edu_vm'}" "${pa?.name ?? 'name'}" {\n  # (resource arguments)\n}` }, {}, col !== NO_COLOR));
    return 1;
  }
  const prior = readState(ctx);
  const insts = stateInstances(prior);
  if (insts.some((i) => i.addr === addr)) {
    ctx.err('\n' + formatDiag({ severity: 'error', summary: 'Resource already managed by Terraform', detail: `Terraform is already managing a remote object for ${addr}. To import to this address you must first remove the existing object from the state.` }, {}, col !== NO_COLOR));
    return 1;
  }
  ctx.out(`${col.b(`${addr}: Importing from ID "${id}"...`)}\n`);
  const real = cloud.get(id);
  if (!real || real.type !== pa.type) {
    ctx.err('\n' + formatDiag({ severity: 'error', summary: 'Cannot import non-existent remote object', detail: `While attempting to import an existing object to "${addr}", the provider detected that no object exists with the given id. Only pre-existing objects can be imported; check that the id is correct and that it is associated with the provider's configured region or endpoint, or use "terraform apply" to create a new remote object for this resource.` }, {}, col !== NO_COLOR));
    return 1;
  }
  ctx.out(`${col.b(`${addr}: Import prepared!`)}\n  Prepared ${pa.type} for import\n${col.b(`${addr}: Refreshing state... [id=${id}]`)}\n`);
  const st = prior ?? emptyState(lineage(ctx));
  const next = [...insts, { addr, type: pa.type, name: pa.name, ...(pa.module ? { module: pa.module } : {}), index: pa.index, attrs: { ...real.attrs }, deps: resourceDeps(cfg, r) }];
  writeState(ctx, buildState(st, next, st.outputs));
  ctx.out(`\n${col.g(col.b('Import successful!'))}\n\nThe resources that were imported are shown above. These resources are now in\nyour Terraform state and will henceforth be managed by Terraform.\n\n`);
  return 0;
}

/** terraform fmt: two-space indentation by brace depth and aligned "=" in runs of attributes. */
export function formatHcl(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  let depth = 0;
  const out = lines.map((raw) => {
    const t = raw.trim();
    if (!t) return '';
    if (/^[}\]]/.test(t)) depth = Math.max(0, depth - 1);
    const line = '  '.repeat(depth) + t.replace(/\s*=\s*/, (m) => (/^[\w"-]+\s*=/.test(t) ? ' = ' : m));
    const opens = (t.match(/[{[]/g) ?? []).length - (t.match(/[}\]]/g) ?? []).length + (/^[}\]]/.test(t) ? 1 : 0);
    depth = Math.max(0, depth + opens);
    return line;
  });
  // Align = within consecutive attribute lines of the same indentation.
  let i = 0;
  while (i < out.length) {
    const m = /^(\s*)([\w-]+) = /.exec(out[i]);
    if (!m) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && /^(\s*)([\w-]+) = /.exec(out[j])?.[1] === m[1]) j++;
    const w = Math.max(...out.slice(i, j).map((l) => /^(\s*)([\w-]+) = /.exec(l)![2].length));
    for (let k = i; k < j; k++) out[k] = out[k].replace(/^(\s*)([\w-]+) = /, (_s, ind: string, key: string) => `${ind}${key.padEnd(w)} = `);
    i = Math.max(j, i + 1);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n');
}

function fmt(ctx: CmdContext, o: Opts): number {
  const files = ctx.fs.readdir('.').filter((n) => n.endsWith('.tf')).sort();
  let bad = 0;
  for (const f of files) {
    const text = ctx.fs.readFile(f);
    const nice = formatHcl(text);
    if (nice !== text) {
      bad++;
      ctx.out(f + '\n');
      if (!o.check) ctx.fs.writeFile(f, nice);
    }
  }
  return o.check && bad ? 3 : 0;
}

export const terraformCommand: ShellCommand = {
  name: 'terraform',
  aliases: ['tofu'],
  summary: bi('Terraform и OpenTofu создают инфраструктуру по коду в учебном облаке Edu Cloud.', 'Terraform / OpenTofu: infrastructure from code against the Edu Cloud training cloud.'),
  help: HELP.main,
  handlesHelp: true,
  run,
  complete: (args) => (args.length <= 1 ? ['init', 'validate', 'plan', 'apply', 'destroy', 'fmt', 'import', 'output', 'providers', 'show', 'state', 'version'] : args[0] === 'state' ? ['list', 'show', 'mv', 'rm'] : []),
};

export { isUnknown };
