import { pad } from '../util';
// `kubectl describe`: the human-readable view with the Events at the bottom
// (the first place to look when something does not start). Layout follows
// kubectl v1.37 describers.

import type { Cluster } from '../cluster';
import { controllerOf, podReady } from '../controllers';
import { nodeUsage, podRequests } from '../scheduler';
import { age, fmtMem, fmtMilli, bytes, cpuMilli, type Obj } from '../util';
import { podStatusWord, nodeStatusWord, toYaml } from './printers';
import { unb64 } from '../admission';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** RFC 1123 as kubectl prints times: "Wed, 18 Nov 2026 09:00:12 +0000". */
export function rfc1123(ts: string | undefined): string {
  if (!ts) return '<unknown>';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]}, ${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}

function kv(rows: [string, string][], width = 0): string {
  const w = width || Math.max(...rows.map(([k]) => k.length)) + 2;
  return rows.map(([k, v]) => `${(k + ':').padEnd(w)}${v}`).join('\n') + '\n';
}

function labelsBlock(name: string, l: Obj | undefined, w: number): string {
  const e = Object.entries(l ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!e.length) return `${(name + ':').padEnd(w)}<none>\n`;
  return e.map(([k, v], i) => `${(i ? '' : name + ':').padEnd(w)}${k}=${v}`).join('\n') + '\n';
}

function annotationsBlock(l: Obj | undefined, w: number): string {
  const e = Object.entries(l ?? {}).filter(([k]) => k !== 'kubectl.kubernetes.io/last-applied-configuration');
  if (!e.length) return `${'Annotations:'.padEnd(w)}<none>\n`;
  return e.map(([k, v], i) => `${(i ? '' : 'Annotations:').padEnd(w)}${k}: ${v}`).join('\n') + '\n';
}

export function eventsBlock(c: Cluster, obj: Obj): string {
  const evs = c.eventsFor(obj);
  if (!evs.length) return 'Events:                      <none>\n';
  const rows = evs.map((e) => {
    const first = c.now - Date.parse(e.firstTimestamp);
    const last = c.now - Date.parse(e.lastTimestamp);
    const when = (e.count ?? 1) > 1 ? `${age(last)} (x${e.count} over ${age(first)})` : age(first);
    return [e.type, e.reason, when, e.source?.component ?? '', e.message];
  });
  const head = [['Type', 'Reason', 'Age', 'From', 'Message'], ['----', '------', '----', '----', '-------']];
  const all = [...head, ...rows];
  const w = [0, 1, 2, 3].map((i) => Math.max(...all.map((r) => r[i].length)));
  return 'Events:\n' + all.map((r) => '  ' + r.map((x, i) => (i < 4 ? x.padEnd(w[i] + 2) : x)).join('')).join('\n') + '\n';
}

function stateBlock(s: Obj | undefined, indent: string, title: string): string {
  if (!s || !Object.keys(s).length) return '';
  if (s.running) return `${indent}${(title + ':').padEnd(16)}Running\n${indent}  Started:      ${rfc1123(s.running.startedAt)}\n`;
  if (s.waiting) return `${indent}${(title + ':').padEnd(16)}Waiting\n${indent}  Reason:       ${s.waiting.reason}\n`;
  if (s.terminated)
    return `${indent}${(title + ':').padEnd(16)}Terminated\n${indent}  Reason:       ${s.terminated.reason}\n${indent}  Exit Code:    ${s.terminated.exitCode}\n${indent}  Started:      ${rfc1123(s.terminated.startedAt)}\n${indent}  Finished:     ${rfc1123(s.terminated.finishedAt)}\n`;
  return '';
}

function probeStr(p: Obj | undefined): string | undefined {
  if (!p) return undefined;
  const how = p.httpGet ? `http-get http://:${p.httpGet.port}${p.httpGet.path ?? '/'}` : p.tcpSocket ? `tcp-socket :${p.tcpSocket.port}` : p.exec ? `exec [${(p.exec.command ?? []).join(' ')}]` : 'unknown';
  return `${how} delay=${p.initialDelaySeconds ?? 0}s timeout=${p.timeoutSeconds ?? 1}s period=${p.periodSeconds ?? 10}s #success=${p.successThreshold ?? 1} #failure=${p.failureThreshold ?? 3}`;
}

