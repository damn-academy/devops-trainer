// Mutating admission (defaults) and validation of kube-lite's API server.
// Defaults are what makes `kubectl get -o yaml` look as on a real cluster;
// validation messages follow the real format ("The Deployment "web" is
// invalid: spec.selector: Required value"), because a learner who reads
// them here should recognise them on the real stage.

import type { Cluster } from './cluster';
import { ApiError } from './cluster';
import { imageRef } from './images';
import type { KindInfo } from './kinds';
import { bytes, cpuMilli, deepEqual, goMap, isObj, iso, validQuantity, type Obj } from './util';

/** Does a label selector (matchLabels + matchExpressions) select these labels? */
export function selects(sel: Obj | undefined, labels: Obj | undefined): boolean {
  if (!sel) return false;
  const l = labels ?? {};
  for (const [k, v] of Object.entries(sel.matchLabels ?? {})) if (l[k] !== v) return false;
  for (const e of sel.matchExpressions ?? []) {
    const has = e.key in l;
    const val = l[e.key];
    if (e.operator === 'In' && !(has && e.values?.includes(val))) return false;
    if (e.operator === 'NotIn' && has && e.values?.includes(val)) return false;
    if (e.operator === 'Exists' && !has) return false;
    if (e.operator === 'DoesNotExist' && has) return false;
  }
  return Object.keys(sel.matchLabels ?? {}).length > 0 || (sel.matchExpressions ?? []).length > 0;
}

/** Service-style selector: a plain map. */
export function selectsMap(sel: Obj | undefined, labels: Obj | undefined): boolean {
  if (!sel || !Object.keys(sel).length) return false;
  return Object.entries(sel).every(([k, v]) => labels?.[k] === v);
}

const invalid = (kind: string, name: string, ...errs: string[]): never => {
  const body = errs.length === 1 ? errs[0] : `[${errs.join(', ')}]`;
  throw new ApiError(422, 'Invalid', `The ${kind} "${name}" is invalid: ${body}`, true);
};

function defaultContainer(c: Obj): Obj {
  const ref = imageRef(String(c.image ?? ''));
  const latest = ref.endsWith(':latest') && !String(c.image ?? '').includes('@');
  return {
    ...c,
    imagePullPolicy: c.imagePullPolicy ?? (latest ? 'Always' : 'IfNotPresent'),
    resources: c.resources ?? {},
    terminationMessagePath: c.terminationMessagePath ?? '/dev/termination-log',
    terminationMessagePolicy: c.terminationMessagePolicy ?? 'File',
    ...(c.ports ? { ports: c.ports.map((p: Obj) => ({ ...p, protocol: p.protocol ?? 'TCP' })) } : {}),
    ...(c.readinessProbe ? { readinessProbe: defaultProbe(c.readinessProbe) } : {}),
    ...(c.livenessProbe ? { livenessProbe: defaultProbe(c.livenessProbe) } : {}),
    ...(c.startupProbe ? { startupProbe: defaultProbe(c.startupProbe) } : {}),
  };
}

function defaultProbe(p: Obj): Obj {
  return {
    ...p,
    ...(p.httpGet ? { httpGet: { path: '/', scheme: 'HTTP', ...p.httpGet } } : {}),
    failureThreshold: p.failureThreshold ?? 3,
    periodSeconds: p.periodSeconds ?? 10,
    successThreshold: p.successThreshold ?? 1,
    timeoutSeconds: p.timeoutSeconds ?? 1,
  };
}

