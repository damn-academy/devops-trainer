#!/usr/bin/env bash
# trainer-check-host.sh — DevOps Trainer, exams on your own machines.
#
# READ-ONLY. The script changes nothing on this machine. It reads files and
# the output of status commands (ip, ss, nft, systemctl show, sshd -T, ...),
# and, only for the probes you pass on the command line, opens a connection
# to the address you named (ping, a TCP connect, one HTTP request, one
# `ssh ... true` as the user you named). It sends nothing to the trainer:
# it prints one block of text, and you paste that block into the trainer
# yourself. Read it to the end before running it.
#
# What it always collects: the hostname, the kernel version, the OS name,
# the user and group lists (getent passwd, getent group: names, ids, shells,
# members; no passwords: /etc/shadow is never read) and the process list
# (ps). Everything else only when asked:
#
#   --scope net        ip addr/route, ip_forward, listening sockets (ss),
#                      nft list ruleset, iptables-save, wg show dump
#                      (WireGuard private and preshared keys are cut out)
#   --scope nginx      nginx -T (the whole configuration) and nginx -t
#   --scope sshd       sshd -T (the effective server settings)
#   --scope mounts     findmnt and df: what is mounted where, size and free
#   --scope journald   systemd-analyze cat-config systemd/journald.conf
#   --scope sudoers    visudo -c (only whether the sudoers files parse)
#   --file PATH        type, mode, owner, group, size; the text of a regular
#                      file up to 64 KiB (the last 64 KiB of a bigger one)
#   --tree DIR         one sha256 over the names and contents of DIR's files
#   --unit NAME        systemctl show NAME (state, User, limits, restarts)
#                      and its cgroup files memory.max, pids.max, cpu.weight
#   --sudo-l USER      sudo -l -U USER (what USER may run with sudo)
#   --logrotate FILE   logrotate -d FILE (a dry run: rotates nothing)
#   --icmp ID,HOST              ping -c 3 HOST
#   --tcp ID,HOST,PORT          a TCP connect to HOST:PORT, closed at once
#   --http ID,URL[,resolve=HOST:PORT:ADDR][,cacert=FILE][,timeout=SECONDS]
#                               one GET with curl: status code, time, 2 KiB of body
#   --ssh ID,USER,HOST          as USER: ssh -o BatchMode=yes HOST true, and
#                               which login methods HOST offers without a key
#
# Usage (as root, so that nft, sshd -T and nginx -T can read their configs):
#   sudo bash trainer-check-host.sh --nonce CODE --machine vm1 --track net-b \
#       --scope net --file /etc/hosts --tcp web,10.0.0.2,80
#
# Needs: bash, coreutils, gzip, base64; the tools of the scopes you ask for.

set -u

nonce=""
machine=""
track=""
scopes=" "
files=()
trees=()
units=()
sudo_users=()
rotates=()
probes=()

die() { echo "trainer-check-host: $*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --nonce) nonce="${2:-}"; shift 2 ;;
    --machine) machine="${2:-}"; shift 2 ;;
    --track) track="${2:-}"; shift 2 ;;
    --scope) scopes="$scopes${2:-} "; shift 2 ;;
    --file) files+=("${2:-}"); shift 2 ;;
    --tree) trees+=("${2:-}"); shift 2 ;;
    --unit) units+=("${2:-}"); shift 2 ;;
    --sudo-l) sudo_users+=("${2:-}"); shift 2 ;;
    --logrotate) rotates+=("${2:-}"); shift 2 ;;
    --icmp|--tcp|--http|--ssh) probes+=("${1#--}:${2:-}"); shift 2 ;;
    -h|--help) sed -n '2,45p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$nonce" ] || die "--nonce is required (the one-time code shown in the trainer)"
[ -n "$machine" ] || die "--machine is required (vm1, vm2, server, ...: the name the trainer uses)"
for tool in gzip base64; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed"
done

has_scope() { case "$scopes" in *" $1 "*) return 0 ;; esac; return 1; }
have() { command -v "$1" >/dev/null 2>&1; }

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

# out CMD... — the command's stdout and stderr, or nothing if it is not installed.
out() { have "$1" && "$@" 2>&1; }

first=1
# field KEY TEXT — one "key": "text" member of the current object.
field() {
  [ $first -eq 1 ] || printf ','
  first=0
  printf '%s:%s' "$(jstr "$1")" "$(jstr "$2")"
}

