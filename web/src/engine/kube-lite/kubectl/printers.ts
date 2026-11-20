// What `kubectl get` prints: the table columns of each kind (default and
// -o wide), -o yaml/json/name, jsonpath and custom-columns. Columns and
// status words follow kubectl v1.37 (printers in pkg/printers/internalversion).

import YAML from 'yaml';
import type { Cluster } from '../cluster';
import { controllerOf, podReady } from '../controllers';
import { age, fmtLabels, isObj, pad, type Obj } from '../util';

const ago = (c: Cluster, ts: string | undefined) => (ts ? age(c.now - Date.parse(ts)) : '<unknown>');

/** The STATUS column of a pod, as kubectl computes it. */
export function podStatusWord(p: Obj): string {
  if (p.metadata.deletionTimestamp) return 'Terminating';
  let reason: string = p.status?.reason ?? p.status?.phase ?? 'Pending';
  const cs: Obj[] = p.status?.containerStatuses ?? [];
  if (!p.spec.nodeName && reason === 'Pending') return 'Pending';
  let running = false;
  for (let i = cs.length - 1; i >= 0; i--) {
    const s = cs[i];
    if (s.state?.waiting?.reason && s.state.waiting.reason !== '') reason = s.state.waiting.reason;
    else if (s.state?.terminated?.reason) reason = s.state.terminated.reason;
    else if (s.state?.terminated) reason = s.state.terminated.exitCode ? `ExitCode:${s.state.terminated.exitCode}` : 'Completed';
    else if (s.ready && s.state?.running) running = true;
  }
  if (reason === 'Completed' && running) reason = 'Running';
  if (!cs.length && p.spec.nodeName && reason === 'Pending') reason = 'ContainerCreating';
  return reason;
}

function restarts(c: Cluster, p: Obj): string {
  const cs: Obj[] = p.status?.containerStatuses ?? [];
  const n = cs.reduce((s, x) => s + (x.restartCount ?? 0), 0);
  const last = cs.map((x) => x.lastState?.terminated?.finishedAt).filter(Boolean).sort().pop();
  return n && last ? `${n} (${age(c.now - Date.parse(last))} ago)` : String(n);
}