export function defaultPodSpec(spec: Obj, forTemplate: boolean): Obj {
  const s: Obj = {
    ...spec,
    containers: (spec.containers ?? []).map(defaultContainer),
    dnsPolicy: spec.dnsPolicy ?? 'ClusterFirst',
    restartPolicy: spec.restartPolicy ?? 'Always',
    schedulerName: spec.schedulerName ?? 'default-scheduler',
    securityContext: spec.securityContext ?? {},
    terminationGracePeriodSeconds: spec.terminationGracePeriodSeconds ?? 30,
  };
  if (spec.initContainers) s.initContainers = spec.initContainers.map(defaultContainer);
  if (!forTemplate) {
    s.enableServiceLinks = spec.enableServiceLinks ?? true;
    s.preemptionPolicy = spec.preemptionPolicy ?? 'PreemptLowerPriority';
    s.priority = spec.priority ?? (spec.priorityClassName === 'system-cluster-critical' ? 2000000000 : spec.priorityClassName === 'system-node-critical' ? 2000001000 : 0);
    s.serviceAccount = spec.serviceAccountName ?? spec.serviceAccount ?? 'default';
    s.serviceAccountName = s.serviceAccount;
    const tol: Obj[] = [...(spec.tolerations ?? [])];
    // DefaultTolerationSeconds admission: 300 s on not-ready and unreachable.
    for (const k of ['node.kubernetes.io/not-ready', 'node.kubernetes.io/unreachable']) {
      if (!tol.some((t) => t.key === k && (t.effect === 'NoExecute' || !t.effect))) tol.push({ effect: 'NoExecute', key: k, operator: 'Exists', tolerationSeconds: 300 });
    }
    s.tolerations = tol;
    // The service account token volume (projected), as the ServiceAccount admission adds it.
    if (spec.automountServiceAccountToken !== false && !(spec.volumes ?? []).some((v: Obj) => String(v.name).startsWith('kube-api-access-'))) {
      const vol = `kube-api-access-${shortHash(JSON.stringify(spec.containers ?? []))}`;
      s.volumes = [
        ...(spec.volumes ?? []),
        {
          name: vol,
          projected: {
            defaultMode: 420,
            sources: [
              { serviceAccountToken: { expirationSeconds: 3607, path: 'token' } },
              { configMap: { items: [{ key: 'ca.crt', path: 'ca.crt' }], name: 'kube-root-ca.crt' } },
              { downwardAPI: { items: [{ fieldRef: { apiVersion: 'v1', fieldPath: 'metadata.namespace' }, path: 'namespace' }] } },
            ],
          },
        },
      ];
      s.containers = s.containers.map((c: Obj) => ({ ...c, volumeMounts: [...(c.volumeMounts ?? []), { mountPath: '/var/run/secrets/kubernetes.io/serviceaccount', name: vol, readOnly: true }] }));
    }
  }
  return s;
}

function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  const A = 'bcdfghjklmnpqrstvwxz2456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += A[h % A.length];
    h = Math.floor(h / A.length) + 7919 * (i + 1);
  }
  return out;
}

export function qosClass(spec: Obj): 'Guaranteed' | 'Burstable' | 'BestEffort' {
  const cs: Obj[] = spec.containers ?? [];
  const any = cs.some((c) => Object.keys(c.resources?.requests ?? {}).length || Object.keys(c.resources?.limits ?? {}).length);
  if (!any) return 'BestEffort';
  const guaranteed = cs.every((c) => {
    const l = c.resources?.limits ?? {};
    const r = c.resources?.requests ?? l;
    return l.cpu && l.memory && cpuMilli(r.cpu) === cpuMilli(l.cpu) && bytes(r.memory) === bytes(l.memory);
  });
  return guaranteed ? 'Guaranteed' : 'Burstable';
}