file_fact() {
  local p="$1" kind mode owner group size text=""
  if [ ! -e "$p" ] && [ ! -L "$p" ]; then
    printf '{"exists":false}'
    return
  fi
  if [ -L "$p" ]; then kind=l; elif [ -d "$p" ]; then kind=d; elif [ -f "$p" ]; then kind=f; else kind=c; fi
  mode="$(stat -c %a "$p" 2>/dev/null || echo '')"
  owner="$(stat -c %U "$p" 2>/dev/null || echo '')"
  group="$(stat -c %G "$p" 2>/dev/null || echo '')"
  size="$(stat -c %s "$p" 2>/dev/null || echo 0)"
  if [ "$kind" = f ] && [ -r "$p" ]; then text="$(tail -c 65536 "$p" 2>/dev/null | tr -d '\000')"; fi
  printf '{"exists":true,"type":"%s","mode":%s,"owner":%s,"group":%s,"size":%s' "$kind" "$(jstr "$mode")" "$(jstr "$owner")" "$(jstr "$group")" "${size:-0}"
  [ "$kind" = l ] && printf ',"target":%s' "$(jstr "$(readlink "$p")")"
  [ "$kind" = f ] && printf ',"text":%s' "$(jstr "$text")"
  printf '}'
}

tree_hash() {
  local d="$1"
  [ -d "$d" ] || { printf ''; return; }
  (cd "$d" && find . -type f -print | LC_ALL=C sort | while IFS= read -r f; do printf '%s ' "$f"; sha256sum < "$f"; done) | sha256sum | cut -d' ' -f1
}

unit_fact() {
  local u="$1" cg=""
  printf '{"show":%s' "$(jstr "$(out systemctl show "$u" -p Id,ActiveState,SubState,UnitFileState,User,MemoryMax,TasksMax,CPUWeight,OOMScoreAdjust,NRestarts,ExecMainPID,ExecStart,FragmentPath,DropInPaths,ControlGroup)")"
  cg="$(systemctl show "$u" -p ControlGroup --value 2>/dev/null || true)"
  if [ -n "$cg" ] && [ -d "/sys/fs/cgroup$cg" ]; then
    printf ',"cgroup":%s' "$(jstr "$cg")"
    for k in memory.max memory.events pids.max cpu.weight; do
      [ -r "/sys/fs/cgroup$cg/$k" ] && printf ',%s:%s' "$(jstr "$k")" "$(jstr "$(cat "/sys/fs/cgroup$cg/$k")")"
    done
  fi
  printf '}'
}

probe() {
  local kind="${1%%:*}" spec="${1#*:}" rest
  rest="${spec#*,}"
  case "$kind" in
    icmp)
      local o
      o="$(ping -c 3 -W 2 "$rest" 2>&1)"
      printf '{"kind":"icmp","to":%s,"received":%s}' "$(jstr "$rest")" "$(printf '%s' "$o" | sed -n 's/.* \([0-9]*\) \(packets \)\{0,1\}received.*/\1/p' | head -1 | grep . || echo 0)"
      ;;
    tcp)
      local host="${rest%%,*}" port="${rest#*,}" res
      if timeout 5 bash -c "exec 3<>/dev/tcp/$host/$port" 2>/dev/null; then res='"connected":true'
      else
        local e=$?
        if [ $e -eq 124 ]; then res='"connected":false,"error":"timeout"'; else res='"connected":false,"error":"refused"'; fi
      fi
      printf '{"kind":"tcp","to":%s,"port":%s,%s}' "$(jstr "$host")" "${port:-0}" "$res"
      ;;
    http)
      local url="${rest%%,*}" opts="" args=() t=20 body code
      [ "$url" = "$rest" ] || opts="${rest#*,}"
      local IFS_OLD="$IFS"; IFS=','
      for o in $opts; do
        case "$o" in
          resolve=*) args+=(--resolve "${o#resolve=}") ;;
          cacert=*) args+=(--cacert "${o#cacert=}") ;;
          timeout=*) t="${o#timeout=}" ;;
        esac
      done
      IFS="$IFS_OLD"
      body="$(mktemp)"
      code="$(curl -sS -o "$body" -w '%{http_code} %{time_total}' --max-time "$t" ${args[@]+"${args[@]}"} "$url" 2>"$body.err")"
      printf '{"kind":"http","to":%s,"status":%s,"seconds":%s,"body":%s,"error":%s}' "$(jstr "$url")" "$((10#${code%% *}))" "$(jstr "${code#* }")" "$(jstr "$(head -c 2048 "$body" | tr -d '\000')")" "$(jstr "$(head -c 300 "$body.err")")"
      rm -f "$body" "$body.err"
      ;;
    ssh)
      local user="${rest%%,*}" host="${rest#*,}" code methods
      sudo -u "$user" ssh -o BatchMode=yes -o ConnectTimeout=5 "$host" true </dev/null >/dev/null 2>&1
      code=$?
      methods="$(sudo -u "$user" ssh -v -o BatchMode=yes -o ConnectTimeout=5 -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive "$host" true </dev/null 2>&1 | grep 'Authentications that can continue' | tail -1)"
      printf '{"kind":"ssh","to":%s,"user":%s,"exit":%s,"methods":%s}' "$(jstr "$host")" "$(jstr "$user")" "$code" "$(jstr "$methods")"
      ;;
  esac
}