function envBlock(c: Cluster | null, ns: string, ct: Obj, indent: string): string {
  const env: Obj[] = ct.env ?? [];
  const from: Obj[] = ct.envFrom ?? [];
  let s = '';
  if (from.length) {
    s += `${indent}Environment Variables from:\n`;
    for (const f of from) {
      const r = f.configMapRef ?? f.secretRef;
      const what = f.configMapRef ? 'ConfigMap' : 'Secret';
      s += `${indent}  ${r.name}  ${what}  Optional: ${r.optional ? 'true' : 'false'}\n`;
    }
  }
  if (!env.length) return s + `${indent}Environment:    <none>\n`;
  s += `${indent}Environment:\n`;
  for (const e of env) {
    if (e.value !== undefined) s += `${indent}  ${e.name}:  ${e.value}\n`;
    else if (e.valueFrom?.configMapKeyRef) s += `${indent}  ${e.name}:  <set to the key '${e.valueFrom.configMapKeyRef.key}' of config map '${e.valueFrom.configMapKeyRef.name}'>  Optional: ${e.valueFrom.configMapKeyRef.optional ? 'true' : 'false'}\n`;
    else if (e.valueFrom?.secretKeyRef) s += `${indent}  ${e.name}:  <set to the key '${e.valueFrom.secretKeyRef.key}' in secret '${e.valueFrom.secretKeyRef.name}'>  Optional: ${e.valueFrom.secretKeyRef.optional ? 'true' : 'false'}\n`;
    else if (e.valueFrom?.fieldRef) s += `${indent}  ${e.name}:   (${e.valueFrom.fieldRef.apiVersion ?? 'v1'}:${e.valueFrom.fieldRef.fieldPath})\n`;
  }
  void c;
  void ns;
  return s;
}

function containersBlock(c: Cluster | null, pod: Obj | null, spec: Obj, ns: string, indent: string): string {
  let s = '';
  for (const ct of spec.containers ?? []) {
    const st = pod?.status?.containerStatuses?.find((x: Obj) => x.name === ct.name);
    s += `${indent}${ct.name}:\n`;
    const i = indent + '  ';
    if (pod) s += `${i}Container ID:   ${st?.containerID ?? ''}\n`;
    s += `${i}Image:          ${ct.image}\n`;
    if (pod) s += `${i}Image ID:       ${st?.imageID ?? ''}\n`;
    const ports: Obj[] = ct.ports ?? [];
    s += `${i}Port:           ${ports.length ? ports.map((p) => `${p.containerPort}/${p.protocol ?? 'TCP'}${p.name ? ` (${p.name})` : ''}`).join(', ') : '<none>'}\n`;
    s += `${i}Host Port:      ${ports.length ? ports.map((p) => `${p.hostPort ?? 0}/${p.protocol ?? 'TCP'}${p.name ? ` (${p.name})` : ''}`).join(', ') : '<none>'}\n`;
    if (ct.command) s += `${i}Command:\n${ct.command.map((x: string) => `${i}  ${x}`).join('\n')}\n`;
    if (ct.args) s += `${i}Args:\n${ct.args.map((x: string) => `${i}  ${x}`).join('\n')}\n`;
    if (pod) {
      s += stateBlock(st?.state, i, 'State');
      s += stateBlock(st?.lastState, i, 'Last State');
      s += `${i}Ready:          ${st?.ready ? 'True' : 'False'}\n`;
      s += `${i}Restart Count:  ${st?.restartCount ?? 0}\n`;
    }
    const lim = ct.resources?.limits ?? {};
    const req = ct.resources?.requests ?? {};
    if (Object.keys(lim).length) s += `${i}Limits:\n` + Object.entries(lim).map(([k, v]) => `${i}  ${k}:  ${v}`).join('\n') + '\n';
    if (Object.keys(req).length) s += `${i}Requests:\n` + Object.entries(req).map(([k, v]) => `${i}  ${k}:  ${v}`).join('\n') + '\n';
    for (const [label, p] of [
      ['Liveness', ct.livenessProbe],
      ['Readiness', ct.readinessProbe],
      ['Startup', ct.startupProbe],
    ] as const) {
      const ps = probeStr(p);
      if (ps) s += `${i}${(label + ':').padEnd(16)}${ps}\n`;
    }
    s += envBlock(c, ns, ct, i);
    const mounts: Obj[] = ct.volumeMounts ?? [];
    s += `${i}Mounts:\n`;
    s += mounts.length ? mounts.map((m) => `${i}  ${m.mountPath} from ${m.name} (${m.readOnly ? 'ro' : 'rw'})`).join('\n') + '\n' : `${i}  <none>\n`;
  }
  return s;
}