/** Mutating admission: fill in what the real API server fills in. */
export function applyDefaults(c: Cluster, obj: Obj, info: KindInfo, prev: Obj | undefined): Obj {
  const o = obj;
  o.metadata ??= {};
  switch (info.kind) {
    case 'Namespace':
      o.metadata.labels = { ...(o.metadata.labels ?? {}), 'kubernetes.io/metadata.name': o.metadata.name };
      o.spec = { finalizers: ['kubernetes'], ...(o.spec ?? {}) };
      o.status = o.status ?? prev?.status ?? { phase: 'Active' };
      break;
    case 'Pod': {
      // Limits without requests: requests default to limits.
      for (const ct of o.spec?.containers ?? []) {
        const lim = ct.resources?.limits;
        if (lim) ct.resources.requests = { ...lim, ...(ct.resources.requests ?? {}) };
      }
      const serviceAccount = c.get('ServiceAccount', o.metadata.namespace, o.spec?.serviceAccountName ?? o.spec?.serviceAccount ?? 'default');
      const podSpec = { ...(o.spec ?? {}) };
      if (podSpec.automountServiceAccountToken === undefined && serviceAccount?.automountServiceAccountToken === false) podSpec.automountServiceAccountToken = false;
      o.spec = defaultPodSpec(podSpec, false);
      o.status = prev?.status ?? o.status ?? { phase: 'Pending', qosClass: qosClass(o.spec) };
      o.status.qosClass ??= qosClass(o.spec);
      break;
    }
    case 'ReplicaSet':
    case 'StatefulSet':
    case 'Deployment':
    case 'DaemonSet':
    case 'Job': {
      const spec = (o.spec ??= {});
      if (info.kind !== 'DaemonSet' && info.kind !== 'Job') spec.replicas ??= 1;
      if (info.kind === 'Job') {
        spec.completions ??= 1;
        spec.parallelism ??= 1;
        spec.backoffLimit ??= 6;
        spec.completionMode ??= 'NonIndexed';
        spec.suspend ??= false;
        spec.manualSelector ??= false;
        spec.podReplacementPolicy ??= 'TerminatingOrFailed';
        if (!prev) {
          const uid = c.rand.uid();
          o.metadata.uid = uid;
          spec.selector ??= { matchLabels: { 'batch.kubernetes.io/controller-uid': uid } };
          spec.template ??= {};
          spec.template.metadata = { ...(spec.template.metadata ?? {}), labels: { ...(spec.template.metadata?.labels ?? {}), 'batch.kubernetes.io/controller-uid': uid, 'batch.kubernetes.io/job-name': o.metadata.name, 'controller-uid': uid, 'job-name': o.metadata.name } };
          o.metadata.labels = { 'batch.kubernetes.io/controller-uid': uid, 'batch.kubernetes.io/job-name': o.metadata.name, 'controller-uid': uid, 'job-name': o.metadata.name, ...(o.metadata.labels ?? {}) };
        } else {
          spec.selector ??= prev.spec.selector;
        }
      }
      if (info.kind === 'StatefulSet') {
        spec.podManagementPolicy ??= 'OrderedReady';
        spec.updateStrategy ??= {};
        spec.updateStrategy.type ??= 'RollingUpdate';
        if (spec.updateStrategy.type === 'RollingUpdate') spec.updateStrategy.rollingUpdate ??= { partition: 0 };
        spec.revisionHistoryLimit ??= 10;
      }
      if (info.kind === 'Deployment') {
        spec.revisionHistoryLimit ??= 10;
        spec.progressDeadlineSeconds ??= 600;
        spec.strategy ??= {};
        spec.strategy.type ??= 'RollingUpdate';
        if (spec.strategy.type === 'RollingUpdate') spec.strategy.rollingUpdate = { maxSurge: '25%', maxUnavailable: '25%', ...(spec.strategy.rollingUpdate ?? {}) };
        else delete spec.strategy.rollingUpdate;
      }
      if (info.kind === 'DaemonSet') {
        spec.revisionHistoryLimit ??= 10;
        spec.updateStrategy ??= { type: 'RollingUpdate', rollingUpdate: { maxSurge: 0, maxUnavailable: 1 } };
      }
      if (spec.template) {
        spec.template.metadata ??= {};
        spec.template.spec = defaultPodSpec(spec.template.spec ?? {}, true);
        if (info.kind === 'Job' && !spec.template.spec.restartPolicy) spec.template.spec.restartPolicy = 'Never';
        for (const ct of spec.template.spec.containers ?? []) {
          const lim = ct.resources?.limits;
          if (lim) ct.resources.requests = { ...lim, ...(ct.resources.requests ?? {}) };
        }
      }
      o.status = prev?.status ?? o.status ?? {};
      break;
    }
    case 'Service': {
      const spec = (o.spec ??= {});
      spec.type ??= 'ClusterIP';
      spec.sessionAffinity ??= 'None';
      spec.internalTrafficPolicy ??= 'Cluster';
      spec.ipFamilies ??= ['IPv4'];
      spec.ipFamilyPolicy ??= 'SingleStack';
      if (spec.clusterIP !== 'None') spec.clusterIP = prev?.spec?.clusterIP ?? spec.clusterIP ?? c.allocateClusterIP();
      spec.clusterIPs = [spec.clusterIP];
      spec.ports = (spec.ports ?? []).map((p: Obj) => {
        const out: Obj = { ...p, protocol: p.protocol ?? 'TCP', targetPort: p.targetPort ?? p.port };
        if (spec.type === 'NodePort' || spec.type === 'LoadBalancer') out.nodePort = p.nodePort ?? prev?.spec?.ports?.find((x: Obj) => x.port === p.port)?.nodePort ?? c.allocateNodePort();
        else delete out.nodePort;
        return out;
      });
      if (spec.type === 'NodePort' || spec.type === 'LoadBalancer') spec.externalTrafficPolicy ??= 'Cluster';
      else delete spec.externalTrafficPolicy;
      if (spec.type === 'LoadBalancer') {
        spec.allocateLoadBalancerNodePorts ??= true;
        // k3s ServiceLB: the node addresses become the external IPs. With
        // add-ons the address comes from a load-balancer provider (MetalLB) or never.
        if (c.addons) o.status = prev?.spec?.type === 'LoadBalancer' && prev.status ? prev.status : { loadBalancer: {} };
        else o.status = { loadBalancer: { ingress: c.nodes.filter((n) => n.power).map((n) => ({ ip: n.ip, ipMode: 'VIP' })) } };
      } else o.status = { loadBalancer: {} };
      break;
    }
    case 'Secret': {
      o.type ??= 'Opaque';
      if (o.stringData) {
        o.data = { ...(o.data ?? {}) };
        for (const [k, v] of Object.entries(o.stringData)) o.data[k] = b64(String(v));
        delete o.stringData;
      }
      break;
    }
    case 'Ingress':
      // Without add-ons: k3s Traefik behind ServiceLB publishes the node addresses.
      // With add-ons the ingress controller writes the address, if one runs.
      o.status = prev?.status ?? (c.addons ? { loadBalancer: {} } : { loadBalancer: { ingress: c.nodes.map((n) => ({ ip: n.ip })) } });
      break;
    case 'PersistentVolumeClaim': {
      const spec = (o.spec ??= {});
      spec.volumeMode ??= 'Filesystem';
      spec.accessModes ??= ['ReadWriteOnce'];
      o.status = prev?.status ?? { phase: 'Pending' };
      break;
    }
    case 'PersistentVolume':
      o.spec ??= {};
      o.spec.persistentVolumeReclaimPolicy ??= 'Retain';
      o.spec.volumeMode ??= 'Filesystem';
      o.status = prev?.status ?? { phase: 'Available' };
      break;
    case 'StorageClass':
      o.reclaimPolicy ??= 'Delete';
      o.volumeBindingMode ??= 'Immediate';
      break;
    case 'HorizontalPodAutoscaler':
      o.spec ??= {};
      o.spec.minReplicas ??= 1;
      o.status = prev?.status ?? { currentReplicas: 0, desiredReplicas: 0, currentMetrics: null };
      break;
    case 'CustomResourceDefinition':
      o.status = prev?.status ?? o.status ?? {};
      break;
  }
  return o;
}

