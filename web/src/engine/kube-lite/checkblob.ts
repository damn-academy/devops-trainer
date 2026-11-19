// The real stage (05 §11.5): trainer-check.sh runs read-only kubectl on the
// learner's own cluster and prints one base64 blob; the learner pastes it
// into the trainer, and the same Check predicates that judge the simulator
// judge it. This file decodes the blob into facts.

import type { Facts } from '../../core/types';
import { summarizeObjects, type K8sFacts } from './facts';
import type { Obj } from './util';

export interface CheckBlob {
  schema: 'dt.k8s-check/v1';
  nonce?: string;
  collectedAt?: string;
  client?: string;
  server?: string;
  context?: string;
  resources: Record<string, { items?: Obj[] } | null>;
  absent?: string[];
  extra?: Record<string, string>;
}

const KIND_OF: Record<string, string> = {
  nodes: 'Node',
  namespaces: 'Namespace',
  pods: 'Pod',
  deployments: 'Deployment',
  replicasets: 'ReplicaSet',
  daemonsets: 'DaemonSet',
  services: 'Service',
  endpointslices: 'EndpointSlice',
  ingresses: 'Ingress',
  gatewayclasses: 'GatewayClass',
  gateways: 'Gateway',
  httproutes: 'HTTPRoute',
  storageclasses: 'StorageClass',
  persistentvolumeclaims: 'PersistentVolumeClaim',
  configmaps: 'ConfigMap',
  networkpolicies: 'NetworkPolicy',
  jobs: 'Job',
  applications: 'Application',
};

async function gunzip(bytes: Uint8Array): Promise<string> {
  const DS = (globalThis as unknown as { DecompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (!DS) throw new Error('this browser cannot unpack gzip (DecompressionStream is missing)');
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DS('gzip'));
  return await new Response(stream).text();
}

/** base64 (of gzip or of plain JSON) → the blob. Whitespace and the BEGIN/END lines are ignored. */
export async function decodeBlob(text: string): Promise<CheckBlob> {
  const body = text
    .replace(/-----BEGIN TRAINER CHECK-----|-----END TRAINER CHECK-----/g, '')
    .replace(/\s+/g, '');
  if (!body) throw new Error('empty');
  let bin: string;
  try {
    bin = atob(body);
  } catch {
    throw new Error('this is not base64: copy the whole block between the BEGIN and END lines');
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const json = bytes[0] === 0x1f && bytes[1] === 0x8b ? await gunzip(bytes) : new TextDecoder().decode(bytes);
  const blob = JSON.parse(json) as CheckBlob;
  if (blob.schema !== 'dt.k8s-check/v1') throw new Error(`unknown schema "${String(blob.schema)}"`);
  return blob;
}

/** The facts of a real cluster in the dt.facts/v1 shape, scope k8s. */
export function blobFacts(blob: CheckBlob): Facts {
  const objects: Obj[] = [];
  for (const [res, list] of Object.entries(blob.resources ?? {})) {
    for (const item of list?.items ?? []) {
      const o = { ...item };
      o.kind ??= KIND_OF[res] ?? res;
      if (o.kind === 'Secret') continue;
      objects.push(o);
    }
  }
  const k8s: K8sFacts = {
    env: 'real',
    context: blob.context,
    objects,
    ...summarizeObjects(objects),
    proof: { nonce: blob.nonce, kernel: objects.find((o) => o.kind === 'Node')?.status?.nodeInfo?.kernelVersion, collectedAt: blob.collectedAt, client: blob.client },
    absent: blob.absent ?? [],
  };
  return {
    schema: 'dt.facts/v1',
    env: { kind: 'vm', machine: blob.context ?? 'real', kernel: k8s.proof?.kernel ?? '', at: blob.collectedAt ?? new Date().toISOString() },
    user: { name: 'learner', uid: 1000, gid: 1000 },
    cwd: '/',
    hostname: blob.context ?? 'real',
    vars: {},
    procs: [],
    files: Object.fromEntries(Object.entries(blob.extra ?? {}).map(([path, text]) => [path, { exists: true, type: 'f' as const, text }])),
    term: { main: [] },
    k8s,
  };
}

/** Signs that the blob was taken from a real cluster, not typed by hand or copied from the simulator. */
export function realityProblems(f: Facts, nonce: string): string[] {
  const k = f.k8s as K8sFacts;
  const out: string[] = [];
  if (!k.nodes.length) out.push('no nodes in the blob');
  if (k.nodes.some((n) => n.kernel.includes('dt-sim')) || k.objects.some((o) => o.kind === 'Node' && o.metadata?.annotations?.['trainer.dev/simulated'])) out.push('the nodes are the simulator’s');
  if (nonce && k.proof?.nonce !== nonce) out.push('the one-time code does not match the one shown on this page');
  const cm = k.objects.find((o) => o.kind === 'ConfigMap' && o.metadata?.name === 'trainer-proof');
  if (nonce && cm && cm.data?.nonce !== nonce) out.push('ConfigMap trainer-proof holds a different code');
  return out;
}
