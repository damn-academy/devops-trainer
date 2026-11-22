#!/bin/sh
# Diagnostic only: actual kubectl, same API/auth, optional loopback HTTP hop.
# No kubeconfig edits, no replacement CLI, no persistent helper after this probe.
(
set -eu
kubectl proxy --address=127.0.0.1 --port=18001 >/tmp/rv64-client-proxy.log 2>&1 &
proxy=$!
trap 'kill "$proxy" 2>/dev/null || true' EXIT
attempt=0
until /bin/busybox wget -q -O /dev/null http://127.0.0.1:18001/readyz; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    /bin/busybox cat /tmp/rv64-client-proxy.log
    exit 1
  fi
  /bin/busybox sleep 1
done
for transport in direct proxy direct proxy; do
  echo "RV64_CLIENT_BEGIN=$transport"
  /bin/busybox cat /proc/uptime
  if [ "$transport" = proxy ]; then
    kubectl --server=http://127.0.0.1:18001 --request-timeout=30s get pods -A
  else
    kubectl --request-timeout=30s get pods -A
  fi
  /bin/busybox cat /proc/uptime
  echo "RV64_CLIENT_END=$transport"
done
)
