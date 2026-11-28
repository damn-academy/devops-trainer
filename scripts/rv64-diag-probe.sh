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
rv64_diag_quit() {
  # Prefer a standalone apiserver. In slim, its Go runtime is kuberoot-control.real.
  standalone= combined=
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    name=$(/bin/busybox tr '\000' '\n' < "$d/cmdline" 2>/dev/null | /bin/busybox head -1)
    case "${name##*/}" in
      kube-apiserver) standalone=${d##*/} ;;
      kuberoot-control.real|kuberoot-control) combined=${d##*/} ;;
    esac
  done
  target=$standalone
  if [ -z "$target" ] && /bin/busybox grep -q '"kube-apiserver"' /etc/kubernetes/components.json; then
    target=$combined
  fi
  if [ -z "$target" ]; then echo 'SIGQUIT skipped: no apiserver runtime found'; return 1; fi
  # Recheck argv immediately before signalling; never use broad pkill matching.
  name=$(/bin/busybox tr '\000' '\n' < "/proc/$target/cmdline" 2>/dev/null | /bin/busybox head -1)
  case "${name##*/}" in kube-apiserver|kuberoot-control.real|kuberoot-control) ;; *) echo 'SIGQUIT skipped: process changed'; return 1 ;; esac
  echo "SIGQUIT pid=$target executable=$name uptime=$(rv64_diag_uptime) induced_exit_expected=1"
  kill -QUIT "$target" || return
  /bin/busybox sleep 10
  case "${name##*/}" in
    kube-apiserver) log=/var/log/kuberoot/kube-apiserver.log ;;
    *) log=/var/log/kuberoot/kuberoot-control.log ;;
  esac
  echo "SIGQUIT log=$log last=400 BEGIN"
  /bin/busybox tail -n 400 "$log" || echo "SIGQUIT log unavailable: $log"
  echo 'SIGQUIT log END'
  return 0
}
rv64_diag_failed() {
  [ -n "$failed_since" ] || failed_since=$attempt_start
  now=$(rv64_diag_uptime)
  if [ "$quit_done" = 0 ] && [ "$((now - failed_since))" -ge 600 ]; then
    if rv64_diag_quit; then quit_done=1; fi
  fi
}
rv64_diag_run() {
  failed_since= quit_done=0
  echo 'layout=slim components share a Go runtime/log; missing component PID is not proof of absence'
  while :; do
    now=$(rv64_diag_uptime)
    echo "snapshot BEGIN uptime=$now"
    rv64_diag_processes
    rv64_diag_sockets
    echo 'supervisor BEGIN (native restarts, state, pid, lastExit, logFile)'
    /bin/busybox timeout 10 /usr/bin/rv64-diag-status || echo 'supervisor unavailable (not zero restarts)'
    echo 'supervisor END'
    rv64_diag_logs 40
    if [ -f /run/rv64-diag-readyz-start ]; then
      attempt_start=$(rv64_diag_uptime)
      if /bin/busybox timeout 15 kubectl --request-timeout=5s get --raw='/readyz?verbose'; then
        echo 'readyz=success'
        failed_since=
      else
        echo "readyz=failed_or_timeout uptime=$(rv64_diag_uptime)"
        rv64_diag_failed
      fi
    fi
    echo "snapshot END uptime=$(rv64_diag_uptime)"
    /bin/busybox sleep 60
  done
}
(rv64_diag_run 2>&1 | rv64_diag_prefix) &