function svcPorts(s: Obj): string {
  const ps: Obj[] = s.spec.ports ?? [];
  if (!ps.length) return '<none>';
  return ps.map((p) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol ?? 'TCP'}`).join(',');
}

function external(s: Obj): string {
  if (s.spec.type === 'LoadBalancer') {
    const ing: Obj[] = s.status?.loadBalancer?.ingress ?? [];
    return ing.length ? ing.map((i) => i.ip ?? i.hostname).join(',') : '<pending>';
  }
  if (s.spec.externalIPs?.length) return s.spec.externalIPs.join(',');
  return '<none>';
}

const MODES: Record<string, string> = { ReadWriteOnce: 'RWO', ReadOnlyMany: 'ROX', ReadWriteMany: 'RWX', ReadWriteOncePod: 'RWOP' };
const accessModes = (m: string[] | undefined) => (m ?? []).map((x) => MODES[x] ?? x).join(',');
const condOf = (o: Obj, type: string) => (o.status?.conditions ?? []).find((x: Obj) => x.type === type);
const condStatus = (o: Obj, type: string) => condOf(o, type)?.status ?? '';
const condMessage = (o: Obj, type: string) => condOf(o, type)?.message ?? '';

function selectorStr(sel: Obj | undefined): string {
  if (!sel) return '<none>';
  const ml = Object.entries(sel.matchLabels ?? sel).filter(([, v]) => typeof v === 'string');
  return ml.length ? ml.map(([k, v]) => `${k}=${v}`).join(',') : '<none>';
}

function nodeRoles(n: Obj): string {
  const roles = Object.keys(n.metadata.labels ?? {})
    .filter((k) => k.startsWith('node-role.kubernetes.io/'))
    .map((k) => k.slice('node-role.kubernetes.io/'.length))
    .sort();
  return roles.length ? roles.join(',') : '<none>';
}

export function nodeStatusWord(n: Obj): string {
  const r = (n.status?.conditions ?? []).find((x: Obj) => x.type === 'Ready');
  let s = r?.status === 'True' ? 'Ready' : r?.status === 'Unknown' ? 'NotReady' : 'NotReady';
  if (n.spec?.unschedulable) s += ',SchedulingDisabled';
  return s;
}

function images(spec: Obj | undefined): [string, string] {
  const cs: Obj[] = spec?.containers ?? [];
  return [cs.map((x) => x.name).join(','), cs.map((x) => x.image).join(',')];
}

function jobStatus(j: Obj): string {
  const conds: Obj[] = j.status?.conditions ?? [];
  if (conds.some((x) => x.type === 'Complete' && x.status === 'True')) return 'Complete';
  if (conds.some((x) => x.type === 'Failed' && x.status === 'True')) return 'Failed';
  if (conds.some((x) => x.type === 'FailureTarget' && x.status === 'True')) return 'FailureTarget';
  return 'Running';
}

function duration(c: Cluster, j: Obj): string {
  const s = Date.parse(j.status?.startTime ?? '');
  if (!s) return '';
  const e = Date.parse(j.status?.completionTime ?? '') || c.now;
  return age(e - s);
}

export interface Table {
  head: string[];
  rows: (o: Obj) => string[];
  wideHead?: string[];
  wide?: (o: Obj) => string[];
}

export function tableFor(c: Cluster, kind: string): Table {
  switch (kind) {
    case 'Pod':
      return {
        head: ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'],
        rows: (p) => {
          const cs: Obj[] = p.status?.containerStatuses ?? [];
          const total = (p.spec.containers ?? []).length;
          return [p.metadata.name, `${cs.filter((x) => x.ready).length}/${total}`, podStatusWord(p), restarts(c, p), ago(c, p.metadata.creationTimestamp)];
        },
        wideHead: ['IP', 'NODE', 'NOMINATED NODE', 'READINESS GATES'],
        wide: (p) => [p.status?.podIP ?? '<none>', p.spec.nodeName ?? '<none>', '<none>', '<none>'],
      };
    case 'StatefulSet':
      return { head: ['NAME', 'READY', 'AGE'], rows: s => [s.metadata.name, `${s.status?.readyReplicas ?? 0}/${s.spec.replicas}`, ago(c, s.metadata.creationTimestamp)], wideHead: ['CONTAINERS', 'IMAGES'], wide: s => images(s.spec.template.spec) };
    case 'Role':
    case 'ClusterRole':
      return { head: ['NAME', 'CREATED AT'], rows: r => [r.metadata.name, r.metadata.creationTimestamp ?? ''] };
    case 'RoleBinding':
    case 'ClusterRoleBinding':
      return { head: ['NAME', 'ROLE', 'AGE'], rows: b => [b.metadata.name, `${b.roleRef.kind}/${b.roleRef.name}`, ago(c, b.metadata.creationTimestamp)] };
    case 'Deployment':
      return {
        head: ['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE'],
        rows: (d) => [d.metadata.name, `${d.status?.readyReplicas ?? 0}/${d.spec.replicas ?? 1}`, String(d.status?.updatedReplicas ?? 0), String(d.status?.availableReplicas ?? 0), ago(c, d.metadata.creationTimestamp)],
        wideHead: ['CONTAINERS', 'IMAGES', 'SELECTOR'],
        wide: (d) => [...images(d.spec.template?.spec), selectorStr(d.spec.selector)],
      };
    case 'ReplicaSet':
      return {
        head: ['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE'],
        rows: (r) => [r.metadata.name, String(r.spec.replicas ?? 0), String(r.status?.replicas ?? 0), String(r.status?.readyReplicas ?? 0), ago(c, r.metadata.creationTimestamp)],
        wideHead: ['CONTAINERS', 'IMAGES', 'SELECTOR'],
        wide: (r) => [...images(r.spec.template?.spec), selectorStr(r.spec.selector)],
      };
    case 'DaemonSet':
      return {
        head: ['NAME', 'DESIRED', 'CURRENT', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'NODE SELECTOR', 'AGE'],
        rows: (d) => [d.metadata.name, String(d.status?.desiredNumberScheduled ?? 0), String(d.status?.currentNumberScheduled ?? 0), String(d.status?.numberReady ?? 0), String(d.status?.updatedNumberScheduled ?? 0), String(d.status?.numberAvailable ?? 0), selectorStr(d.spec.template?.spec?.nodeSelector), ago(c, d.metadata.creationTimestamp)],
        wideHead: ['CONTAINERS', 'IMAGES', 'SELECTOR'],
        wide: (d) => [...images(d.spec.template?.spec), selectorStr(d.spec.selector)],
      };
    case 'Job':
      return {
        head: ['NAME', 'STATUS', 'COMPLETIONS', 'DURATION', 'AGE'],
        rows: (j) => [j.metadata.name, jobStatus(j), `${j.status?.succeeded ?? 0}/${j.spec.completions ?? 1}`, duration(c, j), ago(c, j.metadata.creationTimestamp)],
        wideHead: ['CONTAINERS', 'IMAGES', 'SELECTOR'],
        wide: (j) => [...images(j.spec.template?.spec), selectorStr(j.spec.selector)],
      };
    case 'Service':
      return {
        head: ['NAME', 'TYPE', 'CLUSTER-IP', 'EXTERNAL-IP', 'PORT(S)', 'AGE'],
        rows: (s) => [s.metadata.name, s.spec.type, s.spec.clusterIP ?? '<none>', external(s), svcPorts(s), ago(c, s.metadata.creationTimestamp)],
        wideHead: ['SELECTOR'],
        wide: (s) => [selectorStr(s.spec.selector)],
      };
    case 'EndpointSlice':
      return {
        head: ['NAME', 'ADDRESSTYPE', 'PORTS', 'ENDPOINTS', 'AGE'],
        rows: (e) => {
          const eps: string[] = (e.endpoints ?? []).flatMap((x: Obj) => x.addresses);
          const ports = (e.ports ?? []).map((p: Obj) => p.port ?? '<unset>');
          return [e.metadata.name, e.addressType, ports.length ? ports.join(',') : '<unset>', eps.length ? eps.slice(0, 3).join(',') + (eps.length > 3 ? ` + ${eps.length - 3} more...` : '') : '<unset>', ago(c, e.metadata.creationTimestamp)];
        },
      };
    case 'Endpoints':
      return {
        head: ['NAME', 'ENDPOINTS', 'AGE'],
        rows: (e) => {
          const eps: string[] = (e.subsets ?? []).flatMap((s: Obj) => (s.addresses ?? []).flatMap((a: Obj) => (s.ports ?? []).map((p: Obj) => `${a.ip}:${p.port}`)));
          return [e.metadata.name, eps.length ? eps.slice(0, 3).join(',') + (eps.length > 3 ? ` + ${eps.length - 3} more...` : '') : '<none>', ago(c, e.metadata.creationTimestamp)];
        },
      };
    case 'Node':
      return {
        head: ['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION'],
        rows: (n) => [n.metadata.name, nodeStatusWord(n), nodeRoles(n), ago(c, n.metadata.creationTimestamp), n.status?.nodeInfo?.kubeletVersion ?? ''],
        wideHead: ['INTERNAL-IP', 'EXTERNAL-IP', 'OS-IMAGE', 'KERNEL-VERSION', 'CONTAINER-RUNTIME'],
        wide: (n) => [(n.status?.addresses ?? []).find((a: Obj) => a.type === 'InternalIP')?.address ?? '<none>', '<none>', n.status?.nodeInfo?.osImage ?? '', n.status?.nodeInfo?.kernelVersion ?? '', n.status?.nodeInfo?.containerRuntimeVersion ?? ''],
      };
    case 'Namespace':
      return { head: ['NAME', 'STATUS', 'AGE'], rows: (n) => [n.metadata.name, n.status?.phase ?? 'Active', ago(c, n.metadata.creationTimestamp)] };
    case 'ConfigMap':
      return { head: ['NAME', 'DATA', 'AGE'], rows: (m) => [m.metadata.name, String(Object.keys(m.data ?? {}).length + Object.keys(m.binaryData ?? {}).length), ago(c, m.metadata.creationTimestamp)] };
    case 'Secret':
      return { head: ['NAME', 'TYPE', 'DATA', 'AGE'], rows: (s) => [s.metadata.name, s.type ?? 'Opaque', String(Object.keys(s.data ?? {}).length), ago(c, s.metadata.creationTimestamp)] };
    case 'ServiceAccount':
      return { head: ['NAME', 'SECRETS', 'AGE'], rows: (s) => [s.metadata.name, String((s.secrets ?? []).length), ago(c, s.metadata.creationTimestamp)] };
    case 'Event':
      return {
        head: ['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'],
        rows: (e) => [ago(c, e.lastTimestamp), e.type, e.reason, `${e.involvedObject.kind.toLowerCase()}/${e.involvedObject.name}`, e.message],
      };
    case 'Ingress':
      return {
        head: ['NAME', 'CLASS', 'HOSTS', 'ADDRESS', 'PORTS', 'AGE'],
        rows: (i) => [i.metadata.name, i.spec?.ingressClassName ?? '<none>', (i.spec?.rules ?? []).map((r: Obj) => r.host ?? '*').join(',') || '*', (i.status?.loadBalancer?.ingress ?? []).map((x: Obj) => x.ip).join(','), i.spec?.tls?.length ? '80, 443' : '80', ago(c, i.metadata.creationTimestamp)],
      };
    case 'NetworkPolicy':
      return { head: ['NAME', 'POD-SELECTOR', 'AGE'], rows: (n) => [n.metadata.name, selectorStr(n.spec?.podSelector) === '<none>' ? '<none>' : selectorStr(n.spec?.podSelector), ago(c, n.metadata.creationTimestamp)] };
    case 'Lease':
      return { head: ['NAME', 'HOLDER', 'AGE'], rows: (l) => [l.metadata.name, l.spec?.holderIdentity ?? '', ago(c, l.metadata.creationTimestamp)] };
    case 'CustomResourceDefinition':
      return { head: ['NAME', 'CREATED AT'], rows: (d) => [d.metadata.name, d.metadata.creationTimestamp] };
    case 'PersistentVolumeClaim':
      return {
        head: ['NAME', 'STATUS', 'VOLUME', 'CAPACITY', 'ACCESS MODES', 'STORAGECLASS', 'VOLUMEATTRIBUTESCLASS', 'AGE'],
        rows: (v) => [v.metadata.name, v.status?.phase ?? 'Pending', v.spec?.volumeName ?? '', v.status?.capacity?.storage ?? '', accessModes(v.status?.accessModes ?? (v.status?.phase === 'Bound' ? v.spec?.accessModes : [])), v.spec?.storageClassName ?? '<unset>', '<unset>', ago(c, v.metadata.creationTimestamp)],
        wideHead: ['VOLUMEMODE'],
        wide: (v) => [v.spec?.volumeMode ?? 'Filesystem'],
      };
    case 'PersistentVolume':
      return {
        head: ['NAME', 'CAPACITY', 'ACCESS MODES', 'RECLAIM POLICY', 'STATUS', 'CLAIM', 'STORAGECLASS', 'VOLUMEATTRIBUTESCLASS', 'REASON', 'AGE'],
        rows: (v) => [v.metadata.name, v.spec?.capacity?.storage ?? '', accessModes(v.spec?.accessModes), v.spec?.persistentVolumeReclaimPolicy ?? 'Retain', v.status?.phase ?? 'Available', v.spec?.claimRef ? `${v.spec.claimRef.namespace}/${v.spec.claimRef.name}` : '', v.spec?.storageClassName ?? '', '<unset>', '', ago(c, v.metadata.creationTimestamp)],
      };
    case 'StorageClass':
      return {
        head: ['NAME', 'PROVISIONER', 'RECLAIMPOLICY', 'VOLUMEBINDINGMODE', 'ALLOWVOLUMEEXPANSION', 'AGE'],
        rows: (v) => [`${v.metadata.name}${v.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' ? ' (default)' : ''}`, v.provisioner, v.reclaimPolicy ?? 'Delete', v.volumeBindingMode ?? 'Immediate', String(!!v.allowVolumeExpansion), ago(c, v.metadata.creationTimestamp)],
      };
    case 'IngressClass':
      return { head: ['NAME', 'CONTROLLER', 'PARAMETERS', 'AGE'], rows: (v) => [v.metadata.name, v.spec?.controller ?? '', '<none>', ago(c, v.metadata.creationTimestamp)] };
    case 'HorizontalPodAutoscaler':
      return {
        head: ['NAME', 'REFERENCE', 'TARGETS', 'MINPODS', 'MAXPODS', 'REPLICAS', 'AGE'],
        rows: (v) => {
          const m = (v.spec?.metrics ?? []).find((x: Obj) => x.type === 'Resource');
          const want = m?.resource?.target?.averageUtilization;
          const cur = (v.status?.currentMetrics ?? []).find((x: Obj) => x.type === 'Resource')?.resource?.current?.averageUtilization;
          const targets = m ? `${m.resource.name}: ${cur === undefined ? '<unknown>' : `${cur}%`}/${want}%` : '<none>';
          return [v.metadata.name, `${v.spec?.scaleTargetRef?.kind}/${v.spec?.scaleTargetRef?.name}`, targets, String(v.spec?.minReplicas ?? 1), String(v.spec?.maxReplicas ?? ''), String(v.status?.currentReplicas ?? 0), ago(c, v.metadata.creationTimestamp)];
        },
      };
    case 'Certificate':
      return { head: ['NAME', 'READY', 'SECRET', 'AGE'], rows: (v) => [v.metadata.name, condStatus(v, 'Ready'), v.spec?.secretName ?? '', ago(c, v.metadata.creationTimestamp)] };
    case 'CertificateRequest':
      return { head: ['NAME', 'APPROVED', 'DENIED', 'READY', 'ISSUER', 'REQUESTER', 'AGE'], rows: (v) => [v.metadata.name, condStatus(v, 'Approved'), condStatus(v, 'Denied'), condStatus(v, 'Ready'), v.spec?.issuerRef?.name ?? '', v.spec?.username ?? '', ago(c, v.metadata.creationTimestamp)] };
    case 'ClusterIssuer':
      return { head: ['NAME', 'READY', 'AGE'], rows: (v) => [v.metadata.name, condStatus(v, 'Ready'), ago(c, v.metadata.creationTimestamp)] };
    case 'GitRepository':
      return { head: ['NAME', 'URL', 'AGE', 'READY', 'STATUS'], rows: (v) => [v.metadata.name, v.spec?.url ?? '', ago(c, v.metadata.creationTimestamp), condStatus(v, 'Ready'), condMessage(v, 'Ready')] };
    case 'Kustomization':
      return { head: ['NAME', 'AGE', 'READY', 'STATUS'], rows: (v) => [v.metadata.name, ago(c, v.metadata.creationTimestamp), condStatus(v, 'Ready'), condMessage(v, 'Ready')] };
    case 'GatewayClass':
      return { head: ['NAME', 'CONTROLLER', 'ACCEPTED', 'AGE'], rows: (v) => [v.metadata.name, v.spec?.controllerName ?? '', condStatus(v, 'Accepted') || 'Unknown', ago(c, v.metadata.creationTimestamp)] };
    case 'Gateway':
      return { head: ['NAME', 'CLASS', 'ADDRESS', 'PROGRAMMED', 'AGE'], rows: (v) => [v.metadata.name, v.spec?.gatewayClassName ?? '', (v.status?.addresses ?? []).map((a: Obj) => a.value).join(','), condStatus(v, 'Programmed') || 'Unknown', ago(c, v.metadata.creationTimestamp)] };
    case 'HTTPRoute':
      return { head: ['NAME', 'HOSTNAMES', 'AGE'], rows: (v) => [v.metadata.name, JSON.stringify(v.spec?.hostnames ?? []), ago(c, v.metadata.creationTimestamp)] };
    case 'Application':
      // Argo CD's printer columns; REVISION and PROJECT have priority 10 and show with -o wide.
      return {
        head: ['NAME', 'SYNC STATUS', 'HEALTH STATUS'],
        rows: (v) => [v.metadata.name, v.status?.sync?.status ?? '', v.status?.health?.status ?? ''],
        wideHead: ['REVISION', 'PROJECT'],
        wide: (v) => [v.status?.sync?.revision ?? '', v.spec?.project ?? ''],
      };
    case 'IPAddressPool':
      return { head: ['NAME', 'AUTO ASSIGN', 'AVOID BUGGY IPS', 'ADDRESSES'], rows: (v) => [v.metadata.name, String(v.spec?.autoAssign ?? true), String(!!v.spec?.avoidBuggyIPs), JSON.stringify(v.spec?.addresses ?? [])] };
    default:
      return { head: ['NAME', 'AGE'], rows: (o) => [o.metadata.name, ago(c, o.metadata.creationTimestamp)] };
  }
}