function volumesBlock(spec: Obj, indent: string): string {
  const vols: Obj[] = spec.volumes ?? [];
  if (!vols.length) return `${indent}<none>\n`;
  let s = '';
  for (const v of vols) {
    s += `${indent}${v.name}:\n`;
    const i = indent + '  ';
    if (v.projected) s += `${i}Type:                    Projected (a volume that contains injected data from multiple sources)\n${i}TokenExpirationSeconds:  3607\n${i}ConfigMapName:           kube-root-ca.crt\n${i}Optional:                false\n${i}DownwardAPI:             true\n`;
    else if (v.configMap) s += `${i}Type:      ConfigMap (a volume populated by a ConfigMap)\n${i}Name:      ${v.configMap.name}\n${i}Optional:  ${v.configMap.optional ? 'true' : 'false'}\n`;
    else if (v.secret) s += `${i}Type:        Secret (a volume populated by a Secret)\n${i}SecretName:  ${v.secret.secretName}\n${i}Optional:    ${v.secret.optional ? 'true' : 'false'}\n`;
    else if (v.emptyDir) s += `${i}Type:       EmptyDir (a temporary directory that shares a pod's lifetime)\n${i}Medium:     ${v.emptyDir.medium ?? ''}\n${i}SizeLimit:  <unset>\n`;
    else s += `${i}Type:  ${Object.keys(v).filter((k) => k !== 'name')[0] ?? 'unknown'}\n`;
  }
  return s;
}

function tolerationsBlock(tol: Obj[] | undefined, w: number): string {
  const t = (tol ?? []).map((x) => `${x.key ?? ''}${x.value ? `=${x.value}` : ''}${x.effect ? `:${x.effect}` : ''}${x.operator === 'Exists' ? ' op=Exists' : ''}${typeof x.tolerationSeconds === 'number' ? ` for ${x.tolerationSeconds}s` : ''}`);
  if (!t.length) return `${'Tolerations:'.padEnd(w)}<none>\n`;
  return t.map((x, i) => `${(i ? '' : 'Tolerations:').padEnd(w)}${x}`).join('\n') + '\n';
}

function describePod(c: Cluster, p: Obj): string {
  const W = 18;
  const node = p.spec.nodeName ? `${p.spec.nodeName}/${p.status?.hostIP ?? ''}` : '<none>';
  let s = kv(
    [
      ['Name', p.metadata.name],
      ['Namespace', p.metadata.namespace],
      ['Priority', String(p.spec.priority ?? 0)],
      ...(p.spec.priorityClassName ? ([['Priority Class Name', p.spec.priorityClassName]] as [string, string][]) : []),
      ['Service Account', p.spec.serviceAccountName ?? 'default'],
      ['Node', node],
      ...(p.status?.startTime ? ([['Start Time', rfc1123(p.status.startTime)]] as [string, string][]) : []),
    ],
    W,
  );
  s += labelsBlock('Labels', p.metadata.labels, W);
  s += annotationsBlock(p.metadata.annotations, W);
  if (p.metadata.deletionTimestamp) s += `${'Status:'.padEnd(W)}Terminating (lasts ${age(Math.max(0, c.now - Date.parse(p.metadata.deletionTimestamp) + (p.metadata.deletionGracePeriodSeconds ?? 30) * 1000))})\n${'Termination Grace Period:'.padEnd(W)}${p.metadata.deletionGracePeriodSeconds ?? 30}s\n`;
  else s += `${'Status:'.padEnd(W)}${p.status?.phase ?? 'Pending'}\n`;
  s += `${'IP:'.padEnd(W)}${p.status?.podIP ?? ''}\n`;
  s += `IPs:${p.status?.podIP ? `\n  IP:  ${p.status.podIP}` : `               <none>`}\n`;
  const owner = controllerOf(p);
  if (owner) s += `Controlled By:  ${owner.kind}/${owner.name}\n`;
  s += 'Containers:\n' + containersBlock(c, p, p.spec, p.metadata.namespace, '  ');
  const conds: Obj[] = p.status?.conditions ?? [];
  if (conds.length) {
    s += 'Conditions:\n  Type                        Status\n';
    for (const x of conds) s += `  ${x.type.padEnd(28)}${x.status} \n`;
  }
  s += 'Volumes:\n' + volumesBlock(p.spec, '  ');
  s += `${'QoS Class:'.padEnd(29)}${p.status?.qosClass ?? 'BestEffort'}\n`;
  const sel = Object.entries(p.spec.nodeSelector ?? {}).map(([k, v]) => `${k}=${v}`);
  s += `${'Node-Selectors:'.padEnd(29)}${sel.length ? sel.join('\n' + ' '.repeat(29)) : '<none>'}\n`;
  s += tolerationsBlock(p.spec.tolerations, 29);
  s += eventsBlock(c, p);
  return s;
}

