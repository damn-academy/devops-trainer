// `edu`: the console CLI of Edu Cloud (like yc or aws). Changes made here come
// from the "console", not from Terraform, so the next plan sees drift.
// Also the `tf` facts scope and the `tf` setup hook.

import type { CmdContext, FactsProvider, SetupHook, ShellCommand, SimMachineApi } from '../../../core/types';
import { bi } from '../../../core/i18n';
import { Cloud, CloudError, emptyCloud, type CloudResource } from './cloud';
import { stateInstances, type StateFile } from './engine';

const KIND: Record<string, string> = { vm: 'edu_vm', network: 'edu_network', dns: 'edu_dns_record' };

function table(ctx: CmdContext, rows: CloudResource[]): void {
  if (!rows.length) {
    ctx.out('(no resources)\n');
    return;
  }
  const cols = ['id', 'name', ...[...new Set(rows.flatMap((r) => Object.keys(r.attrs)))].filter((k) => !['id', 'name', 'labels'].includes(k)).sort()];
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r.attrs[c] ?? '').length)));
  ctx.out(cols.map((c, i) => c.toUpperCase().padEnd(w[i])).join('  ') + '\n');
  for (const r of rows) ctx.out(cols.map((c, i) => String(r.attrs[c] ?? '').padEnd(w[i])).join('  ') + '\n');
}

export const eduCommand: ShellCommand = {
  name: 'edu',
  summary: bi('Консоль учебного облака Edu Cloud: смотреть и менять ресурсы руками.', 'The Edu Cloud console: look at and change resources by hand.'),
  help: 'Usage: edu <resource> <command> [ID] [--key value]...\n\nResources:\n  vm        virtual machines\n  network   networks\n  dns       DNS records\n\nCommands:\n  list                    list resources\n  get ID                  show one resource\n  update ID --key value   change attributes (as if clicked in the web console)\n  delete ID               delete a resource\n\n  edu log                 the audit log of the cloud\n',
  run(ctx) {
    const [res, cmd, id, ...rest] = ctx.argv.slice(1);
    const user = ctx.user.name === 'learner' ? 'ops-2' : ctx.user.name;
    const cloud = new Cloud(ctx.machine.rootFs, () => (ctx.machine as unknown as { now?: () => number }).now?.() ?? Date.now());
    try {
      if (res === 'log') {
        for (const l of cloud.read().log) ctx.out(`${new Date(l.at).toISOString().slice(11, 16)}  ${l.source.padEnd(7)}  ${l.user.padEnd(9)}  ${l.action.padEnd(6)}  ${l.id}  ${l.detail}\n`);
        return 0;
      }
      const type = KIND[res ?? ''];
      if (!type) {
        ctx.err(`edu: unknown resource "${res ?? ''}". Try 'edu --help'.\n`);
        return 2;
      }
      if (cmd === 'list' || !cmd) {
        table(ctx, cloud.list(type));
        return 0;
      }
      if (!id) {
        ctx.err(`edu: ${cmd} needs a resource ID\n`);
        return 2;
      }
      if (cmd === 'get') {
        const r = cloud.get(id);
        if (!r || r.type !== type) throw new CloudError(404, `${res} ${id} not found`);
        ctx.out(JSON.stringify(r.attrs, null, 2) + '\n');
        return 0;
      }
      if (cmd === 'update') {
        const changes: Record<string, unknown> = {};
        for (let i = 0; i < rest.length; i++) {
          const k = rest[i].replace(/^--/, '').replace(/-/g, '_');
          const v = rest[++i];
          if (v === undefined) {
            ctx.err(`edu: --${k} needs a value\n`);
            return 2;
          }
          changes[k] = /^-?\d+$/.test(v) ? Number(v) : v;
        }
        if (['id', 'private_ip', 'public_ip', 'fqdn'].some((k) => k in changes)) throw new CloudError(400, 'read-only attribute');
        const r = cloud.update(id, changes, 'console', user);
        ctx.out(`updated ${r.id}: ${Object.entries(changes).map(([k, v]) => `${k}=${v}`).join(' ')}\n`);
        return 0;
      }
      if (cmd === 'delete') {
        cloud.delete(id, 'console', user);
        ctx.out(`deleted ${id}\n`);
        return 0;
      }
      ctx.err(`edu: unknown command "${cmd}"\n`);
      return 2;
    } catch (e) {
      if (e instanceof CloudError) {
        ctx.err(`edu: ${e.status} ${e.message}\n`);
        return 1;
      }
      throw e;
    }
  },
};

// ── facts ──

export interface TfDirFact {
  path: string;
  initialized: boolean;
  serial: number;
  state: { address: string; type: string; id: string; attrs: Record<string, unknown> }[];
  lastPlan: { kind: string; applied: boolean; add: number; change: number; destroy: number; actions: { addr: string; action: string; forces: string[]; createBeforeDestroy: boolean }[]; drift: { addr: string; kind: string }[]; targeted: boolean } | null;
  files: string[];
}

export interface TfFacts {
  dirs: TfDirFact[];
  cloud: { type: string; id: string; attrs: Record<string, unknown> }[];
}

export function tfFacts(m: SimMachineApi): TfFacts {
  const fs = m.rootFs;
  const dirs: TfDirFact[] = [];
  const walk = (d: string, depth: number) => {
    if (depth > 4) return;
    let names: string[];
    try {
      names = fs.readdir(d);
    } catch {
      return;
    }
    if (names.some((n) => n.endsWith('.tf'))) {
      let state: StateFile | null = null;
      try {
        state = names.includes('terraform.tfstate') ? (JSON.parse(fs.readFile(`${d}/terraform.tfstate`)) as StateFile) : null;
      } catch {
        state = null;
      }
      let lastPlan = null;
      try {
        lastPlan = fs.exists(`${d}/.terraform/last-plan.json`) ? JSON.parse(fs.readFile(`${d}/.terraform/last-plan.json`)) : null;
      } catch {
        lastPlan = null;
      }
      dirs.push({ path: d, initialized: fs.exists(`${d}/.terraform.lock.hcl`), serial: state?.serial ?? 0, state: stateInstances(state).map((i) => ({ address: i.addr, type: i.type, id: String(i.attrs.id), attrs: i.attrs })), lastPlan, files: names.filter((n) => n.endsWith('.tf')) });
    }
    for (const n of names) if (!n.startsWith('.') && fs.stat(`${d}/${n}`)?.type === 'd') walk(`${d}/${n}`, depth + 1);
  };
  walk('/home', 0);
  const cloud = new Cloud(fs).list().map((r) => ({ type: r.type, id: r.id, attrs: r.attrs }));
  return { dirs, cloud };
}

export const tfFactsProvider: FactsProvider = { scope: 'tf', collect: tfFacts };

/** ext.tf: { cloud?: { quota?, faults? } } — the training cloud starts empty unless a lesson says otherwise. */
export const tfSetupHook: SetupHook = {
  key: 'tf',
  apply(m, value) {
    const v = (value ?? {}) as { quota?: number; rateLimitAfter?: number };
    const cloud = new Cloud(m.rootFs);
    const s = emptyCloud();
    if (v.quota) s.quota.cores = v.quota;
    if (v.rateLimitAfter !== undefined) s.faults = { rateLimitAfter: v.rateLimitAfter };
    cloud.write(s);
  },
};

export const tfDir = (f: Record<string, unknown>, path: string) => (f.tf as TfFacts | undefined)?.dirs.find((d) => d.path === path);
