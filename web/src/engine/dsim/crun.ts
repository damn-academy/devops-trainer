// `crun`, an OCI runtime (04 §3.2 D24–D25, m03–m04): a bundle is a
// directory with `rootfs/` and `config.json`; `crun spec` writes the default
// config; `create` → `start` → the process runs → `delete` walks the OCI
// states creating, created, running, stopped. `crun run` with a terminal
// attaches a shell inside the bundle's root file system.

import { bi } from '../../core/i18n';
import type { CmdContext, ShellCommand, Snapshotable } from '../../core/types';
import { ContainerSession, openContainer } from './cmachine';
import { dockerOf } from './engine';
import { normalize } from '../terminal/vfs';
import { readHostTree } from './rootfs';
import type { ContainerRec } from './state';

/** The default config.json of `crun spec` / `runc spec` (runtime-spec config.md, config-linux.md), condensed. */
export function defaultSpec(): Record<string, unknown> {
  return {
    ociVersion: '1.2.0',
    process: {
      terminal: true,
      user: { uid: 0, gid: 0 },
      args: ['sh'],
      env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'TERM=xterm'],
      cwd: '/',
      capabilities: {
        bounding: ['CAP_AUDIT_WRITE', 'CAP_KILL', 'CAP_NET_BIND_SERVICE'],
        effective: ['CAP_AUDIT_WRITE', 'CAP_KILL', 'CAP_NET_BIND_SERVICE'],
        permitted: ['CAP_AUDIT_WRITE', 'CAP_KILL', 'CAP_NET_BIND_SERVICE'],
      },
      rlimits: [{ type: 'RLIMIT_NOFILE', hard: 1024, soft: 1024 }],
      noNewPrivileges: true,
    },
    root: { path: 'rootfs', readonly: true },
    hostname: 'crun',
    mounts: [
      { destination: '/proc', type: 'proc', source: 'proc' },
      { destination: '/dev', type: 'tmpfs', source: 'tmpfs', options: ['nosuid', 'strictatime', 'mode=755', 'size=65536k'] },
      { destination: '/sys', type: 'sysfs', source: 'sysfs', options: ['nosuid', 'noexec', 'nodev', 'ro'] },
    ],
    linux: {
      resources: { devices: [{ allow: false, access: 'rwm' }] },
      namespaces: [{ type: 'pid' }, { type: 'network' }, { type: 'ipc' }, { type: 'uts' }, { type: 'cgroup' }, { type: 'mount' }],
      maskedPaths: ['/proc/acpi', '/proc/kcore', '/proc/keys', '/sys/firmware'],
      readonlyPaths: ['/proc/bus', '/proc/fs', '/proc/irq', '/proc/sys', '/proc/sysrq-trigger'],
    },
  };
}

interface CrunContainer {
  id: string;
  bundle: string;
  pid: number;
  status: 'creating' | 'created' | 'running' | 'stopped';
  created: string;
  args: string[];
}

class CrunState implements Snapshotable {
  list: CrunContainer[] = [];
  snapshot() {
    return JSON.parse(JSON.stringify(this.list));
  }
  restore(s: unknown) {
    this.list = Array.isArray(s) ? (JSON.parse(JSON.stringify(s)) as CrunContainer[]) : [];
  }
}

const LONG = /^(sleep|httpd|nginx|top|tail)$/;

function readSpec(ctx: CmdContext, bundle: string): Record<string, unknown> | string {
  const p = `${bundle}/config.json`;
  if (!ctx.fs.exists(p)) return `cannot open \`${p}\`: No such file or directory`;
  try {
    const spec = JSON.parse(ctx.fs.readFile(p));
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return 'invalid configuration: expected an OCI object';
    if (spec.root?.path !== undefined && typeof spec.root.path !== 'string') return 'invalid configuration: root.path must be a string';
    return spec;
  } catch (e) {
    return `parse config.json: ${(e as Error).message}`;
  }
}

