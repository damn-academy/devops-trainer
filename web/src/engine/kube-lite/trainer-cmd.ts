// `cluster` — the trainer's own tool for the simulated cluster (not part of
// Kubernetes, and it says so): fast-forward virtual time, cut a node's power,
// stop a control-plane component, look at a node's kube-proxy rules or
// addresses, open a port-forward like a browser, read the etcd keys.

import type { ShellCommand } from '../../core/types';
import { bi } from '../../core/i18n';
import type { Cluster, ComponentId } from './cluster';
import { GIT_URL, gitCommit, newAddonState, outsideHttp } from './addons';
import { httpFrom, iptablesSave, nodeIpAddr, nodeIpRoute } from './network';
import { k8sState, machineNow } from './state';
import { age, iso, pad, parseDuration } from './util';

const COMPONENTS: Record<string, ComponentId> = {
  etcd: 'etcd',
  'kube-apiserver': 'apiserver',
  apiserver: 'apiserver',
  'kube-scheduler': 'scheduler',
  scheduler: 'scheduler',
  'kube-controller-manager': 'controller-manager',
  'controller-manager': 'controller-manager',
  'kube-proxy': 'kube-proxy',
  coredns: 'coredns',
  cni: 'cni',
  flannel: 'cni',
};

export const CLUSTER_HELP = `cluster — the trainer's control panel for the simulated cluster.
It is not part of Kubernetes: on a real cluster the same things happen
because of time, power cuts and broken components.

Usage:
  cluster status                       components, nodes and the virtual clock
  cluster ff DURATION                  fast-forward virtual time (30s, 5m, 1h)
  cluster power off|on NODE            cut or restore a node's power
  cluster stop|start COMPONENT [NODE]  stop or start a component:
                                       etcd, kube-apiserver, kube-scheduler,
                                       kube-controller-manager, kube-proxy,
                                       coredns, cni; kubelet and containerd
                                       take a NODE
  cluster iptables [NODE]              the NAT rules kube-proxy wrote on a node
                                       (iptables-save -t nat)
  cluster ip addr|route [NODE]         addresses and routes of a node
  cluster open URL                     open http://localhost:PORT/ through
                                       a kubectl port-forward, like a browser
  cluster etcd [PREFIX]                keys in etcd (/registry/...) with their
                                       resourceVersion
  cluster timeline [N]                 the last N changes in the store (watch log)
  cluster curl [-sS] [-k] URL          a request from a computer in the office
                                       network (192.168.56.0/24, like the nodes):
                                       names under .example point at 192.168.56.240
  cluster git push FILE... -m MESSAGE  commit files to apps/ of the team's Git
                                       repository and push them to main
  cluster git rm FILE -m MESSAGE       delete apps/FILE in a new commit
  cluster git log                      the commits of main, newest first
  cluster load DEPLOYMENT CPU          the users' requests cost the pods of a
                                       Deployment CPU together (900m, 0 to stop)
`;

function etcdKey(c: Cluster, kind: string, ns: string | undefined, name: string): string {
  const info = c.kinds.byKind(kind);
  const res = !info ? kind.toLowerCase() + 's' : info.group && !['apps', 'batch'].includes(info.group) ? `${info.group}/${info.plural}` : info.plural === 'endpointslices' ? `endpointslices` : info.plural;
  const short = res === 'services' ? 'services/specs' : res;
  return `/registry/${short}/${ns ? `${ns}/` : ''}${name}`;
}

