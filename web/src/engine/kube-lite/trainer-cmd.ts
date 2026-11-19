// `cluster` — the trainer's own tool for the simulated cluster (not part of
// Kubernetes, and it says so): fast-forward virtual time, cut a node's power,
// stop a control-plane component, look at a node's kube-proxy rules or
// addresses, open a port-forward like a browser, read the etcd keys.

import type { ShellCommand } from '../../core/types';
import { bi } from '../../core/i18n';
import type { Cluster, ComponentId } from './cluster';
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
        default:
          ctx.err(`cluster: unknown subcommand "${verb}"\n\n${CLUSTER_HELP}`);
          return 2;
      }
    },
    complete: () => ['status', 'ff', 'power', 'stop', 'start', 'iptables', 'ip', 'open', 'etcd', 'timeline'],
  };
}