export function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
}

export function unb64(s: string): string {
  try {
    const bin = atob(s);
    return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  } catch {
    return s;
  }
}

function validateContainers(kind: string, name: string, path: string, cs: Obj[] | undefined, errs: string[]): void {
  if (!cs || !cs.length) {
    errs.push(`${path}.containers: Required value`);
    return;
  }
  const names = new Set<string>();
  cs.forEach((ct, i) => {
    const p = `${path}.containers[${i}]`;
    if (!ct.name) errs.push(`${p}.name: Required value`);
    else if (names.has(ct.name)) errs.push(`${p}.name: Duplicate value: "${ct.name}"`);
    names.add(ct.name);
    if (!ct.image) errs.push(`${p}.image: Required value`);
    const ports = new Set<string>();
    for (const [j, pt] of (ct.ports ?? []).entries()) {
      if (typeof pt.containerPort !== 'number' || pt.containerPort < 1 || pt.containerPort > 65535) errs.push(`${p}.ports[${j}].containerPort: Invalid value: ${JSON.stringify(pt.containerPort)}: must be between 1 and 65535, inclusive`);
      const k = `${pt.containerPort}/${pt.protocol ?? 'TCP'}`;
      if (ports.has(k)) errs.push(`${p}.ports[${j}]: Duplicate value: "${k}"`);
      ports.add(k);
    }
    for (const kindQ of ['requests', 'limits'] as const) {
      const r = ct.resources?.[kindQ] ?? {};
      if (!validQuantity(r.cpu, 'cpu')) errs.push(`${p}.resources.${kindQ}[cpu]: Invalid value: "${r.cpu}": must match the regex ^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$`);
      if (!validQuantity(r.memory, 'memory')) errs.push(`${p}.resources.${kindQ}[memory]: Invalid value: "${r.memory}": must match the regex ^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$`);
    }
    const req = ct.resources?.requests ?? {};
    const lim = ct.resources?.limits ?? {};
    if (lim.memory && req.memory && bytes(req.memory) > bytes(lim.memory)) errs.push(`${p}.resources.requests: Invalid value: "${req.memory}": must be less than or equal to memory limit of ${lim.memory}`);
    if (lim.cpu && req.cpu && cpuMilli(req.cpu) > cpuMilli(lim.cpu)) errs.push(`${p}.resources.requests: Invalid value: "${req.cpu}": must be less than or equal to cpu limit of ${lim.cpu}`);
    for (const [j, e] of (ct.env ?? []).entries()) if (!e.name) errs.push(`${p}.env[${j}].name: Required value`);
  });
  void kind;
  void name;
}

