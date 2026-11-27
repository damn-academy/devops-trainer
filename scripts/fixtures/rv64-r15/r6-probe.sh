#!/bin/sh
export PATH=/usr/bin:/usr/sbin:/bin:/sbin
export KUBECONFIG=/etc/kubernetes/admin.kubeconfig
(
  /bin/busybox sleep 120
  echo RV64_DIAGNOSTICS
  /bin/busybox cat /proc/1/stack /proc/1/wchan
  /bin/busybox head -12 /proc/meminfo
  /bin/busybox ps
  /bin/busybox grep -E '^ffffffff(80946|804a)' /proc/kallsyms
) &
/bin/busybox sleep 60
while [ ! -f "$KUBECONFIG" ]; do
  echo RV64_CONFIG_PENDING
  /bin/busybox cat /proc/1/stack
  for task in /proc/1/task/*; do /bin/busybox cat "$task/wchan"; echo; done
  /bin/busybox ls -l /var/lib/kuberoot/pki
  /bin/busybox sleep 30
done
echo RV64_CONFIG_CREATED
# RV64_DIAG_PROBE_V1
. /usr/share/kuberoot/rv64-diag-probe.sh
# Capture node/lease ages and scheduler/runtime state on failure, even under set -e.
diagnostics() {
  echo RV64_FAILURE_DIAGNOSTICS_BEGIN
  /bin/busybox date -u
  /bin/busybox cat /proc/uptime /proc/meminfo
  kubectl --request-timeout=60s get nodes -o yaml || true
  kubectl --request-timeout=60s -n kube-node-lease get leases -o yaml || true
  kubectl --request-timeout=60s get pods -A -o wide || true
  kubectl --request-timeout=60s get pods -A -o yaml || true
  kubectl --request-timeout=60s get events -A --sort-by=.metadata.creationTimestamp || true
  /bin/busybox timeout 30 ctr -n k8s.io images ls || true
  /bin/busybox timeout 30 ctr -n k8s.io containers ls || true
  /bin/busybox timeout 30 ctr -n k8s.io tasks ls || true
  echo RV64_FAILURE_DIAGNOSTICS_END
}
(
  /bin/busybox sleep 120
  echo RV64_READYZ_BEGIN
  : > /run/rv64-diag-readyz-start
  /bin/busybox cat /proc/uptime /proc/cmdline
  # RV64_MEM_PROBE_V1: baseline immediately after readyz, then every 60 guest seconds.
  (
    while :; do
      /bin/busybox awk '
        FILENAME == "/proc/uptime" { uptime = $1; next }
        FILENAME == "/proc/meminfo" &&
          ($1 == "MemAvailable:" || $1 == "Cached:" ||
           $1 == "Active(file):" || $1 == "Inactive(file):") {
          key = $1; sub(/:$/, "", key)
          printf "RV64_MEM uptime=%s %s=%s kB\n", uptime, key, $2
        }
        FILENAME == "/proc/vmstat" &&
          ($1 == "pgmajfault" || $1 == "workingset_refault_file" ||
           $1 ~ /^pgscan/ || $1 ~ /^pgsteal/) {
          printf "RV64_MEM uptime=%s %s=%s\n", uptime, $1, $2
        }
      ' /proc/uptime /proc/meminfo /proc/vmstat
      /bin/busybox sleep 60
    done
  ) &
  kubectl --request-timeout=120s get --raw='/readyz?verbose'
  echo "RV64_READYZ_STATUS=$?"
  /bin/busybox cat /proc/uptime
  echo RV64_READYZ_END
) &
(
  while [ ! -S /run/containerd/containerd.sock ]; do /bin/busybox sleep 2; done
  for archive in /usr/share/kuberoot/rv64-images/*.tar; do
    ctr -n k8s.io images import --digests "$archive" || exit 1
  done
  echo RV64_IMAGES_IMPORTED
) &
importer=$!
node_ready() {
  node_status=$(kubectl --request-timeout=120s get nodes -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')
  echo "RV64_NODE_STATUS=$node_status"
  [ "$node_status" = True ]
}
until node_ready; do
  /bin/busybox sleep 10
done
wait "$importer" || { echo RV64_PROBE_FAILED; exit 1; }
echo RV64_SETTLE_BEGIN
kubectl --request-timeout=620s wait --for=condition=Ready pods --all -A --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s run rv64-warmup --image=docker.io/library/busybox:1.37.0 --image-pull-policy=Never --restart=Never -- /bin/sh -c 'sleep 3600' || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=620s wait --for=condition=Ready pod/rv64-warmup --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s delete pod rv64-warmup --wait=true || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s get pods -A || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
echo RV64_SETTLE_END
echo RV64_NODE_READY
/bin/busybox sleep 2
set -e
/bin/busybox cat /proc/uptime
echo RV64_RECHECK_BEGIN
/bin/busybox date -u
until kubectl --request-timeout=120s get nodes -o wide; do
  echo RV64_RECHECK_RETRY
  /bin/busybox sleep 1
done
kubectl --request-timeout=120s get nodes -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' | /bin/busybox grep -q True || { echo RV64_PROBE_FAILED; exit 1; }
echo RV64_RECHECK_READY
for i in 1 2 3; do
  echo RV64_GET_PODS_BEGIN
  /bin/busybox cat /proc/uptime
  kubectl --request-timeout=120s get pods -A || { echo RV64_PROBE_FAILED; exit 1; }
  /bin/busybox cat /proc/uptime
  echo RV64_GET_PODS_END
done
echo RV64_POD_START_BEGIN
/bin/busybox cat /proc/uptime
if /bin/busybox timeout -s QUIT 180 kubectl run rv64-busybox --request-timeout=120s --v=6 --image=docker.io/library/busybox:1.37.0 --image-pull-policy=Never --restart=Never -- /bin/sh -c 'sleep 3600'; then
  echo RV64_CREATE_STATUS=0
else
  code=$?
  echo RV64_CREATE_STATUS=$code
  # A timed-out create may have committed. Check before claiming failure or retrying.
  kubectl get pod rv64-busybox --request-timeout=120s -o wide || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
fi
kubectl wait --for=condition=Ready pod/rv64-busybox --timeout=300s --request-timeout=320s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
/bin/busybox cat /proc/uptime
echo RV64_POD_START_END
kubectl get pods -A -o wide
echo RV64_PROBE_DONE
/bin/busybox sleep 100000