function strategyLines(d: Obj): [string, string][] {
  const st = d.spec.strategy ?? {};
  const rows: [string, string][] = [['StrategyType', st.type ?? 'RollingUpdate'], ['MinReadySeconds', String(d.spec.minReadySeconds ?? 0)]];
  if (st.type !== 'Recreate') rows.push(['RollingUpdateStrategy', `${st.rollingUpdate?.maxUnavailable ?? '25%'} max unavailable, ${st.rollingUpdate?.maxSurge ?? '25%'} max surge`]);
  return rows;
}

/** The Pod Template block alone (rollout history --revision). */
export function podTemplateText(tpl: Obj): string {
  return podTemplateBlock(null, tpl, '');
}

function podTemplateBlock(c: Cluster | null, tpl: Obj, ns: string): string {
  let s = 'Pod Template:\n';
  s += labelsBlock('  Labels', tpl.metadata?.labels, 16);
  const an = Object.entries(tpl.metadata?.annotations ?? {});
  if (an.length) s += an.map(([k, v], i) => `${(i ? '' : '  Annotations:').padEnd(16)}${k}: ${v}`).join('\n') + '\n';
  if (tpl.spec?.serviceAccountName) s += `  Service Account:  ${tpl.spec.serviceAccountName}\n`;
  s += '  Containers:\n' + containersBlock(c, null, tpl.spec ?? {}, ns, '   ');
  s += '  Volumes:         ' + ((tpl.spec?.volumes ?? []).length ? '\n' + volumesBlock(tpl.spec, '   ') : '<none>\n');
  const sel = Object.entries(tpl.spec?.nodeSelector ?? {}).map(([k, v]) => `${k}=${v}`);
  s += `  Node-Selectors:  ${sel.length ? sel.join(',') : '<none>'}\n`;
  s += `  Tolerations:     ${(tpl.spec?.tolerations ?? []).length ? (tpl.spec.tolerations as Obj[]).map((t) => `${t.key}${t.effect ? `:${t.effect}` : ''}${t.operator === 'Exists' ? ' op=Exists' : ''}`).join(', ') : '<none>'}\n`;
  return s;
}

function describeDeployment(c: Cluster, d: Obj): string {
  const W = 24;
  const rsList = c.list('ReplicaSet', d.metadata.namespace).filter((r) => controllerOf(r)?.uid === d.metadata.uid);
  const sel = Object.entries(d.spec.selector?.matchLabels ?? {}).map(([k, v]) => `${k}=${v}`).join(',');
  let s = kv([['Name', d.metadata.name], ['Namespace', d.metadata.namespace], ['CreationTimestamp', rfc1123(d.metadata.creationTimestamp)]], W);
  s += labelsBlock('Labels', d.metadata.labels, W);
  const an = { ...(d.metadata.annotations ?? {}) };
  s += annotationsBlock(an, W);
  s += kv(
    [
      ['Selector', sel],
      ['Replicas', `${d.spec.replicas ?? 1} desired | ${d.status?.updatedReplicas ?? 0} updated | ${d.status?.replicas ?? 0} total | ${d.status?.availableReplicas ?? 0} available | ${d.status?.unavailableReplicas ?? 0} unavailable`],
      ...strategyLines(d),
    ],
    W,
  );
  s += podTemplateBlock(c, d.spec.template, d.metadata.namespace);
  s += 'Conditions:\n  Type           Status  Reason\n  ----           ------  ------\n';
  for (const x of d.status?.conditions ?? []) s += `  ${x.type.padEnd(15)}${x.status.padEnd(8)}${x.reason}\n`;
  const hash = (r: Obj) => r.metadata.labels?.['pod-template-hash'];
  const newRs = rsList.find((r) => hash(r) && hash(r) === rsList.sort((a, b) => Number(b.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? 0) - Number(a.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? 0))[0] && hash(r));
  const olds = rsList.filter((r) => r !== newRs && (r.spec.replicas ?? 0) > 0);
  s += `OldReplicaSets:  ${olds.length ? olds.map((r) => `${r.metadata.name} (${r.status?.replicas ?? 0}/${r.spec.replicas} replicas created)`).join(', ') : '<none>'}\n`;
  s += `NewReplicaSet:   ${newRs ? `${newRs.metadata.name} (${newRs.status?.replicas ?? 0}/${newRs.spec.replicas} replicas created)` : '<none>'}\n`;
  s += eventsBlock(c, d);
  return s;
}

