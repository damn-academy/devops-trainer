import { ApiError, type Cluster } from './cluster';
import { clone, mergePatch, strategicMerge, type Obj } from './util';

export interface Identity { user: string; groups: string[] }
export const identity = (user = 'default', groups: string[] = []): Identity => ({ user, groups: [...groups, 'system:authenticated', ...(['default', 'admin'].includes(user) ? ['system:masters'] : []), ...(user.startsWith('system:serviceaccount:') ? ['system:serviceaccounts', `system:serviceaccounts:${user.split(':')[2]}`] : [])] });
export function rulesFor(c: Cluster, who: Identity, ns?: string): Obj[] {
  if (who.groups.includes('system:masters')) return [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }];
  return [...c.list('ClusterRoleBinding'), ...(ns ? c.list('RoleBinding', ns) : [])].flatMap(b => {
    const matches = (b.subjects ?? []).some((s: Obj) => s.kind === 'User' ? s.name === who.user : s.kind === 'Group' ? who.groups.includes(s.name) : s.kind === 'ServiceAccount' && who.user === `system:serviceaccount:${s.namespace ?? b.metadata.namespace}:${s.name}`);
    return matches ? c.get(b.roleRef.kind, b.roleRef.kind === 'Role' ? b.metadata.namespace : undefined, b.roleRef.name)?.rules ?? [] : [];
  });
}
export function canI(c: Cluster, who: Identity, verb: string, resource: string, group = '', ns?: string, name?: string): boolean {
  const match = (xs: string[] = [], v: string) => xs.includes('*') || xs.includes(v);
  return rulesFor(c, who, ns).some(r => match(r.verbs, verb) && match(r.apiGroups, group) && (match(r.resources, resource) || (resource.includes('/') && (r.resources ?? []).includes(`*/${resource.split('/')[1]}`))) && (!(r.resourceNames?.length) || (!!name && !['create', 'deletecollection'].includes(verb) && r.resourceNames.includes(name))));
}
export function authorize(c: Cluster, who: Identity, verb: string, kind: string, ns?: string, name?: string, subresource?: string): void {
  const k = c.kinds.byKind(kind)!;
  const resource = k.plural + (subresource ? `/${subresource}` : '');
  const allowed = canI(c, who, verb, resource, k.group, k.namespaced ? ns : undefined, name);
  c.authorizationDecisions.push({ user: who.user, groups: who.groups, verb, resource, group: k.group, namespace: ns, name, allowed });
  if (c.authorizationDecisions.length > 200) c.authorizationDecisions.shift();
  if (!allowed) throw new ApiError(403, 'Forbidden', `${k.plural}${k.group ? '.' + k.group : ''}${name ? ` "${name}"` : ''} is forbidden: User "${who.user}" cannot ${verb} resource "${resource}" in API group "${k.group}" ${k.namespaced && ns ? `in the namespace "${ns}"` : 'at the cluster scope'}`);
}
const clients = new WeakMap<Cluster, Cluster>();
export const trustedCluster = (c: Cluster): Cluster => clients.get(c) ?? c;
function preventEscalation(c: Cluster, who: Identity, o: Obj, ns?: string): void {
  if (who.groups.includes('system:masters')) return;
  const covers = (rules: Obj[]) => rules.every(r => !(r.nonResourceURLs?.length) && (r.apiGroups ?? []).every((g: string) => (r.resources ?? []).every((resource: string) => (r.verbs ?? []).every((verb: string) => (r.resourceNames?.length ? r.resourceNames : [undefined]).every((name: string | undefined) => canI(c, who, verb, resource, g, ns, name))))));
  if (['Role', 'ClusterRole'].includes(o.kind) && !canI(c, who, 'escalate', c.kinds.byKind(o.kind)!.plural, 'rbac.authorization.k8s.io', ns, o.metadata.name) && !covers(o.rules ?? [])) throw new ApiError(403, 'Forbidden', `${c.pluralOf(o.kind)} "${o.metadata.name}" is forbidden: user "${who.user}" is attempting to grant RBAC permissions not currently held`);
  if (['RoleBinding', 'ClusterRoleBinding'].includes(o.kind) && o.roleRef) {
    const ref = o.roleRef;
    const role = c.get(ref.kind, ref.kind === 'Role' ? ns : undefined, ref.name);
    if (!canI(c, who, 'bind', c.kinds.byKind(ref.kind)?.plural ?? '', 'rbac.authorization.k8s.io', ns, ref.name) && (!role || !covers(role.rules ?? []))) throw new ApiError(403, 'Forbidden', `${c.pluralOf(o.kind)} "${o.metadata.name}" is forbidden: user "${who.user}" is attempting to grant RBAC permissions not currently held`);
  }
}
/** API client boundary: controller/store calls stay bound to the trusted cluster. */
export function apiClient(c: Cluster, who: Identity): Cluster {
  c = trustedCluster(c);
  const client = new Proxy(c, { get(target, prop) {
    const value = Reflect.get(target, prop);
    if (typeof value !== 'function') return value;
    return (...args: any[]) => {
      if (['get', 'list', 'patch', 'delete'].includes(String(prop))) authorize(c, who, String(prop), args[0], args[1], args[2]);
      if (['create', 'replace', 'apply'].includes(String(prop))) {
        const o = args[0]; c.resolveManifest(o); const ns = o.metadata?.namespace ?? args[1]?.namespace ?? 'default';
        const verb = prop === 'replace' ? 'update' : prop === 'apply' && c.get(o.kind, ns, o.metadata?.name) ? 'patch' : 'create';
        authorize(c, who, verb, o.kind, ns, verb === 'create' ? undefined : o.metadata?.name);
        preventEscalation(c, who, prop === 'apply' ? mergePatch(c.get(o.kind, ns, o.metadata?.name) ?? {}, o) as Obj : o, c.kinds.byKind(o.kind)?.namespaced ? ns : undefined);
      }
      if (prop === 'patch') {
        const live = c.get(args[0], args[1], args[2]);
        if (live) preventEscalation(c, who, (args[4]?.strategic ? strategicMerge : mergePatch)(live, args[3]) as Obj, args[1]);
      }
      const result = value.apply(target, args);
      return ['get', 'list'].includes(String(prop)) && result !== undefined ? clone(result) : result;
    };
  } });
  clients.set(client, c);
  return client;
}
export function bootstrapRbac(c: Cluster): void {
  const apiVersion = 'rbac.authorization.k8s.io/v1';
  c.put({ apiVersion, kind: 'ClusterRole', metadata: { name: 'system:basic-user' }, rules: [
    { apiGroups: ['authorization.k8s.io'], resources: ['selfsubjectaccessreviews', 'selfsubjectrulesreviews'], verbs: ['create'] },
    { apiGroups: ['authentication.k8s.io'], resources: ['selfsubjectreviews'], verbs: ['create'] },
  ] });
  c.put({ apiVersion, kind: 'ClusterRoleBinding', metadata: { name: 'system:basic-user' }, roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'system:basic-user' }, subjects: [{ kind: 'Group', apiGroup: 'rbac.authorization.k8s.io', name: 'system:authenticated' }] });
  const read = ['get', 'list', 'watch'];
  const resources = ['pods', 'pods/log', 'services', 'endpoints', 'configmaps', 'persistentvolumeclaims', 'serviceaccounts'];
  for (const name of ['cluster-admin', 'admin', 'edit', 'view']) {
    const verbs = name === 'view' ? read : ['*'];
    const rules = name === 'cluster-admin' ? [{ apiGroups: ['*'], resources: ['*'], verbs }] : [{ apiGroups: [''], resources: [...resources, ...(name === 'view' ? [] : ['secrets', 'pods/exec'])], verbs }, { apiGroups: ['apps', 'batch', 'networking.k8s.io', 'autoscaling'], resources: ['*'], verbs }, ...(name === 'admin' ? [{ apiGroups: ['rbac.authorization.k8s.io'], resources: ['roles', 'rolebindings'], verbs }] : [])];
    c.put({ apiVersion, kind: 'ClusterRole', metadata: { name }, rules });
  }
  c.put({ apiVersion, kind: 'ClusterRoleBinding', metadata: { name: 'cluster-admin' }, roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' }, subjects: [{ kind: 'Group', apiGroup: 'rbac.authorization.k8s.io', name: 'system:masters' }] });
}
