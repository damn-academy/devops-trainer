// The bridge between the kernel model of this engine and the network engine
// (sim-net, owned by the networks builder). Programs that listen on the
// simulated machine (web-demo, nginx from apt, sshd) are published as
// services of the local host in sim-net's world right before one of its
// commands runs, so `curl localhost:8080` reaches a web-demo started in a
// Linux lesson. Only services this bridge added are replaced; services of a
// network lab stay as the lab defined them.

import { netOf } from '../sim-net/state';
import type { KProc } from './kernel';
import { setNetBridge, type SimMachine } from './shell';
import { ROOT_CRED, normalize } from './vfs';

const NET_COMMANDS = new Set(['curl', 'ss', 'nc', 'ping', 'netstat', 'nmap']);

function nginxRoutes(m: SimMachine): Record<string, { status: number; body: string }> {
  let root = '/var/www/html';
  try {
    root = /root\s+([^;]+);/.exec(m.vfs.readFileAs('/etc/nginx/nginx.conf', ROOT_CRED))?.[1] ?? root;
  } catch {
    /* default root */
  }
  const www = m.users.find((u) => u.name === 'www-data');
  const routes: Record<string, { status: number; body: string }> = {};
  const serve = (path: string) => {
    const file = normalize(`${root}/${path === '/' ? 'index.html' : path}`);
    if (!www) return;
    try {
      routes[path] = { status: 200, body: m.fsFor(www, () => '/', '/', '0').readFile(file) };
    } catch (e) {
      const code = (e as { code?: string }).code;
      routes[path] = { status: code === 'EACCES' ? 403 : 404, body: '' };
    }
  };
  serve('/');
  serve('/index.html');
  return routes;
}

export function syncListeners(m: SimMachine): void {
  const st = netOf(m) as unknown as { local?: { services: Record<string, unknown>[] } };
  const h = st.local;
  if (!h) return;
  h.services = h.services.filter((s) => !s.fromProcs);
  const taken = new Set(h.services.map((s) => `${s.proto}:${s.port}`));
  for (const p of m.procs.list() as KProc[]) {
    for (const port of p.listen ?? []) {
      if (taken.has(`tcp:${port}`)) continue;
      taken.add(`tcp:${port}`);
      const base = { proto: 'tcp', port, bind: '0.0.0.0', proc: p.cmd, pid: p.pid, fromProcs: true };
      if (p.cmd === 'sshd') h.services.push({ ...base, kind: 'ssh', banner: 'SSH-2.0-OpenSSH_10.0p2 Debian-7' });
      else if (p.cmd === 'nginx') h.services.push({ ...base, kind: 'http', http: { server: 'nginx/1.26.3', routes: nginxRoutes(m) } });
      else h.services.push({ ...base, kind: 'http', http: { server: p.cmd, routes: { '/': { status: 200, body: `hello from ${p.cmd} on ${m.hostname}:${port} (pid ${p.pid})\n` }, '/health': { status: 200, body: 'ok\n' } } } });
    }
  }
}

setNetBridge((m, cmd) => {
  if (!NET_COMMANDS.has(cmd)) return;
  try {
    syncListeners(m);
  } catch {
    /* the network engine changed shape: its commands keep working on their own world */
  }
});