/** Validation: throws ApiError(Invalid) with the real message format. */
export function validate(c: Cluster, o: Obj, info: KindInfo, prev: Obj | undefined): void {
  const name = o.metadata.name;
  const errs: string[] = [];
  for (const [k, v] of Object.entries(o.metadata.labels ?? {})) {
    if (typeof v !== 'string') errs.push(`metadata.labels: Invalid value: ${JSON.stringify(v)}: label values must be strings (quote numbers and booleans in YAML)`);
    else if (v.length > 63 || !/^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$/.test(v))
      errs.push(`metadata.labels: Invalid value: "${v}": a valid label must be an empty string or consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character (e.g. 'MyValue',  or 'my_value',  or '12345', regex used for validation is '(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?')`);
    if (!/^([a-z0-9.-]+\/)?[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/.test(k)) errs.push(`metadata.labels: Invalid value: "${k}": name part must consist of alphanumeric characters, '-', '_' or '.'`);
  }
  switch (info.kind) {
    case 'Pod': {
      validateContainers(info.kind, name, 'spec', o.spec?.containers, errs);
      if (!['Always', 'OnFailure', 'Never'].includes(o.spec?.restartPolicy)) errs.push(`spec.restartPolicy: Unsupported value: "${o.spec?.restartPolicy}": supported values: "Always", "OnFailure", "Never"`);
      if (prev) {
        const strip = (s: Obj) => ({ ...s, containers: (s.containers ?? []).map((x: Obj) => ({ ...x, image: '' })), activeDeadlineSeconds: undefined, tolerations: undefined, terminationGracePeriodSeconds: undefined, nodeName: undefined });
        if (!deepEqual(strip(prev.spec), strip(o.spec))) {
          errs.push(
            'spec: Forbidden: pod updates may not change fields other than `spec.containers[*].image`,`spec.initContainers[*].image`,`spec.activeDeadlineSeconds`,`spec.tolerations` (only additions to existing tolerations),`spec.terminationGracePeriodSeconds` (allow it to be set to 1 if it was previously negative)',
          );
        }
      }
      break;
    }
    case 'StatefulSet':
    case 'Deployment':
    case 'ReplicaSet':
    case 'DaemonSet': {
      const spec = o.spec ?? {};
      if (!spec.selector) errs.push('spec.selector: Required value');
      else if (!Object.keys(spec.selector.matchLabels ?? {}).length && !(spec.selector.matchExpressions ?? []).length)
        errs.push('spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string(nil), MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: empty selector is invalid for deployment');
      if (info.kind === 'StatefulSet') {
        if (!spec.serviceName) errs.push('spec.serviceName: Required value');
        for (const [i, claim] of (spec.volumeClaimTemplates ?? []).entries()) {
          if (!claim.metadata?.name) errs.push(`spec.volumeClaimTemplates[${i}].metadata.name: Required value`);
          if (!claim.spec?.accessModes?.length) errs.push(`spec.volumeClaimTemplates[${i}].spec.accessModes: Required value`);
          if (!claim.spec?.resources?.requests?.storage) errs.push(`spec.volumeClaimTemplates[${i}].spec.resources.requests.storage: Required value`);
        }
        if (!['OrderedReady', 'Parallel'].includes(spec.podManagementPolicy)) errs.push('spec.podManagementPolicy: Unsupported value');
        if (!['RollingUpdate', 'OnDelete'].includes(spec.updateStrategy?.type)) errs.push('spec.updateStrategy.type: Unsupported value');
        if (!Number.isInteger(spec.replicas) || spec.replicas < 0) errs.push('spec.replicas: Invalid value: must be a non-negative integer');
        if ((spec.updateStrategy?.rollingUpdate?.partition ?? 0) < 0) errs.push('spec.updateStrategy.rollingUpdate.partition: Invalid value');
        if (prev && ['serviceName', 'podManagementPolicy', 'volumeClaimTemplates'].some(k => !deepEqual(prev.spec[k], spec[k]))) errs.push('spec: Forbidden: updates to immutable StatefulSet fields');
      }
      const tl = spec.template?.metadata?.labels;
      if (spec.selector && !selects(spec.selector, tl)) errs.push(`spec.template.metadata.labels: Invalid value: ${goMap(tl)}: \`selector\` does not match template \`labels\``);
      validateContainers(info.kind, name, 'spec.template.spec', spec.template?.spec?.containers, errs);
      if (typeof spec.replicas === 'number' && spec.replicas < 0) errs.push(`spec.replicas: Invalid value: ${spec.replicas}: must be greater than or equal to 0`);
      if (info.kind === 'Deployment' && spec.strategy?.type === 'RollingUpdate') {
        const ru = spec.strategy.rollingUpdate ?? {};
        const zero = (v: unknown) => v === 0 || v === '0' || v === '0%';
        if (zero(ru.maxSurge) && zero(ru.maxUnavailable))
          errs.push('spec.strategy.rollingUpdate.maxUnavailable: Invalid value: intstr.IntOrString{Type:0, IntVal:0, StrVal:""}: may not be 0 when `maxSurge` is 0');
      }
      if (info.kind === 'Deployment' && !['RollingUpdate', 'Recreate'].includes(spec.strategy?.type)) errs.push(`spec.strategy.type: Unsupported value: "${spec.strategy?.type}": supported values: "Recreate", "RollingUpdate"`);
      if (spec.template?.spec?.restartPolicy && spec.template.spec.restartPolicy !== 'Always') errs.push(`spec.template.spec.restartPolicy: Unsupported value: "${spec.template.spec.restartPolicy}": supported values: "Always"`);
      if (prev && !deepEqual(prev.spec?.selector, spec.selector))
        errs.push(`spec.selector: Invalid value: v1.LabelSelector{MatchLabels:${goMap(spec.selector?.matchLabels)}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable`);
      break;
    }
    case 'Job': {
      const spec = o.spec ?? {};
      validateContainers(info.kind, name, 'spec.template.spec', spec.template?.spec?.containers, errs);
      const rp = spec.template?.spec?.restartPolicy;
      if (rp !== 'Never' && rp !== 'OnFailure') errs.push(`spec.template.spec.restartPolicy: Required value: valid values: "OnFailure", "Never"`);
      if (prev && !deepEqual(prev.spec?.template, spec.template)) errs.push('spec.template: Invalid value: core.PodTemplateSpec{...}: field is immutable');
      break;
    }
    case 'Service': {
      const spec = o.spec ?? {};
      if (!['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'].includes(spec.type)) errs.push(`spec.type: Unsupported value: "${spec.type}": supported values: "ClusterIP", "ExternalName", "LoadBalancer", "NodePort"`);
      if (!(spec.ports ?? []).length && spec.type !== 'ExternalName') errs.push('spec.ports: Required value');
      const names = new Set<string>();
      for (const [i, p] of (spec.ports ?? []).entries()) {
        if (typeof p.port !== 'number' || p.port < 1 || p.port > 65535) errs.push(`spec.ports[${i}].port: Invalid value: ${JSON.stringify(p.port)}: must be between 1 and 65535, inclusive`);
        if ((spec.ports ?? []).length > 1 && !p.name) errs.push(`spec.ports[${i}].name: Required value`);
        if (p.name) {
          if (names.has(p.name)) errs.push(`spec.ports[${i}].name: Duplicate value: "${p.name}"`);
          names.add(p.name);
        }
        if (p.nodePort !== undefined && (p.nodePort < 30000 || p.nodePort > 32767)) errs.push(`spec.ports[${i}].nodePort: Invalid value: ${p.nodePort}: provided port is not in the valid range. The range of valid ports is 30000-32767`);
      }
      if (!['None', 'ClientIP'].includes(spec.sessionAffinity)) errs.push(`spec.sessionAffinity: Unsupported value: "${spec.sessionAffinity}": supported values: "ClientIP", "None"`);
      if (prev && prev.spec.clusterIP && spec.clusterIP !== prev.spec.clusterIP) errs.push(`spec.clusterIPs[0]: Invalid value: []string{"${spec.clusterIP}"}: may not change once set`);
      break;
    }
    case 'PersistentVolumeClaim': {
      if (prev && prev.spec?.storageClassName !== undefined && prev.spec.storageClassName !== o.spec?.storageClassName) errs.push('spec.storageClassName: Forbidden: field is immutable');
      break;
    }
    case 'ConfigMap':
    case 'Secret': {
      if (prev?.immutable && (!deepEqual(prev.data, o.data) || !deepEqual(prev.binaryData, o.binaryData))) errs.push('data: Forbidden: field is immutable when `immutable` is set');
      for (const k of Object.keys(o.data ?? {})) if (!/^[-._a-zA-Z0-9]+$/.test(k)) errs.push(`data[${k}]: Invalid value: "${k}": a valid config key must consist of alphanumeric characters, '-', '_' or '.' (e.g. 'key.name',  or 'KEY_NAME',  or 'key-name', regex used for validation is '[-._a-zA-Z0-9]+')`);
      if (info.kind === 'Secret') for (const [k, v] of Object.entries(o.data ?? {})) if (typeof v !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(v)) errs.push(`data[${k}]: Invalid value: "<secret contents redacted>": illegal base64 data at input byte 0`);
      break;
    }
    case 'Role':
    case 'ClusterRole': {
      for (const [i, rule] of (o.rules ?? []).entries()) {
        if (!rule.verbs?.length) errs.push(`rules[${i}].verbs: Required value`);
        if (!rule.resources?.length && !rule.nonResourceURLs?.length) errs.push(`rules[${i}].resources: Required value`);
        if (rule.resources?.length && !rule.apiGroups?.length) errs.push(`rules[${i}].apiGroups: Required value`);
        if (info.kind === 'Role' && rule.nonResourceURLs?.length) errs.push(`rules[${i}].nonResourceURLs: Invalid value: namespaced rules cannot apply to non-resource URLs`);
      }
      break;
    }
    case 'RoleBinding':
    case 'ClusterRoleBinding': {
      if (o.roleRef?.apiGroup !== 'rbac.authorization.k8s.io') errs.push('roleRef.apiGroup: Unsupported value');
      if (!o.roleRef?.name) errs.push('roleRef.name: Required value');
      if (!(info.kind === 'ClusterRoleBinding' ? ['ClusterRole'] : ['Role', 'ClusterRole']).includes(o.roleRef?.kind)) errs.push('roleRef.kind: Unsupported value');
      if (prev && !deepEqual(prev.roleRef, o.roleRef)) errs.push('roleRef: Invalid value: cannot change roleRef');
      for (const [i, subject] of (o.subjects ?? []).entries()) {
        if (!subject.name) errs.push(`subjects[${i}].name: Required value`);
        if (!['User', 'Group', 'ServiceAccount'].includes(subject.kind)) errs.push(`subjects[${i}].kind: Unsupported value`);
        if (subject.kind === 'ServiceAccount' && !subject.namespace && info.kind === 'ClusterRoleBinding') errs.push(`subjects[${i}].namespace: Required value`);
      }
      break;
    }
    case 'Ingress': {
      for (const [i, r] of (o.spec?.rules ?? []).entries())
        for (const [j, p] of (r.http?.paths ?? []).entries()) {
          if (!p.pathType) errs.push(`spec.rules[${i}].http.paths[${j}].pathType: Required value: pathType must be specified`);
          if (!p.backend?.service?.name) errs.push(`spec.rules[${i}].http.paths[${j}].backend: Invalid value: "": resource or service backend is required`);
        }
      break;
    }
    case 'CustomResourceDefinition': {
      const s = o.spec ?? {};
      if (!s.group) errs.push('spec.group: Required value');
      if (!s.names?.kind) errs.push('spec.names.kind: Required value');
      if (!s.names?.plural) errs.push('spec.names.plural: Required value');
      if (s.names?.plural && s.group && name !== `${s.names.plural}.${s.group}`) errs.push(`metadata.name: Invalid value: "${name}": must be spec.names.plural+"."+spec.group`);
      if (!(s.versions ?? []).length) errs.push('spec.versions: Invalid value: null: must have exactly one version marked as storage version');
      break;
    }
  }
  if (info.custom) validateCustom(c, o, info, errs);
  if (errs.length) invalid(info.kind, name, ...errs);
}

/** A structural subset of openAPIV3Schema: types, required and enum. */
function validateCustom(c: Cluster, o: Obj, info: KindInfo, errs: string[]): void {
  const crd = c.get('CustomResourceDefinition', undefined, `${info.plural}.${info.group}`);
  const schema = (crd?.spec?.versions ?? []).find((v: Obj) => v.name === info.version)?.schema?.openAPIV3Schema;
  if (!schema) return;
  const walk = (s: Obj | undefined, v: unknown, path: string) => {
    if (!s || v === undefined) return;
    const t = s.type;
    const actual = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v;
    if (t && t !== actual && !(t === 'number' && actual === 'integer')) {
      errs.push(`${path}: Invalid value: "${actual}": ${path} in body must be of type ${t}: "${actual}"`);
      return;
    }
    if (s.enum && !s.enum.includes(v)) errs.push(`${path}: Unsupported value: ${JSON.stringify(v)}: supported values: ${s.enum.map((x: unknown) => JSON.stringify(x)).join(', ')}`);
    if (typeof s.minimum === 'number' && typeof v === 'number' && v < s.minimum) errs.push(`${path}: Invalid value: ${v}: ${path} in body should be greater than or equal to ${s.minimum}`);
    if (typeof s.maximum === 'number' && typeof v === 'number' && v > s.maximum) errs.push(`${path}: Invalid value: ${v}: ${path} in body should be less than or equal to ${s.maximum}`);
    if (isObj(v) && s.properties) {
      for (const r of s.required ?? []) if (!(r in v)) errs.push(`${path}.${r}: Required value`);
      for (const [k, sub] of Object.entries(s.properties)) walk(sub as Obj, (v as Obj)[k], `${path}.${k}`);
    }
  };
  walk(schema.properties?.spec, o.spec, 'spec');
}

export const now = iso;
