#!/usr/bin/env python3
"""Pod-only: instrument an extracted kuberoot root; keep the published media intact."""
import os
from pathlib import Path
assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
root = Path(os.environ.get('RV64_PROBE_ROOT', '/work/guest/kuberoot/root'))
init = root / 'usr/sbin/kinit'
original = init.with_name('kinit.real')
if not original.exists():
    init.rename(original)
init.write_text('''#!/bin/sh
/bin/sh /usr/share/kuberoot/rv64-probe.sh >/dev/console 2>&1 &
exec /usr/sbin/kinit.real
''')
init.chmod(0o755)
(root / 'usr/share/kuberoot/rv64-probe.sh').write_text('''#!/bin/sh
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
  /bin/busybox cat /proc/uptime /proc/cmdline
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
echo RV64_NODE_READY
set -e
/bin/busybox cat /proc/uptime
kubectl get nodes -o wide
for i in 1 2 3; do
  echo RV64_GET_PODS_BEGIN
  /bin/busybox cat /proc/uptime
  kubectl get pods -A
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
''')
profile = root / 'usr/share/kuberoot/profile.yaml'
profile.write_text(profile.read_text().replace('packages: true', 'packages: false'))
print('Installed console probe; kinit remains PID 1. Any explicit packages: true setting was replaced with false in this probe only.')

# Snapshot fixtures need wall time before any certificate is issued. Keep the
# ordinary diagnostic image unchanged unless explicitly building this fixture.
if os.environ.get('RV64_PROBE_SNAPSHOT') == '1':
    init.write_text("""#!/bin/sh
for arg in $(/bin/busybox cat /proc/cmdline); do
  case "$arg" in rv64.epoch=*) /bin/busybox date -u -s "@${arg#rv64.epoch=}" || exit 1;; esac
done
/bin/sh /usr/share/kuberoot/rv64-probe.sh >/dev/console 2>&1 &
exec /usr/sbin/kinit.real
""")
    probe = root / 'usr/share/kuberoot/rv64-probe.sh'
    text = probe.read_text().replace('echo RV64_NODE_READY\nset -e', 'echo RV64_NODE_READY\n/bin/busybox sleep 2\nset -e')
    text = text.replace('kubectl get nodes -o wide', """echo RV64_RECHECK_BEGIN
/bin/busybox date -u
until kubectl --request-timeout=120s get nodes -o wide; do
  echo RV64_RECHECK_RETRY
  /bin/busybox sleep 1
done
kubectl --request-timeout=120s get nodes -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' | /bin/busybox grep -q True || { echo RV64_PROBE_FAILED; exit 1; }
echo RV64_RECHECK_READY""", 1)
    text = text.replace('kubectl get pods -A\n', 'kubectl --request-timeout=120s get pods -A || { echo RV64_PROBE_FAILED; exit 1; }\n')
    probe.write_text(text)

# A lesson snapshot must include hydrated images and functional controllers,
# not merely the first kubelet Ready condition. Keep this opt-in for A/B replay.
if os.environ.get('RV64_PROBE_SETTLE') == '1':
    probe = root / 'usr/share/kuberoot/rv64-probe.sh'
    text = probe.read_text()
    text = text.replace('echo RV64_NODE_READY\n', '''echo RV64_SETTLE_BEGIN
# Retained kinit scales addon probe cadence as well as deadlines. Restore cadence.
kubectl --request-timeout=620s -n kube-system wait --for=create deployment/coredns --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=620s -n local-path-storage wait --for=create deployment/local-path-provisioner --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s -n kube-system patch deployment coredns --type=strategic -p '{"spec":{"template":{"spec":{"containers":[{"name":"coredns","readinessProbe":{"periodSeconds":10},"livenessProbe":{"periodSeconds":10,"initialDelaySeconds":60}}]}}}}' || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s -n local-path-storage patch deployment local-path-provisioner --type=strategic -p '{"spec":{"template":{"spec":{"containers":[{"name":"local-path-provisioner","startupProbe":{"periodSeconds":5,"initialDelaySeconds":5},"readinessProbe":{"periodSeconds":5,"initialDelaySeconds":5},"livenessProbe":{"periodSeconds":10,"initialDelaySeconds":10}}]}}}}' || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=620s -n kube-system rollout status deployment/coredns --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=620s -n local-path-storage rollout status deployment/local-path-provisioner --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=620s wait --for=condition=Ready pods --all -A --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s run rv64-warmup --image=docker.io/library/busybox:1.37.0 --image-pull-policy=Never --restart=Never -- /bin/sh -c 'sleep 3600' || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=620s wait --for=condition=Ready pod/rv64-warmup --timeout=600s || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s delete pod rv64-warmup --wait=true || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
kubectl --request-timeout=120s get pods -A || { diagnostics; echo RV64_PROBE_FAILED; exit 1; }
echo RV64_SETTLE_END
echo RV64_NODE_READY
''', 1)
    probe.write_text(text)

if os.environ.get('RV64_PROBE_CONSOLE') == '1':
    # Experimental isolated fixture only: lets the harness inspect a boot that
    # never reaches Node Ready, rather than losing all diagnostics at timeout.
    text = init.read_text().replace('exec /usr/sbin/kinit.real', '''export PATH=/usr/bin:/usr/sbin:/bin:/sbin
export KUBECONFIG=/etc/kubernetes/admin.kubeconfig
/bin/busybox sh -i </dev/console >/dev/console 2>&1 &
exec /usr/sbin/kinit.real''')
    init.write_text(text)
