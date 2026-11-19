// The network of kube-lite (05 §5.4, MVP): pod IPs from the node podCIDR,
// ClusterIPs from 10.43.0.0/16, CoreDNS as the kube-dns Service, kube-proxy
// as a table of DNAT rules (printed in the real iptables-save format with the
// real chain-name hashes), NetworkPolicy evaluated as kube-router does. A
// request from a pod walks the same ladder a learner debugs: DNS → Service →
// EndpointSlice → pod → NetworkPolicy.

import { selects } from './admission';
import type { Cluster } from './cluster';
import { controllerOf, resolveTargetPort } from './controllers';
import { lookupImage } from './images';
import { podProcessUp } from './kubelet';
import { kubeProxyHash, type Obj } from './util';

export const CLUSTER_DOMAIN = 'cluster.local';
export const DNS_IP = '10.43.0.10';

export function resolvConf(ns: string, ndots = 5): string {
  return `search ${ns}.svc.${CLUSTER_DOMAIN} svc.${CLUSTER_DOMAIN} ${CLUSTER_DOMAIN}\nnameserver ${DNS_IP}\noptions ndots:${ndots}\n`;
}

export interface DnsAnswer {
  ok: boolean;
  fqdn?: string;
  ips: string[];
  /** Every query the resolver sent, in order (the cost of ndots). */
  queries: { name: string; rcode: 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL' | 'TIMEOUT' }[];
  error?: 'NXDOMAIN' | 'TIMEOUT' | 'SERVFAIL';
}

/** Is CoreDNS answering: the kube-dns Service has a ready endpoint and kube-proxy routes to it. */
export function dnsUp(c: Cluster): boolean {
  const slice = c.list('EndpointSlice', 'kube-system').find((s) => s.metadata.labels?.['kubernetes.io/service-name'] === 'kube-dns');
  const ready = (slice?.endpoints ?? []).some((e: Obj) => e.conditions?.ready);
  const routed = Object.entries(c.proxy.services).some(([k, v]) => k.startsWith('kube-system/kube-dns:') && v.endpoints.length);
  return ready && routed && c.components.coredns;
}

const EXTERNAL: Record<string, string> = { 'example.com': '93.184.215.14', 'api.github.com': '140.82.121.6', 'kubernetes.io': '15.197.167.90' };

/** Look one fully qualified name up in the cluster zone or upstream. */
function lookupName(c: Cluster, fqdn: string): string[] | null {
  const name = fqdn.replace(/\.$/, '');
  const zone = `.svc.${CLUSTER_DOMAIN}`;
  if (name.endsWith(zone)) {
    const parts = name.slice(0, -zone.length).split('.');
    if (parts.length === 2) {
      const [svc, ns] = parts;
      const s = c.get('Service', ns, svc);
      if (!s) return null;
      if (s.spec.clusterIP === 'None') {
        const slice = c.list('EndpointSlice', ns).filter((x) => x.metadata.labels?.['kubernetes.io/service-name'] === svc);
        return slice.flatMap((x) => (x.endpoints ?? []).filter((e: Obj) => e.conditions?.ready).map((e: Obj) => e.addresses[0]));
      }
      return [s.spec.clusterIP];
    }
    return null;
  }
  if (name.endsWith(CLUSTER_DOMAIN)) return null;
  return EXTERNAL[name] ? [EXTERNAL[name]] : null;
}

/** The pod's resolver: search list and ndots, as glibc/musl do. */
export function resolve(c: Cluster, ns: string, name: string, ndots = 5): DnsAnswer {
  const queries: DnsAnswer['queries'] = [];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return { ok: true, fqdn: name, ips: [name], queries };
  if (!dnsUp(c)) return { ok: false, ips: [], queries: [{ name, rcode: 'TIMEOUT' }], error: 'TIMEOUT' };
  const search = [`${ns}.svc.${CLUSTER_DOMAIN}`, `svc.${CLUSTER_DOMAIN}`, CLUSTER_DOMAIN];
  const absolute = name.endsWith('.');
  const dots = (name.match(/\./g) ?? []).length;
  const candidates = absolute ? [name] : dots >= ndots ? [name, ...search.map((s) => `${name}.${s}`)] : [...search.map((s) => `${name}.${s}`), name];
  for (const cand of candidates) {
    const ips = lookupName(c, cand);
    queries.push({ name: cand.replace(/\.$/, ''), rcode: ips && ips.length ? 'NOERROR' : 'NXDOMAIN' });
    if (ips && ips.length) return { ok: true, fqdn: cand.replace(/\.$/, ''), ips, queries };
  }
  return { ok: false, ips: [], queries, error: 'NXDOMAIN' };
}

export interface HttpResult {
  ok: boolean;
  status?: number;
  body?: string;
  /** What curl prints on failure. */
  error?: string;
  exit: number;
  /** The pod that answered. */
  pod?: string;
  /** The hops for a "what happened" trace. */
  trace: string[];
}

/** NetworkPolicy (ingress only, as the course uses it): is traffic from `src` allowed into `dst` on `port`? */
export function policyAllows(c: Cluster, src: Obj | null, dst: Obj, port: number): { allowed: boolean; by?: string } {
  if (!c.components.netpol || !c.components.cni) return { allowed: true };
  const ns = dst.metadata.namespace;
  const pols = c.list('NetworkPolicy', ns).filter((p) => {
    const sel = p.spec?.podSelector ?? {};
    const selectsAll = !Object.keys(sel.matchLabels ?? {}).length && !(sel.matchExpressions ?? []).length;
    const types: string[] = p.spec?.policyTypes ?? ['Ingress'];
    return types.includes('Ingress') && (selectsAll || selects(sel, dst.metadata.labels));
  });
  if (!pols.length) return { allowed: true };
  for (const p of pols) {
    for (const rule of p.spec.ingress ?? []) {
      const portsOk = !(rule.ports ?? []).length || (rule.ports ?? []).some((rp: Obj) => resolveTargetPort(dst, rp.port) === port || rp.port === undefined);
      if (!portsOk) continue;
      if (!(rule.from ?? []).length) return { allowed: true, by: p.metadata.name };
      for (const peer of rule.from) {
        if (!src) continue;
        const srcNs = c.get('Namespace', undefined, src.metadata.namespace);
        const nsOk = peer.namespaceSelector ? selects(peer.namespaceSelector, srcNs?.metadata.labels) || isEmptySel(peer.namespaceSelector) : src.metadata.namespace === ns;
        const podOk = peer.podSelector ? selects(peer.podSelector, src.metadata.labels) || isEmptySel(peer.podSelector) : true;
        if (nsOk && podOk) return { allowed: true, by: p.metadata.name };
      }
    }
  }
  return { allowed: false, by: pols.map((p) => p.metadata.name).join(', ') };
}

const isEmptySel = (s: Obj) => !Object.keys(s.matchLabels ?? {}).length && !(s.matchExpressions ?? []).length;

export function podByIp(c: Cluster, ip: string): Obj | undefined {
  return c.list('Pod').find((p) => p.status?.podIP === ip && !p.metadata.deletionTimestamp) ?? c.list('Pod').find((p) => p.status?.podIP === ip);
}

/** Ask a pod process over HTTP (what the image answers). */
function askPod(c: Cluster, src: Obj | null, pod: Obj, port: number, path: string, host: string, trace: string[]): HttpResult {
  const ip = pod.status.podIP;
  if (!podProcessUp(c, pod)) {
    trace.push(`${ip}:${port} — no process answers (the pod's node is down or the container is not running)`);
    return { ok: false, exit: 28, error: `curl: (28) Failed to connect to ${host} port ${port} after 130421 ms: Couldn't connect to server`, trace };
  }
  const pol = policyAllows(c, src, pod, port);
  if (!pol.allowed) {
    trace.push(`NetworkPolicy ${pol.by} drops the packet before it reaches ${pod.metadata.name}`);
    return { ok: false, exit: 28, error: `curl: (28) Failed to connect to ${host} port ${port} after 130412 ms: Couldn't connect to server`, trace };
  }
  const ct = (pod.spec.containers ?? []).find((x: Obj) => lookupImage(x.image)?.ports.includes(port));
  if (!ct) {
    trace.push(`${pod.metadata.name} (${ip}) has nothing listening on ${port}: the kernel answers RST`);
    return { ok: false, exit: 7, error: `curl: (7) Failed to connect to ${host} port ${port} after 1 ms: Couldn't connect to server`, trace };
  }
  const img = lookupImage(ct.image)!;
  if (!img.http) {
    trace.push(`${pod.metadata.name} accepts the connection but does not speak HTTP`);
    return { ok: false, exit: 52, error: `curl: (52) Empty reply from server`, trace };
  }
  const rt = c.runtime[pod.metadata.uid];
  if (img.warmup && rt && c.now - (rt.containers[0]?.startedAt ?? c.now) < img.warmup) {
    trace.push(`${pod.metadata.name} is still warming up`);
    return { ok: false, exit: 52, error: 'curl: (52) Empty reply from server', trace };
  }
  if (!img.http.includes(path)) {
    trace.push(`${pod.metadata.name} answers 404 for ${path}`);
    return { ok: true, status: 404, body: '404 page not found', exit: 0, pod: pod.metadata.name, trace };
  }
  const env = Object.fromEntries((ct.env ?? []).filter((e: Obj) => e.value !== undefined).map((e: Obj) => [e.name, String(e.value)]));
  let body = (img.body ?? 'ok').replace(/\{pod\}/g, pod.metadata.name).replace(/\{ip\}/g, ip);
  if (path === '/healthz' || path === '/ready') body = 'ok';
  else if (env.GREETING) body = `${env.GREETING}! ${body}`;
  trace.push(`${pod.metadata.name} (${ip}:${port}) answers 200`);
  return { ok: true, status: 200, body, exit: 0, pod: pod.metadata.name, trace };
}

/** curl from a pod (or from a node when src is null) to a URL. */
export function httpFrom(c: Cluster, src: Obj | null, url: string): HttpResult {
  const trace: string[] = [];
  const m = /^(?:https?:\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/.exec(url.trim());
  if (!m) return { ok: false, exit: 3, error: `curl: (3) URL rejected: Malformed input to a URL function`, trace };
  const host = m[1];
  const port = Number(m[2] ?? 80);
  const path = m[3] ?? '/';
  const ns = src?.metadata.namespace ?? 'default';
  let ip = host;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const r = resolve(c, ns, host);
    if (!r.ok) {
      trace.push(r.error === 'TIMEOUT' ? `DNS: no answer from ${DNS_IP} (CoreDNS is not serving)` : `DNS: every name in the search list is NXDOMAIN (${r.queries.map((q) => q.name).join(', ')})`);
      return { ok: false, exit: 6, error: `curl: (6) Could not resolve host: ${host}`, trace };
    }
    trace.push(`DNS: ${host} → ${r.fqdn} → ${r.ips[0]}`);
    ip = r.ips[0];
  }
  // A Service ClusterIP: kube-proxy's rules on the client's node.
  const svcEntries = Object.entries(c.proxy.services).filter(([, v]) => v.clusterIP === ip && v.port === port && v.protocol === 'TCP');
  const svc = c.list('Service').find((s) => s.spec.clusterIP === ip);
  if (svc || svcEntries.length) {
    if (!svcEntries.length) {
      trace.push(`${ip}:${port} is a ClusterIP, but kube-proxy has no rule for it (kube-proxy is not running, or the port is wrong): nothing answers`);
      return { ok: false, exit: 28, error: `curl: (28) Failed to connect to ${host} port ${port} after 130433 ms: Couldn't connect to server`, trace };
    }
    const [k, entry] = svcEntries[0];
    if (!entry.endpoints.length) {
      trace.push(`${ip}:${port}: the Service has no ready endpoints — kube-proxy's rule is REJECT`);
      return { ok: false, exit: 7, error: `curl: (7) Failed to connect to ${host} port ${port} after 2 ms: Couldn't connect to server`, trace };
    }
    const affinity = svc?.spec.sessionAffinity === 'ClientIP';
    const n = (c.rr[k] = (c.rr[k] ?? -1) + (affinity ? 0 : 1));
    const target = entry.endpoints[Math.max(0, n) % entry.endpoints.length];
    const [pip, pport] = target.split(':');
    trace.push(`kube-proxy DNAT ${ip}:${port} → ${target} (1 of ${entry.endpoints.length} endpoints)`);
    const pod = podByIp(c, pip);
    if (!pod) {
      trace.push(`${target}: the pod is gone, but kube-proxy still has the old rule`);
      return { ok: false, exit: 28, error: `curl: (28) Failed to connect to ${host} port ${port} after 130412 ms: Couldn't connect to server`, trace };
    }
    return askPod(c, src, pod, Number(pport), path, host, trace);
  }
  const pod = podByIp(c, ip);
  if (pod) return askPod(c, src, pod, port, path, host, trace);
  if (Object.values(EXTERNAL).includes(ip)) {
    trace.push(`${ip} is outside the cluster: the node MASQUERADEs the source to its own IP`);
    return { ok: true, status: 200, body: '<!doctype html><title>Example Domain</title>', exit: 0, trace };
  }
  trace.push(`${ip}: no such address in the cluster`);
  return { ok: false, exit: 28, error: `curl: (28) Failed to connect to ${host} port ${port} after 130412 ms: Couldn't connect to server`, trace };
}

/** kube-proxy's NAT table in iptables-save format (the subset that shows the idea, real names). */
export function iptablesSave(c: Cluster, node: string): string {
  const lines: string[] = [`# Generated by iptables-save v1.8.10 (nf_tables) on Wed Nov 18 09:00:00 2026`, '*nat', ':PREROUTING ACCEPT [0:0]', ':INPUT ACCEPT [0:0]', ':OUTPUT ACCEPT [0:0]', ':POSTROUTING ACCEPT [0:0]', ':KUBE-MARK-MASQ - [0:0]', ':KUBE-NODEPORTS - [0:0]', ':KUBE-POSTROUTING - [0:0]', ':KUBE-SERVICES - [0:0]'];
  const rules: string[] = [];
  const chains: string[] = [];
  const entries = Object.entries(c.proxy.services).sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of entries) {
    const [nsName, portName, proto] = k.split(':');
    const spn = `${nsName}${portName ? `:${portName}` : ''}`;
    const p = proto.toLowerCase();
    const svcChain = `KUBE-SVC-${kubeProxyHash(spn, p)}`;
    const comment = `"${spn} cluster IP"`;
    if (!v.endpoints.length) {
      rules.push(`-A KUBE-SERVICES -d ${v.clusterIP}/32 -p ${p} -m comment --comment "${spn} has no endpoints" -m ${p} --dport ${v.port} -j REJECT --reject-with icmp-port-unreachable`);
      continue;
    }
    chains.push(`:${svcChain} - [0:0]`);
    rules.push(`-A KUBE-SERVICES -d ${v.clusterIP}/32 -p ${p} -m comment --comment ${comment} -m ${p} --dport ${v.port} -j ${svcChain}`);
    if (v.nodePort) rules.push(`-A KUBE-NODEPORTS -p ${p} -m comment --comment "${spn}" -m ${p} --dport ${v.nodePort} -j KUBE-EXT-${kubeProxyHash(spn, p)}`);
    rules.push(`-A ${svcChain} ! -s 10.42.0.0/16 -d ${v.clusterIP}/32 -p ${p} -m comment --comment ${comment} -m ${p} --dport ${v.port} -j KUBE-MARK-MASQ`);
    const n = v.endpoints.length;
    v.endpoints.forEach((ep, i) => {
      const sep = `KUBE-SEP-${kubeProxyHash(spn, p, ep)}`;
      chains.push(`:${sep} - [0:0]`);
      const left = n - i;
      const prob = left > 1 ? ` -m statistic --mode random --probability ${(1 / left).toFixed(11)}` : '';
      rules.push(`-A ${svcChain} -m comment --comment "${spn} -> ${ep}"${prob} -j ${sep}`);
      rules.push(`-A ${sep} -s ${ep.split(':')[0]}/32 -m comment --comment "${spn}" -j KUBE-MARK-MASQ`);
      rules.push(`-A ${sep} -p ${p} -m comment --comment "${spn}" -m ${p} -j DNAT --to-destination ${ep}`);
    });
  }
  lines.push(...chains);
  lines.push('-A PREROUTING -m comment --comment "kubernetes service portals" -j KUBE-SERVICES');
  lines.push('-A OUTPUT -m comment --comment "kubernetes service portals" -j KUBE-SERVICES');
  lines.push('-A POSTROUTING -m comment --comment "kubernetes postrouting rules" -j KUBE-POSTROUTING');
  lines.push('-A KUBE-MARK-MASQ -j MARK --set-xmark 0x4000/0x4000');
  lines.push('-A KUBE-POSTROUTING -m mark ! --mark 0x4000/0x4000 -j RETURN');
  lines.push('-A KUBE-POSTROUTING -j MARK --set-xmark 0x4000/0x0');
  lines.push('-A KUBE-POSTROUTING -m comment --comment "kubernetes service traffic requiring SNAT" -j MASQUERADE --random-fully');
  lines.push(...rules);
  lines.push('-A KUBE-SERVICES -m comment --comment "kubernetes service nodeports; NOTE: this must be the last rule in this chain" -m addrtype --dst-type LOCAL -j KUBE-NODEPORTS');
  lines.push('COMMIT', `# Completed on Wed Nov 18 09:00:00 2026`);
  void node;
  return lines.join('\n') + '\n';
}