function describeReplicaSet(c: Cluster, r: Obj): string {
  const W = 14;
  const pods = c.list('Pod', r.metadata.namespace).filter((p) => controllerOf(p)?.uid === r.metadata.uid);
  const count = (ph: string) => pods.filter((p) => p.status?.phase === ph).length;
  let s = kv([['Name', r.metadata.name], ['Namespace', r.metadata.namespace], ['Selector', Object.entries(r.spec.selector?.matchLabels ?? {}).map(([k, v]) => `${k}=${v}`).join(',')]], W);
  s += labelsBlock('Labels', r.metadata.labels, W);
  s += annotationsBlock(r.metadata.annotations, W);
  const owner = controllerOf(r);
  if (owner) s += `Controlled By:  ${owner.kind}/${owner.name}\n`;
  s += `Replicas:       ${r.status?.replicas ?? 0} current / ${r.spec.replicas ?? 0} desired\n`;
  s += `Pods Status:    ${count('Running')} Running / ${count('Pending')} Waiting / ${count('Succeeded')} Succeeded / ${count('Failed')} Failed\n`;
  s += podTemplateBlock(c, r.spec.template, r.metadata.namespace);
  s += eventsBlock(c, r);
  return s;
}

function describeService(c: Cluster, svc: Obj): string {
  const W = 25;
  const slices = c.list('EndpointSlice', svc.metadata.namespace).filter((x) => x.metadata.labels?.['kubernetes.io/service-name'] === svc.metadata.name);
  let s = kv([['Name', svc.metadata.name], ['Namespace', svc.metadata.namespace]], W);
  s += labelsBlock('Labels', svc.metadata.labels, W);
  s += annotationsBlock(svc.metadata.annotations, W);
  const sel = Object.entries(svc.spec.selector ?? {}).map(([k, v]) => `${k}=${v}`).join(',');
  s += kv(
    [
      ['Selector', sel || '<none>'],
      ['Type', svc.spec.type],
      ['IP Family Policy', svc.spec.ipFamilyPolicy ?? 'SingleStack'],
      ['IP Families', (svc.spec.ipFamilies ?? ['IPv4']).join(',')],
      ['IP', svc.spec.clusterIP],
      ['IPs', (svc.spec.clusterIPs ?? [svc.spec.clusterIP]).join(',')],
    ],
    W,
  );
  if (svc.spec.type === 'LoadBalancer') s += `${'LoadBalancer Ingress:'.padEnd(W)}${(svc.status?.loadBalancer?.ingress ?? []).map((x: Obj) => `${x.ip} (VIP)`).join(', ')}\n`;
  for (const p of svc.spec.ports ?? []) {
    const name = p.name ?? '<unset>';
    s += `${'Port:'.padEnd(W)}${name}  ${p.port}/${p.protocol ?? 'TCP'}\n`;
    s += `${'TargetPort:'.padEnd(W)}${p.targetPort}/${p.protocol ?? 'TCP'}\n`;
    if (p.nodePort) s += `${'NodePort:'.padEnd(W)}${name}  ${p.nodePort}/${p.protocol ?? 'TCP'}\n`;
    const eps = slices.flatMap((sl) => (sl.endpoints ?? []).filter((e: Obj) => e.conditions?.ready).map((e: Obj) => `${e.addresses[0]}:${(sl.ports ?? []).find((x: Obj) => (x.name ?? '') === (p.name ?? ''))?.port ?? p.targetPort}`));
    s += `${'Endpoints:'.padEnd(W)}${eps.length ? eps.join(',') : ''}\n`;
  }
  s += `${'Session Affinity:'.padEnd(W)}${svc.spec.sessionAffinity ?? 'None'}\n`;
  if (svc.spec.externalTrafficPolicy) s += `${'External Traffic Policy:'.padEnd(W)}${svc.spec.externalTrafficPolicy}\n`;
  s += `${'Internal Traffic Policy:'.padEnd(W)}${svc.spec.internalTrafficPolicy ?? 'Cluster'}\n`;
  s += eventsBlock(c, svc);
  return s;
}

