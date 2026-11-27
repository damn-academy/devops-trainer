#!/bin/sh
# R6: sourced by the retained probe after RV64_CONFIG_CREATED.
rv64_diag_prefix() { /bin/busybox sed 's/^/RV64_DIAG /'; }
rv64_diag_uptime() { /bin/busybox awk '{print int($1)}' /proc/uptime; }
rv64_diag_processes() {
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    # argv[0], not truncated comm (kube-controller-manager exceeds 15 bytes).
    name=$(/bin/busybox tr '\000' '\n' < "$d/cmdline" 2>/dev/null | /bin/busybox head -1)
    name=${name##*/}
    case "$name" in
      kube-apiserver|kine|etcd|kubelet|containerd|kube-controller-manager|kube-scheduler|kuberoot-control|kuberoot-control.real)
        echo "process pid=${d##*/} executable=$name"
        /bin/busybox awk '/^(Name|State|VmRSS|Threads):/' "$d/status" 2>/dev/null
        # Start ticks disambiguate PID reuse. stat comm can contain spaces/parentheses.
        /bin/busybox sed 's/^.*) //' "$d/stat" 2>/dev/null | /bin/busybox awk '{print "start_ticks=" $20}'
        /bin/busybox readlink "$d/fd/2" 2>/dev/null || true
        ;;
    esac
  done
}
rv64_diag_sockets() {
  /bin/busybox awk '
    function hex(s, n,i) { n=0; s=toupper(s); for(i=1;i<=length(s);i++) n=n*16+index("0123456789ABCDEF",substr(s,i,1))-1; return n }
    FNR>1 && $4=="0A" { split($2,a,":"); print "listen table=" FILENAME " address_hex=" a[1] " port=" hex(a[2]) " inode=" $10 }
  ' /proc/net/tcp /proc/net/tcp6
}
rv64_diag_logs() {
  lines=$1
  # Source-confirmed kinit logPath(name); slim components share kuberoot-control.log.
  for service in kuberoot-control kube-apiserver kine etcd kubelet containerd kube-controller-manager kube-scheduler kube-proxy; do
    log=/var/log/kuberoot/$service.log
    if [ -f "$log" ]; then
      echo "log=$log last=$lines BEGIN"
      /bin/busybox tail -n "$lines" "$log"
      echo "log=$log END"
    else
      echo "log=$log unavailable (slim components may share kuberoot-control.log)"
    fi
  done
}
rv64_diag_run() {
  echo 'layout=slim components share a Go runtime/log; missing component PID is not proof of absence'
  while :; do
    now=$(rv64_diag_uptime)
    echo "snapshot BEGIN uptime=$now"
    rv64_diag_processes
    rv64_diag_sockets
    echo 'supervisor BEGIN (native restarts, state, pid, lastExit, logFile)'
    /bin/busybox timeout 10 /usr/bin/rv64-diag-status || echo 'supervisor unavailable (not zero restarts)'
    echo 'supervisor END'
    rv64_diag_logs 10
    # One outstanding request; a slow readyz must not block snapshots.
    if [ -f /run/rv64-diag-readyz-start ] && /bin/busybox mkdir /run/rv64-r15-readyz-lock 2>/dev/null; then
      (
        trap '/bin/busybox rmdir /run/rv64-r15-readyz-lock' EXIT
        if /bin/busybox timeout 660 kubectl --request-timeout=600s get --raw='/readyz?verbose'; then
          echo "readyz=success uptime=$(rv64_diag_uptime)"
        else
          echo "readyz=failed_or_timeout uptime=$(rv64_diag_uptime)"
        fi
      ) &
    fi
    echo "snapshot END uptime=$(rv64_diag_uptime)"
    /bin/busybox sleep 120
  done
}
(rv64_diag_run 2>&1 | rv64_diag_prefix) &