export const crun: ShellCommand = {
  name: 'crun',
  summary: bi('OCI-рантайм: запустить контейнер из bundle (rootfs + config.json)', 'an OCI runtime: run a container from a bundle (rootfs + config.json)'),
  help: `Usage: crun [OPTION...] COMMAND [OPTION...]

COMMANDS:
	create      - create a container
	delete      - remove definition for a container
	exec        - exec a command in a running container
	list        - list known containers
	kill        - send a signal to the container init process
	ps          - show the processes in the container
	run         - run a container
	spec        - generate a configuration file
	start       - start a container
	state       - output the state of a container

      --root=DIR             root directory
      --debug                produce verbose output
  -?, --help                 Give this help list
  -V, --version              Print program version

Report bugs to https://github.com/containers/crun/issues.`,
  async run(ctx) {
    const st = ctx.machine.ext('crun', () => new CrunState());
    const args = ctx.argv.slice(1).filter((a) => !a.startsWith('--root'));
    const [sub, ...rest] = args;
    const bundleOf = () => {
      const bi = rest.findIndex((a) => a === '--bundle' || a === '-b');
      return bi >= 0 ? ctx.fs.resolve(rest[bi + 1]) : ctx.cwd;
    };
    const id = rest.filter((a, i) => !a.startsWith('-') && rest[i - 1] !== '--bundle' && rest[i - 1] !== '-b')[0];
    const find = () => st.list.find((c) => c.id === id);
    switch (sub) {
      case 'spec': {
        const path = `${ctx.cwd}/config.json`;
        if (ctx.fs.exists(path)) {
          ctx.err('crun: config.json already exists\n');
          return 1;
        }
        ctx.fs.writeFile(path, JSON.stringify(defaultSpec(), null, '\t') + '\n');
        return 0;
      }
      case 'create':
      case 'run': {
        if (!id) {
          ctx.err(`crun: ${sub} requires a container id\n`);
          return 1;
        }
        if (find()) {
          ctx.err(`crun: container \`${id}\` already exists\n`);
          return 1;
        }
        const bundle = bundleOf();
        const spec = readSpec(ctx, bundle);
        if (typeof spec === 'string') {
          ctx.err(`crun: ${spec}\n`);
          return 1;
        }
        const rootPath = (spec.root as { path?: string })?.path ?? 'rootfs';
        const root = normalize(rootPath.startsWith('/') ? rootPath : `${bundle}/${rootPath}`);
        if (!ctx.fs.exists(root)) {
          ctx.err(`crun: cannot open \`${root}\`: No such file or directory\n`);
          return 1;
        }
        const proc = (spec.process ?? {}) as { args?: string[]; terminal?: boolean; env?: string[]; cwd?: string; user?: { uid?: number } };
        const pid = ctx.machine.procs.spawn({ cmd: sub === 'create' ? 'crun' : (proc.args?.[0] ?? 'sh'), argv: sub === 'create' ? ['crun', 'init'] : (proc.args ?? ['sh']), uid: 0, ppid: 1, oci: id });
        const rec: CrunContainer = { id, bundle, pid, status: 'created', created: new Date().toISOString(), args: proc.args ?? ['sh'] };
        st.list.push(rec);
        if (sub === 'create') return 0;
        return startRec(ctx, rec, spec, root, proc);
      }
      case 'start': {
        const rec = find();
        if (!rec) {
          ctx.err(`crun: container \`${id ?? ''}\` does not exist\n`);
          return 1;
        }
        if (rec.status !== 'created') {
          ctx.err(`crun: container \`${id}\` is not in created state\n`);
          return 1;
        }
        const spec = readSpec(ctx, rec.bundle);
        if (typeof spec === 'string') { ctx.err(`crun: ${spec}\n`); return 1; }
        const rootPath = (spec.root as { path?: string })?.path ?? 'rootfs';
        const root = normalize(rootPath.startsWith('/') ? rootPath : `${rec.bundle}/${rootPath}`);
        return startRec(ctx, rec, spec, root, (spec.process ?? {}) as { args?: string[]; terminal?: boolean });
      }
      case 'state': {
        const rec = find();
        if (!rec) {
          ctx.err(`crun: container \`${id ?? ''}\` does not exist\n`);
          return 1;
        }
        ctx.out(JSON.stringify({ ociVersion: '1.2.0', id: rec.id, pid: rec.status === 'stopped' ? 0 : rec.pid, status: rec.status, bundle: rec.bundle, rootfs: `${rec.bundle}/rootfs`, created: rec.created, owner: '' }, null, 2) + '\n');
        return 0;
      }
      case 'list': {
        ctx.out('NAME PID       STATUS   BUNDLE PATH                            CREATED                        OWNER\n');
        for (const c of st.list) ctx.out(`${c.id.padEnd(4)} ${String(c.status === 'stopped' ? 0 : c.pid).padEnd(9)} ${c.status.padEnd(8)} ${c.bundle.padEnd(40)} ${c.created} root\n`);
        return 0;
      }
      case 'kill': {
        const rec = find();
        if (!rec || rec.status !== 'running') {
          ctx.err(`crun: container \`${id ?? ''}\` is not running\n`);
          return 1;
        }
        ctx.machine.procs.kill(rec.pid, rest[1] ?? 'TERM');
        if (!ctx.machine.procs.get(rec.pid)) rec.status = 'stopped';
        return 0;
      }
      case 'delete': {
        const rec = find();
        if (!rec) {
          ctx.err(`crun: container \`${id ?? ''}\` does not exist\n`);
          return 1;
        }
        if (rec.status === 'running' && !rest.includes('-f') && !rest.includes('--force')) {
          ctx.err(`crun: the container \`${id}\` is not in 'stopped' state\n`);
          return 1;
        }
        ctx.machine.procs.kill(rec.pid, 'KILL');
        st.list = st.list.filter((c) => c !== rec);
        return 0;
      }
      case '--version':
      case '-V':
      case 'version':
        ctx.out('crun version 1.24\ncommit: dsim\nrundir: /run/crun\nspec: 1.0.0\n+SYSTEMD +SELINUX +APPARMOR +CAP +SECCOMP +EBPF +YAJL\n');
        return 0;
      default:
        ctx.err(`crun: unknown command ${sub ?? ''}\nTry \`crun --help' or \`crun --usage' for more information.\n`);
        return 1;
    }
  },
};