/** ip addr of a node: no ClusterIP on any interface — the point of KN4 screen 4. */
export function nodeIpAddr(c: Cluster, node: string): string {
  const n = c.node(node)!;
  const pods = Object.values(c.runtime).filter((r) => r.node === node && r.sandbox);
  const out = [
    '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000',
    '    inet 127.0.0.1/8 scope host lo',
    '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000',
    `    inet ${n.ip}/24 brd 192.168.56.255 scope global eth0`,
    '3: flannel.1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UNKNOWN group default',
    `    inet ${n.podCIDR.replace('.0/24', '.0')}/32 scope global flannel.1`,
    '4: cni0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP group default qlen 1000',
    `    inet ${n.podCIDR.replace('.0/24', '.1')}/24 brd ${n.podCIDR.replace('.0/24', '.255')} scope global cni0`,
  ];
  pods.forEach((r, i) => out.push(`${5 + i}: veth${r.uid.slice(0, 8)}@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue master cni0 state UP group default`));
  return out.join('\n') + '\n';
}

/** ip route of a node: its own podCIDR on cni0, the others through flannel.1 (VXLAN). */
export function nodeIpRoute(c: Cluster, node: string): string {
  const n = c.node(node)!;
  const lines = [`default via 192.168.56.1 dev eth0 proto dhcp src ${n.ip} metric 100`];
  for (const o of c.nodes) {
    if (o.name === node) lines.push(`${o.podCIDR} dev cni0 proto kernel scope link src ${o.podCIDR.replace('.0/24', '.1')}`);
    else lines.push(`${o.podCIDR} via ${o.podCIDR.replace('/24', '')} dev flannel.1 onlink`);
  }
  lines.push(`192.168.56.0/24 dev eth0 proto kernel scope link src ${n.ip} metric 100`);
  return lines.join('\n') + '\n';
}

/** The owner chain of a pod: "ReplicaSet/web-5d78…" for describe. */
export function controlledBy(p: Obj): string | undefined {
  const r = controllerOf(p);
  return r ? `${r.kind}/${r.name}` : undefined;
}
