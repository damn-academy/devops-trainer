import type { CmdContext } from '../../core/types';
import { createSimMachine, type SimMachine } from '../terminal/shell';
import { stubResolve } from './dns';
import { netOf } from './state';
import { tcpConnect } from './world';

/** Network labs model SSH service access; key authentication belongs to the localhost SSH lab. */
export async function remoteSsh(ctx: CmdContext, host: string, user: string, port: number, command: string[]): Promise<number | null> {
  const parent = ctx.machine as SimMachine;
  const state = netOf(parent);
  if (state.world.local === 'self') return null;
  state.pull();
  const resolved = stubResolve(state.world, state.io, state.world.local, host);
  if (!resolved.addr) { ctx.err(`ssh: Could not resolve hostname ${host}\n`); return 255; }
  const conn = tcpConnect(state.world, state.world.local, resolved.addr, port);
  if (!conn.ok || conn.service?.kind !== 'ssh') {
    ctx.err(`ssh: connect to host ${host} port ${port}: ${conn.error === 'timeout' ? 'Connection timed out' : 'Connection refused'}\n`);
    return 255;
  }
  if (conn.host === state.world.local) return null;
  if (!['root', 'learner'].includes(user)) { ctx.err(`ssh: ${user}@${host}: Permission denied.\n`); return 255; }
  const remote = state.world.hosts[conn.host!];
  const machine = await createSimMachine({ hostname: remote.name, user: user === 'root' ? 'root' : 'learner', files: Object.entries(remote.files).map(([path, content]) => ({ path, content })) }, { registry: parent.registry });
  const network = netOf(machine);
  network.world = { ...state.world, local: remote.id };
  machine.rootFs.mkdir('/proc/sys/net/ipv4', { parents: true });
  machine.rootFs.writeFile('/proc/sys/net/ipv4/ip_forward', remote.ipForward ? '1\n' : '0\n');
  const sync = () => {
    const files: Record<string, string> = {};
    const walk = (dir: string) => {
      if (!machine.rootFs.exists(dir)) return;
      for (const name of machine.rootFs.readdir(dir)) {
        const path = `${dir}/${name}`;
        const stat = machine.rootFs.stat(path);
        if (stat?.type === 'd') walk(path);
        else if (stat?.type === 'f') files[path] = machine.rootFs.readFile(path);
      }
    };
    for (const dir of ['/etc', '/home', '/root', '/tmp', '/srv', '/var']) walk(dir);
    remote.files = files;
    state.world.clock = network.world.clock;
    state.world.counter = network.world.counter;
  };
  const exec = async (line: string) => {
    network.world.clock = state.world.clock;
    const result = await machine.exec(line);
    sync();
    return result;
  };
  if (command.length) {
    try { const result = await exec(command.join(' ')); ctx.out(result.out); return result.exit; }
    finally { machine.dispose(); }
  }
  parent.attach({
    dispose: () => machine.dispose(),
    prompt: () => machine.prompt(),
    complete: line => machine.complete(line),
    exec: async line => {
      if (line.trim() === 'exit' || line.trim() === 'logout') { sync(); machine.dispose(); return { out: '', exit: 0, effects: [], done: true }; }
      return exec(line);
    },
  });
  return 0;
}