export interface PrintOpts {
  wide?: boolean;
  allNamespaces?: boolean;
  showLabels?: boolean;
  noHeaders?: boolean;
  /** Prefix names with kind/ (several kinds in one get). */
  withKind?: string;
  labelColumns?: string[];
}

export function printTable(c: Cluster, kind: string, objs: Obj[], o: PrintOpts): string {
  const t = tableFor(c, kind);
  const head = [...(o.allNamespaces && kind !== 'Node' && kind !== 'Namespace' ? ['NAMESPACE'] : []), ...t.head, ...(o.wide && t.wideHead ? t.wideHead : []), ...(o.labelColumns ?? []).map((l) => l.toUpperCase()), ...(o.showLabels ? ['LABELS'] : [])];
  const rows = objs.map((obj) => {
    const r = t.rows(obj);
    if (o.withKind) r[0] = `${o.withKind}/${r[0]}`;
    return [
      ...(o.allNamespaces && kind !== 'Node' && kind !== 'Namespace' ? [obj.metadata.namespace ?? ''] : []),
      ...r,
      ...(o.wide && t.wide ? t.wide(obj) : []),
      ...(o.labelColumns ?? []).map((l) => obj.metadata.labels?.[l] ?? ''),
      ...(o.showLabels ? [fmtLabels(obj.metadata.labels)] : []),
    ];
  });
  if (kind === 'Event' && !o.allNamespaces) {
    // kubectl get events sorts by time.
  }
  return pad(o.noHeaders ? rows : [head, ...rows]);
}