async function startRec(ctx: CmdContext, rec: CrunContainer, spec: Record<string, unknown>, root: string, proc: { args?: string[]; terminal?: boolean }): Promise<number> {
  const prog = (proc.args?.[0] ?? 'sh').split('/').pop()!;
  const shell = ['sh', 'ash', 'bash'].includes(prog) && proc.args?.length === 1;
  ctx.machine.procs.kill(rec.pid, 'KILL');
  rec.pid = ctx.machine.procs.spawn({ cmd: prog, argv: proc.args ?? ['sh'], uid: 0, ppid: 1, oci: rec.id });
  rec.status = 'running';
  if (shell && proc.terminal && ctx.machine.attach) {
    const c = pseudoContainer(rec, spec, ctx, root);
    const st = dockerOf(ctx.machine).s;
    st.containers.push(c);
    const opened = await openContainer({ host: ctx.machine, st, containerId: c.id }, c);
    st.containers = st.containers.filter((x) => x !== c);
    ctx.machine.attach(
      new ContainerSession(opened, c, () => {
        rec.status = 'stopped';
        ctx.machine.procs.kill(rec.pid, 'KILL');
      }),
    );
    return 0;
  }
  if (!LONG.test(prog)) {
    // a short program runs and exits: the container is stopped, the record stays until delete
    rec.status = 'stopped';
    ctx.machine.procs.kill(rec.pid, 'KILL');
  }
  return 0;
}

function pseudoContainer(rec: CrunContainer, spec: Record<string, unknown>, ctx: CmdContext, root: string): ContainerRec {
  const proc = (spec.process ?? {}) as { env?: string[]; cwd?: string; user?: { uid?: number } };
  return {
    id: `crun${rec.id}`.padEnd(64, '0'),
    name: rec.id,
    image: root,
    imageId: '',
    created: 0,
    status: 'running',
    exitCode: null,
    startedAt: 0,
    finishedAt: null,
    oomKilled: false,
    restartCount: 0,
    stopDurationMs: null,
    stoppedByUser: false,
    pid: rec.pid,
    procs: [{ nspid: 1, hostPid: rec.pid, comm: 'sh', argv: ['sh'], ppid: 0, state: 'S' }],
    config: { Env: proc.env ?? [], Cmd: ['sh'], WorkingDir: proc.cwd ?? '/', Hostname: String(spec.hostname ?? rec.id), Tty: true, OpenStdin: true, Image: root, User: String(proc.user?.uid ?? 0) },
    hostConfig: { memory: 0, pidsLimit: null, cpus: 0, init: false, autoRemove: false, restartPolicy: { name: 'no', maximumRetryCount: 0 }, portBindings: [], networkMode: 'none', readonlyRootfs: false, capAdd: [], capDrop: [], privileged: false, securityOpt: [], stopTimeout: null, stopSignal: null, user: String(proc.user?.uid ?? 0), logConfig: { type: 'none', config: {} }, tmpfs: [], sysctls: {} },
    networks: { none: { ip: '', aliases: [], mac: '' } },
    mounts: [],
    upper: readHostTree(ctx.machine.rootFs, root),
    tmpfsData: {},
    logs: [],
    program: null,
    health: null,
    labels: {},
    buildLayers: [],
  };
}
