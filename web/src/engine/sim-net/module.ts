// netlab engine module: the network commands of the simulated shell, the
// setup hook `ext.net` (a lab topology) and two fact scopes for checks —
// `net` (the local host: interfaces, routes, neighbours, listeners, netfilter,
// sysctl) and `reach` (probes declared by the lab, run on a copy of the world,
// 03 §8.5).

import { defineModule } from '../../core/define';
import type { FactsProvider, SetupHook, SimMachineApi } from '../../core/types';
import { ipCommand, arpCommand, ssCommand, sysctlCommand, sortRoutes } from './cmd-ip';
import { pingCommand, tracerouteCommand, ncCommand, curlCommand } from './cmd-probe';
import { digCommand, nslookupCommand, hostCommand } from './cmd-dns';
import { tcpdumpCommand, iptablesCommand, iptablesSaveCommand, dhcpcdCommand, nginxCommand, iptablesS } from './cmd-tools';
import { buildPreset } from './presets';
import { netOf, type Probe } from './state';
import { runProbes } from './probe';
import { addrOf, effectiveRoutes, icmpEcho } from './world';

export interface NetSetup {
  preset: string;
  opts?: Record<string, unknown>;
  probes?: Probe[];
  /** Traffic sent on the live world right after setup (so tcpdump and ip neigh have something to show). */
  prime?: { from?: string; icmp: string; count?: number }[];
}

export const netSetup: SetupHook = {
  key: 'net',
  apply(m: SimMachineApi, value: unknown) {
    const v = value as NetSetup;
    const built = buildPreset(v.preset, v.opts ?? {});
    const st = netOf(m);
    st.world = built.world;
    st.probes = v.probes ?? [];
    st.readPos = 0;
    m.rootFs.mkdir('/proc/sys/net/ipv4', { parents: true });
    m.rootFs.writeFile('/proc/sys/net/ipv4/ip_forward', st.local.ipForward ? '1\n' : '0\n');
    for (const [path, text] of Object.entries(built.files)) {
      const dir = path.slice(0, path.lastIndexOf('/')) || '/';
      if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
      m.rootFs.writeFile(path, text);
    }
    // The running nginx has loaded the configuration it started with; edits take effect on reload.
    for (const svc of st.local.services) if (svc.nginx) svc.nginx.loaded = built.files[svc.nginx.conf];
    // A lab host that runs nginx has the nginx binary (the shell finds programs through PATH stubs).
    if (st.local.services.some((x) => x.kind === 'nginx')) installBinary(m, 'nginx', '/usr/sbin');
    for (const p of v.prime ?? []) for (let i = 1; i <= (p.count ?? 1); i++) icmpEcho(st.world, p.from ?? st.world.local, p.icmp, { seq: i });
  },
};

/** Put a program stub on PATH the way the terminal engine does (installStub), without depending on its internals. */
function installBinary(m: SimMachineApi, name: string, dir: string): void {
  const withStub = m as SimMachineApi & { installStub?: (n: string, d?: string) => string };
  if (typeof withStub.installStub === 'function') {
    withStub.installStub(name, dir);
    return;
  }
  const path = `${dir}/${name}`;
  if (m.rootFs.exists(path)) return;
  if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
  m.rootFs.writeFile(path, `#!/usr/bin/sim\n# ${name}: a simulated program of DevOps Trainer\n`, { mode: 0o755 });
  m.rootFs.chmod(path, 0o755);
}

/** facts.net — the local host as `ip`, `ss`, `iptables -S` and `sysctl` would report it. */
export function collectNet(m: SimMachineApi): unknown {
  const st = netOf(m);
  st.pull();
  const h = st.local;
  return {
    machine: h.id,
    hostname: h.name,
    ifaces: h.ifaces.map((i) => ({ name: i.name, mac: i.mac, up: i.up, mtu: i.mtu, addrs: i.addrs, addr: i.addrs[0] ?? '' })),
    addrs: h.ifaces.flatMap((i) => i.addrs),
    ips: h.ifaces.flatMap((i) => i.addrs.map(addrOf)),
    routes: sortRoutes(effectiveRoutes(h)).map((r) => ({ machine: h.id, dst: r.dst, gateway: r.via ?? '', dev: r.dev, proto: r.proto ?? 'static' })),
    neigh: h.neigh.map((n) => ({ ip: n.ip, mac: n.mac, dev: n.dev, state: n.state })),
    listen: h.services.filter((s) => !s.down).map((s) => ({ machine: h.id, proto: s.proto, addr: s.bind, port: s.port, process: s.proc })),
    iptables: { filter: iptablesS(h.nf.filter, 'filter'), nat: iptablesS(h.nf.nat, 'nat') },
    sysctl: { 'net.ipv4.ip_forward': h.ipForward ? 1 : 0 },
    conntrack: h.conntrack.length,
  };
}

export const netFacts: FactsProvider = { scope: 'net', collect: collectNet };

export const reachFacts: FactsProvider = {
  scope: 'reach',
  collect(m: SimMachineApi) {
    const st = netOf(m);
    st.pull();
    return runProbes(st, st.probes);
  },
};

export default defineModule({
  commands: [ipCommand, arpCommand, ssCommand, sysctlCommand, pingCommand, tracerouteCommand, ncCommand, curlCommand, digCommand, nslookupCommand, hostCommand, tcpdumpCommand, iptablesCommand, iptablesSaveCommand, dhcpcdCommand, nginxCommand],
  setup: [netSetup],
  facts: [netFacts, reachFacts],
});
