// The DOM-free part of the cloud lab: API calls made by the page, the facts
// of the cloud, storage, git.lab and CI, and the memory budget. The widget
// and the headless tests share it.

import type { CloudLab } from '../../../engine/cloud/lab';
import type { HttpRequest } from '../../../engine/labhost/http';
import type { CiBridge } from './ci';
import { cloudScope, s3Scope, type ApiRequestRec, type CloudLabFacts, type GitScope } from './facts';

/** A call to the cloud API made by the page (a colleague in the console, the lesson's starting state). */
export interface ApiCall {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Under /v1; '{project}' becomes the project id: '/v1/projects/default/vms'. */
  path: string;
  body?: Record<string, unknown>;
}

/** Memory the cloud may give to VMs, MiB (the workstation is counted separately). */
export function vmBudgetMB(deviceMemoryGB: number | undefined): number {
  if (typeof deviceMemoryGB !== 'number') return 384;
  if (deviceMemoryGB >= 8) return 768;
  if (deviceMemoryGB >= 4) return 384;
  return 256;
}

/** Make an API call as the page (from the lab host's own address) and wait for its operation. */
export async function apiCall(cl: CloudLab, call: ApiCall): Promise<{ status: number; body: unknown }> {
  const pid = cl.cloud.state.projects[0]?.id ?? 'default';
  const target = call.path.replace('{project}', pid);
  const [path, qs] = target.split('?');
  const req: HttpRequest = {
    method: call.method,
    target,
    path,
    query: new URLSearchParams(qs ?? ''),
    version: 'HTTP/1.1',
    headers: { authorization: `Bearer ${cl.cloud.state.bootstrapSecret}`, 'content-type': 'application/json', host: 'api.cloud.lab' },
    body: call.body ? new TextEncoder().encode(JSON.stringify(call.body)) : new Uint8Array(),
    host: 'api.cloud.lab',
    remote: { ip: '10.0.0.1', port: 0 },
    local: { ip: '10.0.0.1', port: 80 },
    vlan: 1,
  };
  const r = await cl.cloud.handleHttp(req);
  const text = typeof r.body === 'string' ? r.body : new TextDecoder().decode(r.body ?? new Uint8Array());
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* plain text */
  }
  const op = body as { id?: string; status?: string };
  if (r.status === 202 && op?.id?.startsWith('op-')) {
    for (let i = 0; i < 600; i++) {
      const o = cl.cloud.state.operations.find((x) => x.id === op.id);
      if (!o || o.status === 'DONE' || o.status === 'ERROR') break;
      await new Promise((res) => setTimeout(res, 250));
    }
  }
  return { status: r.status, body };
}

export function withPubKey(c: ApiCall, pub: string): ApiCall {
  if (!c.body || !pub) return c;
  return { ...c, body: JSON.parse(JSON.stringify(c.body).split('{ws_pubkey}').join(pub.replace(/["\\]/g, ''))) as Record<string, unknown> };
}

export function gitScope(cl: CloudLab): GitScope {
  const st = cl.git.store;
  return {
    repos: st.list().map((r) => {
      const head = r.refs[r.head] ?? '';
      return {
        name: r.name,
        branches: Object.keys(r.refs).filter((k) => k.startsWith('refs/heads/')).map((k) => k.slice(11)),
        head: r.head.replace('refs/heads/', ''),
        hooks: r.hooks.length,
        commits: head ? st.reachable(r.name, [head]).filter((oid) => st.object(r.name, oid)?.type === 'commit').length : 0,
        files: head ? [...st.files(r.name, head).keys()] : [],
      };
    }),
  };
}

export function cloudLabFacts(cl: CloudLab, requests: ApiRequestRec[], ci: CiBridge | null): CloudLabFacts {
  const objects: { bucket: string; key: string; body: Uint8Array; contentType: string }[] = [];
  for (const b of cl.cloud.state.buckets)
    for (const key of cl.s3.keys(b.name)) {
      const o = cl.s3.get(b.name, key);
      if (o) objects.push({ bucket: b.name, key, body: o.body, contentType: o.contentType });
    }
  return { cloud: cloudScope(cl.cloud.state, requests), s3: s3Scope(objects), git: gitScope(cl), ci: ci?.facts() ?? { pipelines: [] } };
}

