import { runPodWorkloadCommand } from './kubectl';
import { ApiError, type Cluster } from './cluster';
import { b64 } from './admission';
import { apiClient, authorize, canI, identity, trustedCluster } from './rbac';
import { parseArgs, str, bool } from './kubectl/args';
import { printTable, toYaml, listOf } from './kubectl/printers';
import { parseManifests } from './manifests';
import type { Obj } from './util';

export function serviceAccountToken(pod: Obj): string {
  // Bound simulator token: never valid against a real Kubernetes cluster.
  return [b64(JSON.stringify({ alg: 'SIM', typ: 'JWT' })), b64(JSON.stringify({ sub: `system:serviceaccount:${pod.metadata.namespace}:${pod.spec.serviceAccountName ?? 'default'}`, pod: pod.metadata.uid })), b64(`kube-lite:${pod.metadata.uid}`)].join('.');
}
export function podApi(c: Cluster, pod: Obj, argv: string[], files: Record<string, string>): { out: string; err: string; code: number } | null {
  c = trustedCluster(c);
  const [cmd, ...args] = argv;
  const who = identity(`system:serviceaccount:${pod.metadata.namespace}:${pod.spec.serviceAccountName ?? 'default'}`);
  const client = apiClient(c, who);
  try {
    if (cmd === 'kubectl') {
      if (!Object.values(files).includes(serviceAccountToken(pod))) throw new ApiError(401, 'Unauthorized', 'Unauthorized');
      const commandAt = args.findIndex((a, i) => !a.startsWith('-') && !['-n', '--namespace', '--context', '--kubeconfig', '--as', '--as-group'].includes(args[i - 1] ?? ''));
      if (['set', 'rollout', 'run'].includes(args[commandAt])) {
        if (args.some(a => /^--(?:as|as-group|context|kubeconfig)(?:=|$)/.test(a))) throw new Error('identity overrides are not supported by in-pod kubectl');
        return runPodWorkloadCommand(client, pod.metadata.namespace, [args[commandAt], ...args.slice(0, commandAt), ...args.slice(commandAt + 1)]);
      }
      const p = parseArgs(args, [{ long: 'output', short: 'o', value: true }, { long: 'filename', short: 'f', value: true }, { long: 'all-namespaces', short: 'A' }, { long: 'subresource', value: true }]);
      if (p.error || p.unsupported) throw new Error(p.error ?? `unsupported flag ${p.unsupported}`);
      if (str(p, 'as')) throw new Error('impersonation is not supported by in-pod kubectl');
      const ns = str(p, 'namespace') ?? pod.metadata.namespace;
      const [verb, resource, name] = p.args;
      if (verb === 'apply' || verb === 'create') {
        const path = str(p, 'filename'); if (!path || files[path] === undefined) throw new Error('a mounted manifest file is required');
        const out = parseManifests(files[path], path).map(o => { const result = verb === 'apply' ? client.apply(o, { namespace: ns }) : { obj: client.create(o, { namespace: ns }), result: 'created' }; return `${c.kinds.ref(c.kinds.byKind(o.kind)!)}/${result.obj.metadata.name} ${result.result}\n`; }).join('');
        return { out, err: '', code: 0 };
      }
      const token = verb === 'auth' ? p.args[3] : resource;
      const [kind, inlineName] = (token ?? '').split('/');
      const info = c.kinds.resolve(kind); if (!info) throw new Error(`the server doesn't have a resource type "${kind}"`);
      const objName = inlineName ?? (verb === 'auth' ? undefined : name);
      if (verb === 'auth' && resource === 'can-i') {
        const ok = canI(c, who, name, info.plural + (str(p, 'subresource') ? '/' + str(p, 'subresource') : ''), info.group, bool(p, 'all-namespaces') ? undefined : ns, objName);
        return { out: ok ? 'yes\n' : 'no\n', err: '', code: ok ? 0 : 1 };
      }
      if (verb === 'delete' && objName) { client.delete(info.kind, ns, objName); return { out: `${c.kinds.ref(info)} "${objName}" deleted\n`, err: '', code: 0 }; }
      if (verb !== 'get') throw new Error(`unsupported in-pod kubectl command "${verb}"`);
      const objects = objName ? [client.get(info.kind, ns, objName)].filter(Boolean) as Obj[] : client.list(info.kind, bool(p, 'all-namespaces') ? undefined : ns);
      if (objName && !objects.length) throw new ApiError(404, 'NotFound', `${info.plural} "${objName}" not found`);
      const format = str(p, 'output'); const value = objName ? objects[0] : listOf(objects);
      const out = format === 'json' ? JSON.stringify(value, null, 2) + '\n' : format === 'yaml' ? toYaml(value) : objects.length ? printTable(c, info.kind, objects, { allNamespaces: bool(p, 'all-namespaces') }) : `No resources found in ${ns} namespace.\n`;
      return { out, err: '', code: 0 };
    }
    if (cmd !== 'curl') return null;
    const url = args.find(a => /^https?:\/\//.test(a));
    if (!url || !/^https?:\/\/(kubernetes(?:\.default(?:\.svc(?:\.cluster\.local)?)?)?|10\.43\.0\.1)(?::\d+)?\//.test(url)) return null;
    const header = args.find(a => /^Authorization:\s*Bearer /i.test(a));
    const bearer = header?.replace(/^Authorization:\s*Bearer\s+/i, '');
    if (!bearer || bearer !== serviceAccountToken(pod)) throw new ApiError(401, 'Unauthorized', 'Unauthorized');
    const path = new URL(url).pathname;
    const match = /^\/(?:api\/v1|apis\/([^/]+)\/[^/]+)(?:\/namespaces\/([^/]+))?\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(path);
    if (!match) throw new ApiError(404, 'NotFound', 'the server could not find the requested resource');
    const [, group = '', ns, resource, name, sub] = match;
    const info = c.kinds.all().find(k => k.group === group && k.plural === resource);
    if (!info) throw new ApiError(404, 'NotFound', 'the server could not find the requested resource');
    const methodAt = args.findIndex(a => a === '-X' || a === '--request');
    const method = methodAt < 0 ? 'GET' : args[methodAt + 1];
    if (method !== 'GET') throw new Error('in-pod API curl currently supports GET only');
    authorize(c, who, name ? 'get' : 'list', info.kind, ns, name, sub);
    const value = name ? c.get(info.kind, ns, name) : listOf(c.list(info.kind, ns));
    if (!value) throw new ApiError(404, 'NotFound', `${resource} "${name}" not found`);
    return { out: JSON.stringify(value, null, 2) + '\n', err: '', code: 0 };
  } catch (e) {
    if (cmd === 'curl' && e instanceof ApiError) return { out: JSON.stringify({ kind: 'Status', apiVersion: 'v1', metadata: {}, status: 'Failure', message: e.message, reason: e.reason, code: e.code }) + '\n', err: '', code: args.some(a => a === '-f' || a === '--fail') ? 22 : 0 };
    return { out: '', err: (e instanceof ApiError ? e.print() : `error: ${(e as Error).message}`) + '\n', code: 1 };
  }
}