payload() {
  printf '{"schema":"dt.host-check/v1","nonce":%s,"machine":%s,"track":%s,' "$(jstr "$nonce")" "$(jstr "$machine")" "$(jstr "$track")"
  printf '"collectedAt":%s,"whoami":%s,' "$(jstr "$(date -u +%Y-%m-%dT%H:%M:%SZ)")" "$(jstr "$(id -un)")"
  printf '"hostname":%s,"kernel":%s,' "$(jstr "$(hostname)")" "$(jstr "$(uname -r)")"
  printf '"os":%s,' "$(jstr "$(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-}")")"

  printf '"raw":{'
  first=1
  field passwd "$(getent passwd 2>/dev/null | cut -d: -f1,3,4,6,7)"
  field group "$(getent group 2>/dev/null)"
  field ps "$(ps -eo pid=,ppid=,user=,comm=,args= 2>/dev/null)"
  if has_scope net; then
    field ip_addr "$(out ip -j addr)"
    field ip_route "$(out ip -j route)"
    field ip_forward "$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null)"
    field ss "$(out ss -Htlnup)"
    field nft "$(out nft list ruleset)"
    field iptables "$(out iptables-save)"
    # wg show all dump: interface lines (5 fields) carry the private key in
    # field 2, peer lines the preshared key in field 3; both become "(hidden)".
    field wg "$(out wg show all dump | awk 'BEGIN{FS=OFS="\t"} NF==5 {$2="(hidden)"} NF>=9 {$3="(hidden)"} {print}')"
  fi
  if has_scope nginx; then
    field nginx_T "$(out nginx -T)"
    field nginx_t "$(out nginx -t; echo "exit=$?")"
  fi
  has_scope sshd && field sshd_T "$(out sshd -T)"
  if has_scope mounts; then
    field findmnt "$(out findmnt -rn -o SOURCE,TARGET,FSTYPE,OPTIONS)"
    field df "$(out df -kP)"
  fi
  has_scope journald && field journald "$(out systemd-analyze cat-config systemd/journald.conf)"
  has_scope sudoers && field visudo "$(out visudo -c; echo "exit=$?")"
  for u in ${sudo_users[@]+"${sudo_users[@]}"}; do field "sudo_l:$u" "$(out sudo -l -U "$u")"; done
  for r in ${rotates[@]+"${rotates[@]}"}; do field "logrotate:$r" "$(out logrotate -d "$r")"; done
  printf '},'

  printf '"files":{'
  first=1
  for p in ${files[@]+"${files[@]}"}; do
    [ $first -eq 1 ] || printf ','
    first=0
    printf '%s:' "$(jstr "$p")"
    file_fact "$p"
  done
  printf '},"trees":{'
  first=1
  for d in ${trees[@]+"${trees[@]}"}; do field "$d" "$(tree_hash "$d")"; done
  printf '},"units":{'
  first=1
  for u in ${units[@]+"${units[@]}"}; do
    [ $first -eq 1 ] || printf ','
    first=0
    printf '%s:' "$(jstr "$u")"
    unit_fact "$u"
  done
  printf '},"probes":{'
  first=1
  for p in ${probes[@]+"${probes[@]}"}; do
    [ $first -eq 1 ] || printf ','
    first=0
    local_id="${p#*:}"
    printf '%s:' "$(jstr "${local_id%%,*}")"
    probe "$p"
  done
  printf '}}'
}

echo "-----BEGIN TRAINER FACTS-----"
payload | gzip -9 | base64 | fold -w 76
echo "-----END TRAINER FACTS-----"
echo "trainer-check-host: copy everything between the BEGIN and END lines, including them, into the trainer." >&2