export function clusterCommand(): ShellCommand {
  return {
    name: 'cluster',
    summary: bi('Пульт тренажёра: ускорить время, выключить узел, остановить компонент', "The trainer's panel: fast-forward time, cut a node's power, stop a component"),
    help: CLUSTER_HELP,
    run(ctx) {
      const st = k8sState(ctx.machine);
      const c = st.cluster;
      if (!c) {
        ctx.err('cluster: this machine has no training cluster\n');
        return 1;
      }
      c.syncReal(machineNow(ctx.machine));
      const [verb, a, b] = ctx.argv.slice(1);
      const nodeArg = (n: string | undefined, fallback = c.nodes[1]?.name ?? c.nodes[0].name) => {
        const node = c.node(n ?? fallback);
        if (!node) {
          ctx.err(`cluster: no node named "${n}" (nodes: ${c.nodes.map((x) => x.name).join(', ')})\n`);
          return null;
        }
        return node;
      };
      switch (verb) {
        case undefined:
        case 'status': {
          const comp = Object.entries(c.components).filter(([k]) => k !== 'netpol').map(([k, v]) => [k, v ? 'running' : 'STOPPED']);
          ctx.out(`virtual time: ${iso(c.now)}\n\n`);
          ctx.out(pad([['COMPONENT', 'STATE'], ...comp]));
          ctx.out('\n');
          ctx.out(pad([['NODE', 'IP', 'POWER', 'KUBELET', 'RUNTIME', 'LEASE RENEWED'], ...c.nodes.map((n) => [n.name, n.ip, n.power ? 'on' : 'OFF', n.kubelet ? 'running' : 'STOPPED', n.runtime ? 'running' : 'STOPPED', `${age(c.now - n.lastLease)} ago`])]));
          return 0;
        }
        case 'ff':
        case 'wait': {
          const ms = parseDuration(a ?? '');
          if (!a || Number.isNaN(ms)) {
            ctx.err('cluster: usage: cluster ff DURATION (for example 30s, 5m, 1h)\n');
            return 2;
          }
          const capped = Math.min(ms, 6 * 3_600_000);
          const before = c.timeline.length;
          c.advance(capped);
          ctx.out(`virtual time +${a}: now ${iso(c.now)} (${c.timeline.length - before} changes in the store)\n`);
          return 0;
        }
        case 'power': {
          const node = nodeArg(b);
          if (!node) return 1;
          if (a !== 'on' && a !== 'off') {
            ctx.err('cluster: usage: cluster power off|on NODE\n');
            return 2;
          }
          node.power = a === 'on';
          if (a === 'on') {
            node.boot++;
            node.kubelet = true;
            c.renewLease(node);
          }
          c.advance(1000);
          ctx.out(a === 'off' ? `${node.name}: power off. Its kubelet stops renewing its Lease; watch what the control plane does with: kubectl get nodes -w\n` : `${node.name}: power on, booting. The kubelet starts and renews its Lease.\n`);
          return 0;
        }
        case 'stop':
        case 'start': {
          const on = verb === 'start';
          if (a === 'kubelet' || a === 'containerd') {
            const node = nodeArg(b);
            if (!node) return 1;
            if (a === 'kubelet') node.kubelet = on;
            else node.runtime = on;
            if (on && a === 'kubelet') c.renewLease(node);
            c.advance(1000);
            ctx.out(`${a} on ${node.name}: ${on ? 'started' : 'stopped'}\n`);
            return 0;
          }
          const id = COMPONENTS[a ?? ''];
          if (!id) {
            ctx.err(`cluster: unknown component "${a ?? ''}" (etcd, kube-apiserver, kube-scheduler, kube-controller-manager, kube-proxy, coredns, cni, kubelet NODE, containerd NODE)\n`);
            return 2;
          }
          if (id === 'coredns') {
            // CoreDNS is a Deployment: stopping it scales it to zero, as an admin would.
            const d = c.get('Deployment', 'kube-system', 'coredns');
            if (!d) {
              ctx.err('cluster: CoreDNS is not installed in this cluster\n');
              return 1;
            }
            c.put({ ...d, spec: { ...d.spec, replicas: on ? 1 : 0 } });
            c.advance(5000);
            ctx.out(`coredns: ${on ? 'scaled to 1' : 'scaled to 0 (the kube-dns Service has no endpoints now)'}\n`);
            return 0;
          }
          c.components[id] = on;
          c.advance(1000);
          ctx.out(`${a}: ${on ? 'started' : 'stopped'}\n`);
          return 0;
        }
        case 'iptables': {
          const node = nodeArg(a, c.nodes[0].name);
          if (!node) return 1;
          ctx.out(iptablesSave(c, node.name));
          return 0;
        }
        case 'ip': {
          const node = nodeArg(b, c.nodes[0].name);
          if (!node) return 1;
          if (a === 'route') ctx.out(nodeIpRoute(c, node.name));
          else ctx.out(nodeIpAddr(c, node.name));
          return 0;
        }
        case 'open': {
          const m = /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1):(\d+)(\/.*)?$/.exec(a ?? '');
          if (!m) {
            ctx.err('cluster: usage: cluster open http://localhost:PORT/PATH (start kubectl port-forward first)\n');
            return 2;
          }
          const fw = c.forwards.find((f) => f.local === Number(m[1]));
          if (!fw) {
            ctx.out(`curl: (7) Failed to connect to localhost port ${m[1]} after 0 ms: Couldn't connect to server\n`);
            return 7;
          }
          const pod = c.get('Pod', fw.ns, fw.target);
          if (!pod) {
            ctx.out(`E1118 ${iso(c.now).slice(11, 19)} portforward.go:424] "Unhandled Error" err="an error occurred forwarding ${fw.local} -> ${fw.port}: error forwarding port ${fw.port} to pod: pod not found"\n`);
            return 1;
          }
          const r = httpFrom(c, null, `${pod.status?.podIP}:${fw.port}${m[2] ?? '/'}`);
          ctx.out(`Handling connection for ${fw.local}\n`);
          ctx.out(r.ok ? `HTTP ${r.status}\n\n${r.body}\n` : `${r.error}\n`);
          return r.ok ? 0 : r.exit;
        }
        case 'etcd': {
          if (!c.components.etcd) {
            ctx.err('Error: context deadline exceeded\n');
            return 1;
          }
          const prefix = a ?? '/registry/';
          const rows = c
            .all()
            .filter((o) => o.kind !== 'Event')
            .map((o) => [etcdKey(c, o.kind, o.metadata.namespace, o.metadata.name), o.metadata.resourceVersion])
            .filter(([k]) => k.startsWith(prefix))
            .sort(([x], [y]) => x.localeCompare(y));
          ctx.out(pad([['KEY', 'MOD_REVISION'], ...rows]));
          return 0;
        }
        case 'timeline': {
          const n = Number(a ?? 20);
          const rows = c.timeline.slice(-n).map((ch) => [String(ch.rv), age(c.now - ch.at) + ' ago', ch.type, `${ch.kind}/${ch.ns ? ch.ns + '/' : ''}${ch.name}`]);
          ctx.out(pad([['RV', 'WHEN', 'EVENT', 'OBJECT'], ...rows]));
          return 0;
        }
        case 'curl': {
          const args = ctx.argv.slice(2);
          const url = args.filter((x) => !x.startsWith('-')).pop();
          if (!url) {
            ctx.err("curl: try 'curl --help' or 'curl --manual' for more information\n");
            return 2;
          }
          const flags = args.filter((x) => x.startsWith('-')).join('');
          const silent = /s/.test(flags.replace(/--\w+/g, '')) || args.includes('--silent');
          const showErr = /S/.test(flags) || !silent;
          const r = outsideHttp(c, url, { insecure: /k/.test(flags.replace(/--\w+/g, '')) || args.includes('--insecure') });
          if (!r.ok) {
            if (showErr) ctx.err(r.error + '\n');
            return r.exit;
          }
          if (/i/.test(flags.replace(/--\w+/g, ''))) ctx.out(`HTTP/1.1 ${r.status} ${r.status === 200 ? 'OK' : r.status === 404 ? 'Not Found' : r.status === 308 ? 'Permanent Redirect' : r.status === 503 ? 'Service Temporarily Unavailable' : ''}\n\n`);
          ctx.out((r.body ?? '') + '\n');
          return 0;
        }
        case 'git': {
          c.addons ??= newAddonState();
          const st = c.addons;
          if (a === 'log') {
            for (const cm of [...st.git].reverse()) ctx.out(`\x1b[33m${cm.sha.slice(0, 7)}\x1b[0m ${cm.message}\n`);
            return 0;
          }
          if (a !== 'push' && a !== 'rm') {
            ctx.err('cluster: usage: cluster git push FILE... -m MESSAGE | cluster git rm FILE -m MESSAGE | cluster git log\n');
            return 2;
          }
          const rest = ctx.argv.slice(3);
          const mi = rest.indexOf('-m');
          const message = mi >= 0 ? (rest[mi + 1] ?? '') : '';
          const paths = rest.filter((_, i) => i !== mi && i !== mi + 1);
          if (!paths.length || !message) {
            ctx.err(`cluster: usage: cluster git ${a} FILE... -m MESSAGE\n`);
            return 2;
          }
          const files: Record<string, string | null> = {};
          for (const f of paths) {
            const base = f.split('/').pop()!;
            if (a === 'rm') files[`apps/${base}`] = null;
            else {
              try {
                files[`apps/${base}`] = ctx.fs.readFile(f);
              } catch {
                ctx.err(`fatal: pathspec '${f}' did not match any files\n`);
                return 128;
              }
            }
          }
          const { commit, parent, changed } = gitCommit(c, files, message);
          if (!changed.length) {
            st.git.pop();
            ctx.out('On branch main\nnothing to commit, working tree clean\n');
            return 1;
          }
          const lines = changed.map((p) => (files[p] === null ? ` delete mode 100644 ${p}` : !(p in parent.files) ? ` create mode 100644 ${p}` : '')).filter(Boolean);
          const ins = changed.reduce((n, p) => n + (files[p] ? files[p]!.split('\n').filter(Boolean).length : 0), 0);
          const del = changed.reduce((n, p) => n + (parent.files[p] ? parent.files[p].split('\n').filter(Boolean).length : 0), 0);
          ctx.out(`[main ${commit.sha.slice(0, 7)}] ${message}\n ${changed.length} file${changed.length > 1 ? 's' : ''} changed${ins ? `, ${ins} insertion${ins > 1 ? 's' : ''}(+)` : ''}${del ? `, ${del} deletion${del > 1 ? 's' : ''}(-)` : ''}\n${lines.map((l) => l + '\n').join('')}To ${GIT_URL}\n   ${parent.sha.slice(0, 7)}..${commit.sha.slice(0, 7)}  main -> main\n`);
          return 0;
        }
        case 'load': {
          const ms = /^(\d+)m?$/.exec(b ?? '');
          if (!a || !ms) {
            ctx.err('cluster: usage: cluster load DEPLOYMENT CPU (for example 900m; 0 stops the load)\n');
            return 2;
          }
          const ns = 'default';
          if (!c.get('Deployment', ns, a)) {
            ctx.err(`cluster: no Deployment "${a}" in ${ns}\n`);
            return 1;
          }
          c.addons ??= newAddonState();
          const m = b!.endsWith('m') ? Number(ms[1]) : Number(ms[1]) * 1000;
          c.addons.load[`${ns}/${a}`] = m;
          ctx.out(m ? `${a}: the users' requests now cost its pods ${m}m of CPU together\n` : `${a}: no load from users\n`);
          return 0;
        }
        default:
          ctx.err(`cluster: unknown subcommand "${verb}"\n\n${CLUSTER_HELP}`);
          return 2;
      }
    },
    complete: () => ['status', 'ff', 'power', 'stop', 'start', 'iptables', 'ip', 'open', 'etcd', 'timeline', 'curl', 'git', 'load'],
  };
}
