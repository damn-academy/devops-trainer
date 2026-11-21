#!/usr/bin/env python3
"""Pod-only: instrument an extracted kuberoot root; keep the published media intact."""
import os
from pathlib import Path
assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
root = Path('/work/guest/kuberoot/root')
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
(
  while [ ! -S /run/containerd/containerd.sock ]; do /bin/busybox sleep 2; done
  for archive in /usr/share/kuberoot/rv64-images/*.tar; do
    ctr -n k8s.io images import "$archive" || exit 1
  done
  echo RV64_IMAGES_IMPORTED
) &
importer=$!
until kubectl --request-timeout=10s get nodes -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null | /bin/busybox grep -q True; do
  /bin/busybox sleep 10
done
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
wait "$importer"
echo RV64_POD_START_BEGIN
/bin/busybox cat /proc/uptime
kubectl run rv64-busybox --image=docker.io/library/busybox:1.37.0 --image-pull-policy=Never --restart=Never -- /bin/sh -c 'sleep 3600'
kubectl wait --for=condition=Ready pod/rv64-busybox --timeout=180s
/bin/busybox cat /proc/uptime
echo RV64_POD_START_END
kubectl get pods -A -o wide
echo RV64_PROBE_DONE
/bin/busybox sleep 100000
''')
profile = root / 'usr/share/kuberoot/profile.yaml'
profile.write_text(profile.read_text().replace('packages: true', 'packages: false'))
print('Installed console probe; kinit remains PID 1. Disabled remote package subscription in probe image only.')
