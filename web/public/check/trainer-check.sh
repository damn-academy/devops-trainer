#!/usr/bin/env bash
# trainer-check.sh — DevOps Trainer, Kubernetes real stage (05 §11.5).
#
# READ-ONLY. This script only runs `kubectl get` and `kubectl version` and,
# with --machine, reads files and status commands on this node. It creates,
# changes and deletes nothing, reads no Secrets and no private keys, and
# sends nothing over the network: it prints one block of text, and you paste
# that block into the trainer yourself. Read it to the end before running.
#
# What it collects from the cluster (as JSON, then gzip, then base64):
#   - nodes, namespaces, pods, deployments, replicasets, daemonsets,
#     services, endpointslices, ingresses, jobs, cronjobs, networkpolicies,
#     storageclasses, persistentvolumeclaims (all namespaces)
#   - gatewayclasses, gateways, httproutes and Argo CD applications,
#     if those resource types exist in your cluster
#   - the ConfigMap default/trainer-proof (your one-time code) and, on a
#     kubeadm cluster, kube-system/kubeadm-config and kube-system/kubelet-config
#     (the ClusterConfiguration and the KubeletConfiguration kubeadm uploads:
#     versions, the pod subnet, the cgroup driver — no keys in them), and
#     default/exam-break (the marker an exam asks you to create);
#     no other ConfigMap and no Secret is read
#   - kubectl client and server versions, the current context name
#
# With --machine NAME (an exam on your own VMs; run it as root on the
# control-plane node) it also collects from this node:
#   - the static Pod manifests in /etc/kubernetes/manifests and the CNI
#     configuration in /etc/cni/net.d (both hold paths and flags, no keys)
#   - the etcd snapshot file: size, time, and `etcdutl snapshot status`,
#     which opens the file read-only (path: --snapshot, /opt/backup/etcd.db)
#   - the names of the etcd data directories /var/lib/etcd*
#   - kubeadm and kubelet versions, systemctl show kubelet and containerd
#   - the timer list (systemctl list-timers) and the lines of /etc/cron.d,
#     /etc/crontab and root's crontab that mention "snapshot save"
#   and prints the block in the dt.host-check/v1 form the exam page reads.
#
# Usage:
#   bash trainer-check.sh --track r1 --nonce CODE
#   bash trainer-check.sh --track r3 --nonce CODE [--context NAME]
#   sudo bash trainer-check.sh --nonce CODE --machine cp-1 --track k8s-2 \
#       [--snapshot /opt/backup/etcd.db]
#
# Needs: bash, kubectl with access to the cluster, gzip, base64; with
# --machine also stat and, for the snapshot status, etcdutl (or etcdctl).

set -euo pipefail

track="r1"
nonce=""
machine=""
snapshot="/opt/backup/etcd.db"
context_flag=()
# Only for the trainer's own tests: a directory that stands in for / on the node.
root="${TRAINER_CHECK_ROOT:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --track) track="${2:-}"; shift 2 ;;
    --nonce) nonce="${2:-}"; shift 2 ;;
    --context) context_flag=(--context "${2:-}"); shift 2 ;;
    --machine) machine="${2:-}"; shift 2 ;;
    --snapshot) snapshot="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,45p' "$0"
      exit 0 ;;
    *) echo "trainer-check: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$machine" ]; then
  case "$track" in r1|r3) ;; *) echo "trainer-check: --track must be r1 or r3" >&2; exit 2 ;; esac
else
  case "$track" in *[!a-z0-9-]*|'') echo "trainer-check: --track must be a name like k8s-2" >&2; exit 2 ;; esac
fi
if [ -z "$nonce" ]; then
  echo "trainer-check: --nonce is required (the one-time code shown in the trainer)" >&2
  exit 2
fi
for tool in kubectl gzip base64; do
  command -v "$tool" >/dev/null 2>&1 || { echo "trainer-check: $tool is not installed" >&2; exit 2; }
done

# As root on a kubeadm control-plane node, use the admin kubeconfig kubeadm wrote.
if [ -n "$machine" ] && [ -z "${KUBECONFIG:-}" ] && [ ! -f "${HOME:-/root}/.kube/config" ] && [ -r /etc/kubernetes/admin.conf ]; then
  export KUBECONFIG=/etc/kubernetes/admin.conf
fi

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
marker="$(k get configmap exam-break -n default -o json 2>/dev/null || echo 'null')"
kubeadm_config="$(k get configmap kubeadm-config -n kube-system -o json 2>/dev/null || echo 'null')"
kubelet_config="$(k get configmap kubelet-config -n kube-system -o json 2>/dev/null || echo 'null')"
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
  section cronjobs cronjobs.batch; printf ','
  section storageclasses storageclasses.storage.k8s.io; printf ','
  section persistentvolumeclaims persistentvolumeclaims; printf ','
  section gatewayclasses gatewayclasses.gateway.networking.k8s.io; printf ','
  section gateways gateways.gateway.networking.k8s.io; printf ','
  section httproutes httproutes.gateway.networking.k8s.io; printf ','
  section applications applications.argoproj.io; printf ','
  printf '"configmaps":{"items":['
  local sep=''
  for cm in "$proof" "$marker" "$kubeadm_config" "$kubelet_config"; do
    if [ "$cm" != "null" ]; then printf '%s%s' "$sep" "$cm"; sep=','; fi
  done
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

