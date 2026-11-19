// Running learner-written controller code (05 §6.3, "the code sandbox").
//
// The code never gets a live client. For each reconcile call it receives a
// JSON snapshot of the objects it may read, and returns a list of actions
// (create / update / delete) that the trainer validates and sends to the API
// server with the controller's narrow permissions. In the browser the call
// runs in a dedicated Worker built from a Blob: before the learner's code
// is evaluated, the worker removes fetch, XMLHttpRequest, WebSocket,
// EventSource, importScripts, indexedDB, caches, navigator, BroadcastChannel
// and nested Workers from its global scope and from the prototype chain, so
// the code can neither reach the network nor read the trainer's storage (the
// AI key lives in IndexedDB, 09 §4.4). Each call has a 200 ms budget; a
// worker that does not answer in time is terminated. The design's QuickJS
// interpreter can replace this runner later without changing the contract.

import type { Obj } from './util';

export type Action = { op: 'create'; obj: Obj } | { op: 'update'; obj: Obj } | { op: 'delete'; kind: string; namespace?: string; name: string };

export interface ReconcileResult {
  ok: boolean;
  actions: Action[];
  logs: string[];
  error?: string;
  ms: number;
}

/** The client the learner's function sees: reads from the snapshot, writes into the action list. */
export const CLIENT_PRELUDE = `
const __actions = [];
const __logs = [];
const __clone = (x) => JSON.parse(JSON.stringify(x));
const console = { log: (...a) => __logs.push(a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) };
const k = {
  get(kind, namespace, name) {
    const o = __world.find((x) => x.kind === kind && (x.metadata.namespace || '') === (namespace || '') && x.metadata.name === name);
    return o ? __clone(o) : null;
  },
  list(kind, namespace) {
    return __world.filter((x) => x.kind === kind && (namespace === undefined || (x.metadata.namespace || '') === namespace)).map(__clone);
  },
  create(obj) { __actions.push({ op: 'create', obj: __clone(obj) }); },
  update(obj) { __actions.push({ op: 'update', obj: __clone(obj) }); },
  delete(kind, namespace, name) { __actions.push({ op: 'delete', kind, namespace, name }); },
};
const ownerRef = (o) => ({ apiVersion: o.apiVersion, kind: o.kind, name: o.metadata.name, uid: o.metadata.uid, controller: true, blockOwnerDeletion: true });
`;

/** Build the function text: prelude + learner code + a call. */
export function programText(code: string): string {
  return `"use strict";\n${CLIENT_PRELUDE}\n${code}\n;if (typeof reconcile !== 'function') throw new Error('define a function named reconcile(obj, k)');\nreconcile(__obj, k);\nreturn { actions: __actions, logs: __logs };`;
}

/** In-process evaluation (tests, and as the reference semantics). Not isolated: never used for learner code in the browser. */
export function reconcileInProcess(code: string, obj: Obj, world: Obj[]): ReconcileResult {
  const t0 = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('__obj', '__world', programText(code)) as (o: Obj, w: Obj[]) => { actions: Action[]; logs: string[] };
    const r = fn(JSON.parse(JSON.stringify(obj)), JSON.parse(JSON.stringify(world)));
    return { ok: true, actions: r.actions, logs: r.logs, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, actions: [], logs: [], error: String((e as Error).message ?? e), ms: Date.now() - t0 };
  }
}

const WORKER_SOURCE = `
const post = self.postMessage.bind(self);
const KILL = ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebTransport', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'navigator', 'BroadcastChannel', 'Worker', 'SharedWorker', 'location', 'Request', 'Response', 'Headers', 'cookieStore', 'storage'];
for (let o = self; o; o = Object.getPrototypeOf(o)) {
  for (const n of KILL) {
    try { if (Object.prototype.hasOwnProperty.call(o, n)) delete o[n]; } catch (e) {}
    try { Object.defineProperty(o, n, { value: undefined, configurable: false, writable: false }); } catch (e) {}
  }
}
self.onmessage = (ev) => {
  const { code, obj, world } = ev.data;
  const t0 = Date.now();
  try {
    const fn = new Function('__obj', '__world', code);
    const r = fn(obj, world);
    post({ ok: true, actions: r.actions, logs: r.logs, ms: Date.now() - t0 });
  } catch (e) {
    post({ ok: false, actions: [], logs: [], error: String(e && e.message || e), ms: Date.now() - t0 });
  }
};
`;

/** A sandboxed runner; one worker per controller, restarted after a timeout. */
export class SandboxRunner {
  private worker: Worker | null = null;
  private url: string | null = null;
  constructor(private budgetMs = 200) {}

  static available(): boolean {
    return typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  }

  private spawn(): Worker {
    if (!this.url) this.url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    this.worker = new Worker(this.url);
    return this.worker;
  }

  run(code: string, obj: Obj, world: Obj[]): Promise<ReconcileResult> {
    const w = this.worker ?? this.spawn();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        w.terminate();
        this.worker = null;
        resolve({ ok: false, actions: [], logs: [], error: `reconcile took longer than ${this.budgetMs} ms and was stopped (an endless loop?)`, ms: this.budgetMs });
      }, this.budgetMs);
      w.onmessage = (ev: MessageEvent<ReconcileResult>) => {
        clearTimeout(timer);
        resolve(ev.data);
      };
      w.onerror = (ev) => {
        clearTimeout(timer);
        ev.preventDefault();
        resolve({ ok: false, actions: [], logs: [], error: ev.message || 'the code could not be parsed', ms: 0 });
      };
      w.postMessage({ code: programText(code), obj: JSON.parse(JSON.stringify(obj)), world: JSON.parse(JSON.stringify(world)) });
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

/** What the controller is allowed to touch (its ServiceAccount's RBAC in the design). */
export interface Grant {
  kinds: string[];
  verbs: ('create' | 'update' | 'delete')[];
}

/** Check one action against the grant; returns the API server's Forbidden text when denied. */
export function authorize(a: Action, g: Grant, sa: string): string | null {
  const kind = a.op === 'delete' ? a.kind : a.obj?.kind;
  const verb = a.op;
  const ns = a.op === 'delete' ? a.namespace : a.obj?.metadata?.namespace;
  const name = a.op === 'delete' ? a.name : a.obj?.metadata?.name;
  if (!kind || !g.kinds.includes(kind) || !g.verbs.includes(verb)) {
    const res = `${String(kind ?? 'unknown').toLowerCase()}s`;
    return `Error from server (Forbidden): ${res}${name ? ` "${name}"` : ''} is forbidden: User "system:serviceaccount:${sa}" cannot ${verb} resource "${res}" in API group "${kind === 'Deployment' ? 'apps' : ''}"${ns ? ` in the namespace "${ns}"` : ''}`;
  }
  return null;
}