function describeNode(c: Cluster, n: Obj): string {
  const W = 20;
  let s = kv([['Name', n.metadata.name], ['Roles', Object.keys(n.metadata.labels ?? {}).filter((k) => k.startsWith('node-role.kubernetes.io/')).map((k) => k.split('/')[1]).sort().join(',') || '<none>']], W);
  s += labelsBlock('Labels', n.metadata.labels, W);
  s += annotationsBlock(n.metadata.annotations, W);
  s += `${'CreationTimestamp:'.padEnd(W)}${rfc1123(n.metadata.creationTimestamp)}\n`;
  const taints: Obj[] = n.spec?.taints ?? [];
  s += taints.length ? taints.map((t, i) => `${(i ? '' : 'Taints:').padEnd(W)}${t.key}${t.value ? `=${t.value}` : ''}:${t.effect}`).join('\n') + '\n' : `${'Taints:'.padEnd(W)}<none>\n`;
  s += `${'Unschedulable:'.padEnd(W)}${n.spec?.unschedulable ? 'true' : 'false'}\n`;
  const lease = c.get('Lease', 'kube-node-lease', n.metadata.name);
  s += `Lease:\n  HolderIdentity:  ${n.metadata.name}\n  AcquireTime:     <unset>\n  RenewTime:       ${rfc1123(lease?.spec?.renewTime)}\n`;
  s += 'Conditions:\n  Type             Status  LastHeartbeatTime                 LastTransitionTime                Reason                       Message\n  ----             ------  -----------------                 ------------------                ------                       -------\n';
  for (const x of n.status?.conditions ?? []) s += `  ${x.type.padEnd(17)}${x.status.padEnd(8)}${rfc1123(x.lastHeartbeatTime).padEnd(34)}${rfc1123(x.lastTransitionTime).padEnd(34)}${x.reason.padEnd(29)}${x.message}\n`;
  s += 'Addresses:\n' + (n.status?.addresses ?? []).map((a: Obj) => `  ${(a.type + ':').padEnd(12)}${a.address}`).join('\n') + '\n';
  const cap = n.status?.capacity ?? {};
  const alloc = n.status?.allocatable ?? {};
  s += 'Capacity:\n' + Object.entries(cap).map(([k, v]) => `  ${(k + ':').padEnd(19)}${v}`).join('\n') + '\n';
  s += 'Allocatable:\n' + Object.entries(alloc).map(([k, v]) => `  ${(k + ':').padEnd(19)}${v}`).join('\n') + '\n';
  const info = n.status?.nodeInfo ?? {};
  s += `System Info:\n  Machine ID:                 ${info.machineID}\n  Kernel Version:             ${info.kernelVersion}\n  OS Image:                   ${info.osImage}\n  Operating System:           linux\n  Architecture:               amd64\n  Container Runtime Version:  ${info.containerRuntimeVersion}\n  Kubelet Version:            ${info.kubeletVersion}\n`;
  s += `PodCIDR:                      ${n.spec?.podCIDR ?? ''}\nPodCIDRs:                     ${(n.spec?.podCIDRs ?? []).join(',')}\nProviderID:                   ${n.spec?.providerID ?? ''}\n`;
  const pods = c.list('Pod').filter((p) => p.spec.nodeName === n.metadata.name && p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed');
  s += `Non-terminated Pods:          (${pods.length} in total)\n`;
  const rows = [['Namespace', 'Name', 'CPU Requests', 'CPU Limits', 'Memory Requests', 'Memory Limits', 'Age'], ['---------', '----', '------------', '----------', '---------------', '-------------', '---']];
  const ac = cpuMilli(alloc.cpu);
  const am = bytes(alloc.memory);
  for (const p of pods) {
    const r = podRequests(p.spec);
    let lc = 0;
    let lm = 0;
    for (const ct of p.spec.containers ?? []) {
      lc += cpuMilli(ct.resources?.limits?.cpu);
      lm += bytes(ct.resources?.limits?.memory);
    }
    const pc = (x: number, a: number) => `${Math.round((x / a) * 100)}%`;
    rows.push([p.metadata.namespace, p.metadata.name, `${fmtMilli(r.cpu)} (${pc(r.cpu, ac)})`, `${fmtMilli(lc)} (${pc(lc, ac)})`, `${r.memory ? fmtMem(r.memory) : '0'} (${pc(r.memory, am)})`, `${lm ? fmtMem(lm) : '0'} (${pc(lm, am)})`, age(c.now - Date.parse(p.metadata.creationTimestamp))]);
  }
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  s += rows.map((r) => '  ' + r.map((x, i) => x.padEnd(w[i] + 2)).join('').trimEnd()).join('\n') + '\n';
  const u = nodeUsage(c, n.metadata.name);
  s += `Allocated resources:\n  (Total limits may be over 100 percent, i.e., overcommitted.)\n  Resource           Requests    Limits\n  --------           --------    ------\n  cpu                ${`${fmtMilli(u.cpu)} (${Math.round((u.cpu / ac) * 100)}%)`.padEnd(12)}0 (0%)\n  memory             ${`${u.memory ? fmtMem(u.memory) : '0'} (${Math.round((u.memory / am) * 100)}%)`.padEnd(12)}0 (0%)\n`;
  s += eventsBlock(c, n);
  return s;
}

function describeConfigMap(c: Cluster, m: Obj): string {
  let s = kv([['Name', m.metadata.name], ['Namespace', m.metadata.namespace]], 14);
  s += labelsBlock('Labels', m.metadata.labels, 14);
  s += annotationsBlock(m.metadata.annotations, 14);
  s += '\nData\n====\n';
  for (const [k, v] of Object.entries(m.data ?? {})) s += `${k}:\n----\n${v}\n\n`;
  s += '\nBinaryData\n====\n\n';
  s += eventsBlock(c, m);
  return s;
}

function describeSecret(c: Cluster, sec: Obj): string {
  let s = kv([['Name', sec.metadata.name], ['Namespace', sec.metadata.namespace]], 14);
  s += labelsBlock('Labels', sec.metadata.labels, 14);
  s += annotationsBlock(sec.metadata.annotations, 14);
  s += `\nType:  ${sec.type ?? 'Opaque'}\n\nData\n====\n`;
  for (const [k, v] of Object.entries(sec.data ?? {})) s += `${k}:  ${unb64(String(v)).length} bytes\n`;
  void c;
  return s;
}

function describeNamespace(c: Cluster, n: Obj): string {
  let s = kv([['Name', n.metadata.name]], 14);
  s += labelsBlock('Labels', n.metadata.labels, 14);
  s += annotationsBlock(n.metadata.annotations, 14);
  s += `Status:       ${n.status?.phase ?? 'Active'}\n\nNo resource quota.\n\nNo LimitRange resource.\n`;
  void c;
  return s;
}

function describeJob(c: Cluster, j: Obj): string {
  const W = 17;
  const pods = c.list('Pod', j.metadata.namespace).filter((p) => controllerOf(p)?.uid === j.metadata.uid);
  const count = (ph: string) => pods.filter((p) => p.status?.phase === ph).length;
  let s = kv([['Name', j.metadata.name], ['Namespace', j.metadata.namespace], ['Selector', Object.entries(j.spec.selector?.matchLabels ?? {}).map(([k, v]) => `${k}=${v}`).join(',')]], W);
  s += labelsBlock('Labels', j.metadata.labels, W);
  s += annotationsBlock(j.metadata.annotations, W);
  s += kv(
    [
      ['Parallelism', String(j.spec.parallelism ?? 1)],
      ['Completions', String(j.spec.completions ?? 1)],
      ['Completion Mode', j.spec.completionMode ?? 'NonIndexed'],
      ['Suspend', String(j.spec.suspend ?? false)],
      ['Backoff Limit', String(j.spec.backoffLimit ?? 6)],
      ...(j.spec.activeDeadlineSeconds ? ([['Active Deadline Seconds', `${j.spec.activeDeadlineSeconds}s`]] as [string, string][]) : []),
      ...(j.status?.startTime ? ([['Start Time', rfc1123(j.status.startTime)]] as [string, string][]) : []),
      ...(j.status?.completionTime ? ([['Completed At', rfc1123(j.status.completionTime)]] as [string, string][]) : []),
      ['Pods Statuses', `${count('Running') + count('Pending')} Active (${pods.filter(podReady).length} Ready) / ${count('Succeeded')} Succeeded / ${count('Failed')} Failed`],
    ],
    W,
  );
  s += podTemplateBlock(c, j.spec.template, j.metadata.namespace);
  s += eventsBlock(c, j);
  return s;
}

/** describe for every kind; unknown kinds fall back to a YAML-ish dump with events. */
export function describe(c: Cluster, o: Obj): string {
  switch (o.kind) {
    case 'ServiceAccount':
      return kv([['Name', o.metadata.name], ['Namespace', o.metadata.namespace], ['Labels', Object.entries(o.metadata.labels ?? {}).map(([k, v]) => `${k}=${v}`).join(',') || '<none>'], ['Annotations', Object.entries(o.metadata.annotations ?? {}).map(([k, v]) => `${k}: ${v}`).join(',') || '<none>'], ['Image pull secrets', (o.imagePullSecrets ?? []).map((s: Obj) => s.name).join(', ') || '<none>'], ['Mountable secrets', (o.secrets ?? []).map((s: Obj) => s.name).join(', ') || '<none>'], ['Tokens', '<none>'], ['Events', '<none>']], 20);
    case 'Role':
    case 'ClusterRole':
      return kv([['Name', o.metadata.name], ...(o.metadata.namespace ? [['Namespace', o.metadata.namespace] as [string, string]] : [])], 14) + 'PolicyRule:\n' + pad([['  Resources', 'Non-Resource URLs', 'Resource Names', 'Verbs'], ...(o.rules ?? []).map((r: Obj) => ['  ' + (r.resources ?? []).map((v: string) => (r.apiGroups ?? ['']).map((g: string) => v + (g ? '.' + g : '')).join(',')).join(','), '[' + (r.nonResourceURLs ?? []).join(' ') + ']', '[' + (r.resourceNames ?? []).join(' ') + ']', '[' + r.verbs.join(' ') + ']'])]);
    case 'RoleBinding':
    case 'ClusterRoleBinding':
      return kv([['Name', o.metadata.name], ...(o.metadata.namespace ? [['Namespace', o.metadata.namespace] as [string, string]] : [])], 14) + `Role:\n  Kind:  ${o.roleRef.kind}\n  Name:  ${o.roleRef.name}\nSubjects:\n` + pad([['  Kind', 'Name', 'Namespace'], ...(o.subjects ?? []).map((s: Obj) => ['  ' + s.kind, s.name, s.namespace ?? ''])]);
    case 'StatefulSet':
      return kv([['Name', o.metadata.name], ['Namespace', o.metadata.namespace], ['Service Name', o.spec.serviceName], ['Replicas', `${o.spec.replicas} desired | ${o.status?.replicas ?? 0} total`], ['Update Strategy', o.spec.updateStrategy.type], ['Pods Status', `${o.status?.readyReplicas ?? 0} Running / ${o.spec.replicas - (o.status?.readyReplicas ?? 0)} Waiting`]], 18) + podTemplateBlock(c, o.spec.template, o.metadata.namespace) + 'Volume Claims:\n' + (o.spec.volumeClaimTemplates ?? []).map((v: Obj) => `  Name: ${v.metadata.name}\n  StorageClass: ${v.spec.storageClassName ?? ''}\n  Capacity: ${v.spec.resources?.requests?.storage ?? ''}\n`).join('') + eventsBlock(c, o);
    case 'Pod':
      return describePod(c, o);
    case 'Deployment':
      return describeDeployment(c, o);
    case 'ReplicaSet':
      return describeReplicaSet(c, o);
    case 'Service':
      return describeService(c, o);
    case 'Node':
      return describeNode(c, o);
    case 'ConfigMap':
      return describeConfigMap(c, o);
    case 'Secret':
      return describeSecret(c, o);
    case 'Namespace':
      return describeNamespace(c, o);
    case 'Job':
      return describeJob(c, o);
    default: {
      let s = kv([['Name', o.metadata.name], ...(o.metadata.namespace ? ([['Namespace', o.metadata.namespace]] as [string, string][]) : [])], 14);
      s += labelsBlock('Labels', o.metadata.labels, 14);
      s += annotationsBlock(o.metadata.annotations, 14);
      const body: Obj = { ...o };
      delete body.metadata;
      delete body.apiVersion;
      delete body.kind;
      s += toYaml(body).replace(/^(\w)/gm, (m) => m.toUpperCase());
      s += eventsBlock(c, o);
      return s;
    }
  }
}

export { podStatusWord, nodeStatusWord };
