# src/engine/kube-lite

**What lives here:** kube-lite: store with watch, apiserver-lite, controllers, scheduler, cni/kube-proxy/coredns lite, kubectl and kubectl explain pages.

**Design source:** `design/05-kubernetes.md §5`.

**Owner:** the Kubernetes builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).

## RBAC, StatefulSets and Helm

### API identities and RBAC

`apiClient(cluster, identity(user, groups))` is the authorization boundary for
external requests. Its methods authorize reads and writes before calling the
trusted store/apiserver. Controllers retain the trusted `Cluster`, so a user's
permissions do not restrict reconciliation. Consumers adding an API entry point
must use this client, not the internal `get/list/put` methods.

Supported resources: ServiceAccount, Role, ClusterRole, RoleBinding and
ClusterRoleBinding. Rules match API groups, resource/subresource names, verbs,
`resourceNames`, wildcard rules and User/Group/ServiceAccount subjects. RoleBindings
are namespace-scoped, including references to ClusterRoles. ClusterRoleBindings
apply cluster-wide. Roles cannot be escalated and bindings cannot grant privileges
the caller lacks without `escalate`/`bind`. A binding's roleRef is immutable.

The bootstrap ClusterRoles are `cluster-admin`, `admin`, `edit`, `view` (for this
simulator's resource set). The default administrator belongs to `system:masters`.
Kubeconfig also contains `developer` and `deployer` contexts; neither gets global
permissions. A setup with an explicit existing `namespace` creates a visible
`training-deployer` Role/RoleBinding in the selected namespace and other non-system
namespaces provisioned by the scenario, for the deployment identity
used by CI lessons. It allows deployment/service writes and workload reads, not
Secret access, node administration, RBAC writes or access to subsequently created namespaces. Set
`ext.k8s.trainingDeployer: false` to disable this preset for RBAC exercises.

Commands:

- `kubectl --as=developer [--as-group=team] get|describe|apply|create|patch|delete ...`
- `kubectl auth can-i VERB RESOURCE[/NAME] [-n NS | -A] [--subresource=log]`
- `kubectl auth can-i --list [--as=USER] [-n NS]`
- `kubectl create role|clusterrole NAME --verb=get,list --resource=pods,pods/log [--resource-name=NAME]`
- `kubectl create rolebinding|clusterrolebinding NAME --role=NAME|--clusterrole=NAME --user=USER|--group=GROUP|--serviceaccount=NS:NAME`
- `kubectl create serviceaccount NAME`; get/describe/YAML/JSON for all RBAC kinds.

For example, an unbound user receives:

```text
Error from server (Forbidden): pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"
```

Pod-mounted simulator tokens identify the pod's actual ServiceAccount and UID.
`automountServiceAccountToken: false` is respected. In-pod kubectl supports get,
auth can-i, apply/create from a mounted manifest, and delete. In-pod curl accepts
`Authorization: Bearer ...` against the Kubernetes API for GET requests, including
`sh -c 'curl -k -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default.svc/api/v1/namespaces/default/pods'`.
The tokens are intentionally simulator-only, not cryptographic Kubernetes tokens.

### StatefulSets

The controller creates ordinal pod names with hostname/subdomain and the
`statefulset.kubernetes.io/pod-name`, `apps.kubernetes.io/pod-index` and
`controller-revision-hash` labels. OrderedReady gates startup on readiness and
scales down from the highest ordinal, waiting for termination. Parallel creates
or terminates replicas together. Rolling updates replace the highest ordinal
first and wait for readiness before proceeding; partition and OnDelete are
supported. ControllerRevisions persist template history in the object store.

A headless Service with a matching selector exposes
`db-0.db.default.svc.cluster.local`. PVC templates become `data-db-0`, etc., use the
existing PV binder/CSI controller, and remain after scale-down/deletion. Install
`csi-hostpath` and use `csi-hostpath-sc` (or provide static PVs) to bind claims.

Commands include get/describe, scale, set image, and
`kubectl rollout status|history|undo statefulset/NAME`, with timeout/watch,
revision/to-revision and partition-aware status. Example columns:

```text
NAME  READY  AGE
db    3/3    90s

REVISION  CHANGE-CAUSE
1         <none>
2         <none>
```

### Helm training charts

The `helm` command is registered by this module. Repositories are in-memory aliases
for the bundled `nginx-web`, `postgres-like`, and `podinfo` charts, version 1.0.0.
The stateful chart uses the trainer web image as a database-shaped workload; it
is not a PostgreSQL implementation. Renderers merge chart defaults, ordered YAML
`-f` files and dotted `--set` overrides. Values include replicaCount, image,
service, resources, env, and (for postgres-like) persistence. Renderers are
precomputed TypeScript, not a general Go-template interpreter.

Supported commands:

```sh
helm repo add training https://charts.example.test
helm repo update
helm repo list
helm search repo [QUERY]
helm show values training/nginx-web
helm template web training/nginx-web -f values.yaml --set replicaCount=3
helm lint training/nginx-web
helm install web training/nginx-web [-n NS --create-namespace] [--wait --timeout=5m]
helm upgrade web training/nginx-web --install --set replicaCount=4
helm list [-A]
helm status web
helm get values web [--all]
helm get manifest web
helm history web
helm rollback web 1
helm uninstall web [--keep-history]
```

`--reuse-values` is supported on upgrade. Foreign resources cannot be adopted
silently. Validation errors are reported as `Error: UPGRADE FAILED: ...` before
workload mutation; a wait timeout records a failed release. Successful upgrades
supersede the old revision; rollback creates a new revision. Release records are
Secrets named `sh.helm.release.v1.web.v1`, type `helm.sh/release.v1`, with Helm owner,
name, status and version labels. The simulator payload is base64 JSON, not Helm's
compressed wire encoding. Repositories, releases and authorization decisions
survive cluster snapshots. Helm's shell adapter honors the selected kubeconfig
user and namespace.

Output columns:

```text
NAME  NAMESPACE  REVISION  UPDATED  STATUS  CHART  APP VERSION
REVISION  UPDATED  STATUS  CHART  APP VERSION  DESCRIPTION
```

### Lesson facts

`clusterFacts(c)` / `facts.k8s` adds:

- `rbac.objects`: ServiceAccounts and all four RBAC kinds;
  `rbac.decisions`: user/groups, verb, resource, API group, namespace, name, allowed.
- `statefulsets`: namespace/name, replicas/ready, current/update revisions,
  ordinal pod names/readiness/PVC references, plus retained PVC names/phases/volumes.
- `helm.releases`: latest record per namespace/name;
  `helm.revisions`: all retained records with values, manifests and status.

The existing `objects` fact also includes every new kind and Helm Secret.

### Deliberate limits

RBAC aggregation and non-resource URL authorization are not implemented. Bootstrap
roles cover simulated resources, not Kubernetes' entire discovery surface. The
simulator does not verify external kubeconfig certificates or cryptographic tokens;
context usernames represent authenticated training identities. In-pod CLI/API
support is a smaller subset than host kubectl. Arbitrary HTTP API writes, token
expiry/rotation and admission webhooks are not simulated.

StatefulSet `minReadySeconds`, revision-history pruning, maxUnavailable feature-gate
behavior, PVC auto-deletion retention policies and real data replication are not
implemented. Claims are always retained. Validation extends the existing
handwritten Kubernetes schema/defaulting model; this is not a complete OpenAPI
conformance implementation.

Helm does not download repositories, load arbitrary chart directories, evaluate
Go templates/hooks/dependencies, or implement atomic transactions. CLI tables keep
the real column order but timestamps/padding are simplified. Helm --wait uses
simulated workload readiness, not the full upstream readiness suite.

References: [kubectl auth can-i](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_auth/kubectl_auth_can-i/),
[Helm 3 lifecycle](https://helm.sh/docs/v3/intro/using_helm/).