/** The object as kubectl prints it: no managedFields, keys sorted. */
export function forOutput(o: Obj): Obj {
  const out: Obj = JSON.parse(JSON.stringify(o));
  return sortKeys(out) as Obj;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

export function toYaml(o: unknown): string {
  return YAML.stringify(o, { lineWidth: 0, indentSeq: false, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN', aliasDuplicateObjects: false });
}

export function listOf(items: Obj[]): Obj {
  return { apiVersion: 'v1', items: items.map(forOutput), kind: 'List', metadata: { resourceVersion: '' } };
}

// ── jsonpath (the subset kubectl users write) ──

function evalPath(root: unknown, expr: string): unknown[] {
  let cur: unknown[] = [root];
  const e = expr.trim().replace(/^\$/, '');
  const re = /\.?([A-Za-z_$][\w$-]*|\*)|\[(\*|-?\d+|'[^']*'|"[^"]*"|\?\(@\.([\w.]+)\s*==\s*["']([^"']*)["']\))\]/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(e))) {
    if (m.index !== last) break;
    last = re.lastIndex;
    const next: unknown[] = [];
    for (const v of cur) {
      if (m[1] !== undefined) {
        if (m[1] === '*') {
          if (Array.isArray(v)) next.push(...v);
          else if (isObj(v)) next.push(...Object.values(v));
        } else if (isObj(v) && m[1] in v) next.push(v[m[1]]);
      } else if (m[2] !== undefined) {
        const sel = m[2];
        if (sel === '*') {
          if (Array.isArray(v)) next.push(...v);
          else if (isObj(v)) next.push(...Object.values(v));
        } else if (/^-?\d+$/.test(sel)) {
          if (Array.isArray(v)) {
            const i = Number(sel);
            const x = v[i < 0 ? v.length + i : i];
            if (x !== undefined) next.push(x);
          }
        } else if (m[3] !== undefined) {
          if (Array.isArray(v)) for (const x of v) if (String(getDotted(x, m[3])) === m[4]) next.push(x);
        } else {
          const k = sel.slice(1, -1);
          if (isObj(v) && k in v) next.push(v[k]);
        }
      }
    }
    cur = next;
  }
  return cur;
}

function getDotted(o: unknown, path: string): unknown {
  let cur = o;
  for (const p of path.split('.')) cur = isObj(cur) ? cur[p] : undefined;
  return cur;
}

const show = (v: unknown) => (typeof v === 'string' ? v : v === undefined ? '' : isObj(v) || Array.isArray(v) ? JSON.stringify(v) : String(v));

/** Render a kubectl jsonpath template: {.a.b} {range .items[*]}…{end} {"\n"}. */
export function jsonpath(root: unknown, template: string): string {
  let out = '';
  const tokens = template.match(/\{[^{}]*\}|[^{}]+/g) ?? [];
  const run = (toks: string[], ctx: unknown): string => {
    let s = '';
    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      if (!tk.startsWith('{')) {
        s += tk;
        continue;
      }
      const inner = tk.slice(1, -1).trim();
      if (inner.startsWith('range ')) {
        let depth = 1;
        let j = i + 1;
        for (; j < toks.length; j++) {
          const t2 = toks[j].slice(1, -1).trim();
          if (toks[j].startsWith('{') && t2.startsWith('range ')) depth++;
          if (toks[j].startsWith('{') && t2 === 'end') depth--;
          if (depth === 0) break;
        }
        const body = toks.slice(i + 1, j);
        for (const item of evalPath(ctx, inner.slice(6))) s += run(body, item);
        i = j;
        continue;
      }
      if (/^".*"$/.test(inner) || /^'.*'$/.test(inner)) {
        s += inner.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        continue;
      }
      const vals = evalPath(ctx, inner.startsWith('.') || inner.startsWith('$') || inner.startsWith('[') ? inner : `.${inner}`);
      s += vals.map(show).join(' ');
    }
    return s;
  };
  out = run(tokens, root);
  return out;
}

export function customColumns(objs: Obj[], spec: string, noHeaders: boolean): string {
  const cols = spec.split(',').map((x) => {
    const i = x.indexOf(':');
    return { name: x.slice(0, i), path: x.slice(i + 1) };
  });
  const rows = objs.map((o) => cols.map((c) => {
    const v = evalPath(o, c.path.startsWith('.') ? c.path : `.${c.path}`);
    return v.length ? v.map(show).join(',') : '<none>';
  }));
  return pad(noHeaders ? rows : [cols.map((c) => c.name), ...rows]);
}

export function sortBy(objs: Obj[], path: string): Obj[] {
  const key = (o: Obj) => evalPath(o, path.replace(/^\{|\}$/g, '').startsWith('.') ? path.replace(/^\{|\}$/g, '') : `.${path}`)[0];
  return [...objs].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x ?? '').localeCompare(String(y ?? ''));
  });
}

export { controllerOf, podReady };