# ── node facts (--machine) ──────────────────────────────────────────────────

# jstr TEXT — TEXT as a JSON string (quotes, backslashes and control characters escaped).
jstr() {
  printf '%s' "$1" | LC_ALL=C awk '
    BEGIN { ORS = ""; printf "\"" }
    {
      gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); gsub(/\t/, "\\t"); gsub(/\r/, "\\r")
      gsub(/[\001-\010\013\014\016-\037\177]/, " ")
      if (NR > 1) printf "\\n"
      printf "%s", $0
    }
    END { printf "\"" }'
}

have() { command -v "$1" >/dev/null 2>&1; }

# file_entry KEY TEXT — one member of "files": a regular file with this text.
file_entry() {
  printf '%s:{"exists":true,"type":"f","mode":"0600","owner":"root","group":"root","size":%s,"text":%s}' "$(jstr "$1")" "${#2}" "$(jstr "$2")"
}

snapshot_facts() {
  local p="$root$snapshot" size="" mtime="" status="null"
  if [ -f "$p" ]; then
    size="$(stat -c %s "$p" 2>/dev/null || echo 0)"
    mtime="$(stat -c %Y "$p" 2>/dev/null || echo 0)"
    if have etcdutl; then status="$(etcdutl snapshot status "$p" -w json 2>/dev/null | tr -d '\n' || true)"
    elif have etcdctl; then status="$(ETCDCTL_API=3 etcdctl snapshot status "$p" -w json 2>/dev/null | tr -d '\n' || true)"
    fi
    case "$status" in '{'*) ;; *) status="null" ;; esac
    printf '{"path":%s,"exists":true,"size":%s,"mtime":%s,"status":%s}' "$(jstr "$snapshot")" "${size:-0}" "${mtime:-0}" "$status"
  else
    printf '{"path":%s,"exists":false}' "$(jstr "$snapshot")"
  fi
}

etcd_dirs() {
  local d
  for d in "$root"/var/lib/etcd*; do
    [ -d "$d" ] || continue
    printf '%s %s\n' "${d#"$root"}" "$([ -d "$d/member" ] && echo member || echo empty)"
  done
}

schedules() {
  have systemctl && systemctl list-timers --all --no-legend --no-pager 2>/dev/null | sed 's/^/timer: /' || true
  local f
  for f in "$root"/etc/cron.d/* "$root"/etc/crontab "$root"/var/spool/cron/crontabs/root; do
    [ -f "$f" ] || continue
    grep -H 'snapshot save' "$f" 2>/dev/null | sed "s|^$root||; s/^/cron: /" || true
  done
}

host_block() {
  local first=1 f name
  printf '{"schema":"dt.host-check/v1","nonce":%s,"machine":%s,"track":%s,"collectedAt":%s,' "$(jstr "$nonce")" "$(jstr "$machine")" "$(jstr "$track")" "$(jstr "$collected_at")"
  printf '"whoami":%s,"hostname":%s,"kernel":%s,' "$(jstr "$(id -un 2>/dev/null || echo root)")" "$(jstr "$(hostname 2>/dev/null || echo '')")" "$(jstr "$(uname -r)")"
  printf '"os":%s,"raw":{},"trees":{},"probes":{},' "$(jstr "$(. "$root/etc/os-release" 2>/dev/null; echo "${PRETTY_NAME:-}")")"
  printf '"files":{'
  file_entry "dt:k8s" "$(payload)"; printf ','
  file_entry "dt:snapshot" "$(snapshot_facts)"; printf ','
  file_entry "dt:etcd-dirs" "$(etcd_dirs)"; printf ','
  file_entry "dt:versions" "kubeadm $(have kubeadm && kubeadm version -o short 2>/dev/null || echo none)
kubelet $(have kubelet && kubelet --version 2>/dev/null | awk '{print $2}' || echo none)"; printf ','
  file_entry "dt:schedules" "$(schedules)"
  for f in "$root"/etc/kubernetes/manifests/* "$root"/etc/cni/net.d/*; do
    [ -f "$f" ] || continue
    printf ','
    file_entry "${f#"$root"}" "$(cat "$f")"
  done
  printf '},"units":{'
  for name in kubelet containerd; do
    [ $first -eq 1 ] || printf ','
    first=0
    printf '%s:{"show":%s}' "$(jstr "$name")" "$(jstr "$(have systemctl && systemctl show "$name" -p ActiveState,SubState,UnitFileState,NRestarts 2>/dev/null || true)")"
  done
  printf '}}'
}

if [ -n "$machine" ]; then
  [ -r "$root/etc/kubernetes/manifests" ] || { echo "trainer-check: cannot read /etc/kubernetes/manifests (run it with sudo on the control-plane node)" >&2; exit 2; }
  blob="$(host_block | gzip -9 | base64 | tr -d '\n')"
  begin="-----BEGIN TRAINER FACTS-----"
  end="-----END TRAINER FACTS-----"
else
  blob="$(payload | gzip -9 | base64 | tr -d '\n')"
  begin="-----BEGIN TRAINER CHECK-----"
  end="-----END TRAINER CHECK-----"
fi

echo
echo "Copy everything between the two lines below and paste it into the trainer."
echo "$begin"
printf '%s\n' "$blob" | fold -w 76
echo "$end"
echo
