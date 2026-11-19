#!/usr/bin/env bash
# trainer-check.sh — DevOps Trainer, Kubernetes real stage (05 §11.5).
#
# READ-ONLY. This script only runs `kubectl get` and `kubectl version`.
# It creates, changes and deletes nothing, reads no Secrets, and sends
# nothing over the network: it prints one block of text, and you paste
# that block into the trainer yourself. Read it to the end before running.
#
# What it collects (as JSON, then gzip, then base64):
#   - nodes, namespaces, pods, deployments, replicasets, daemonsets,
#     services, endpointslices, ingresses, jobs, networkpolicies,
#     storageclasses, persistentvolumeclaims (all namespaces)
#   - gatewayclasses, gateways, httproutes and Argo CD applications,
#     if those resource types exist in your cluster
#   - the ConfigMap default/trainer-proof only (your one-time code);
#     no other ConfigMap and no Secret is read
#   - kubectl client and server versions, the current context name
#
# Usage:
#   bash trainer-check.sh --track r1 --nonce CODE
#   bash trainer-check.sh --track r3 --nonce CODE [--context NAME]
#
# Needs: bash, kubectl with access to the cluster, gzip, base64.

set -euo pipefail

track="r1"
nonce=""
context_flag=()

while [ $# -gt 0 ]; do
  case "$1" in
    --track) track="${2:-}"; shift 2 ;;
    --nonce) nonce="${2:-}"; shift 2 ;;
    --context) context_flag=(--context "${2:-}"); shift 2 ;;
    -h|--help)
      sed -n '2,24p' "$0"
      exit 0 ;;
    *) echo "trainer-check: unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$track" in r1|r3) ;; *) echo "trainer-check: --track must be r1 or r3" >&2; exit 2 ;; esac
if [ -z "$nonce" ]; then
  echo "trainer-check: --nonce is required (the one-time code shown in the trainer)" >&2
  exit 2
fi
for tool in kubectl gzip base64; do
  command -v "$tool" >/dev/null 2>&1 || { echo "trainer-check: $tool is not installed" >&2; exit 2; }
done

k() { kubectl ${context_flag[@]+"${context_flag[@]}"} "$@"; }

if ! k get --raw=/readyz >/dev/null 2>&1; then
  echo "trainer-check: kubectl cannot reach the API server (try: kubectl get nodes)" >&2
  exit 1
fi

# The resource types this cluster serves, so that missing ones are reported
# as "absent" instead of failing the whole collection.
served="$(k api-resources -o name 2>/dev/null || true)"
has() { printf '%s\n' "$served" | grep -qx "$1"; }

# json_list RESOURCE [extra args] — prints a JSON list, or null if the type is absent.
json_list() {
  local res="$1"; shift
  k get "$res" -A -o json "$@" 2>/dev/null || echo 'null'
}

absent=()
section() {
  # section KEY FULL-RESOURCE-NAME
  local key="$1" full="$2"
  if has "$full"; then
    printf '"%s":' "$key"
    json_list "$full"
  else
    absent+=("$full")
    printf '"%s":null' "$key"
  fi
}

client_version="$(k version --client -o json 2>/dev/null | tr -d '\n' || echo '{}')"
server_version="$(k version -o json 2>/dev/null | tr -d '\n' || echo '{}')"
current_context="$(k config current-context 2>/dev/null || echo '')"
proof="$(k get configmap trainer-proof -n default -o json 2>/dev/null || echo 'null')"
collected_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[ -n "$client_version" ] || client_version='{}'
[ -n "$server_version" ] || server_version='{}'

payload() {
  printf '{"schema":"dt.k8s-check/v1","track":"%s","nonce":"%s","collectedAt":"%s",' "$track" "$nonce" "$collected_at"
  printf '"context":"%s",' "$current_context"
  printf '"clientVersion":%s,"serverVersion":%s,' "$client_version" "$server_version"
  printf '"resources":{'
  section nodes nodes; printf ','
  section namespaces namespaces; printf ','
  section pods pods; printf ','
  section deployments deployments.apps; printf ','
  section replicasets replicasets.apps; printf ','
  section daemonsets daemonsets.apps; printf ','
  section services services; printf ','
  section endpointslices endpointslices.discovery.k8s.io; printf ','
  section ingresses ingresses.networking.k8s.io; printf ','
  section networkpolicies networkpolicies.networking.k8s.io; printf ','
  section jobs jobs.batch; printf ','
  section storageclasses storageclasses.storage.k8s.io; printf ','
  section persistentvolumeclaims persistentvolumeclaims; printf ','
  section gatewayclasses gatewayclasses.gateway.networking.k8s.io; printf ','
  section gateways gateways.gateway.networking.k8s.io; printf ','
  section httproutes httproutes.gateway.networking.k8s.io; printf ','
  section applications applications.argoproj.io; printf ','
  printf '"configmaps":{"items":['
  if [ "$proof" != "null" ]; then printf '%s' "$proof"; fi
  printf ']}'
  printf '},"absent":['
  local first=1
  for a in "${absent[@]+"${absent[@]}"}"; do
    if [ $first -eq 0 ]; then printf ','; fi
    printf '"%s"' "$a"
    first=0
  done
  printf ']}'
}

blob="$(payload | gzip -9 | base64 | tr -d '\n')"

echo
echo "Copy everything between the two lines below and paste it into the trainer."
echo "-----BEGIN TRAINER CHECK-----"
printf '%s\n' "$blob" | fold -w 76
echo "-----END TRAINER CHECK-----"
echo
