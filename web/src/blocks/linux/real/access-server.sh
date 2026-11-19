#!/usr/bin/env bash
# access-server.sh — DevOps Trainer, learning exam "Access for a new developer".
#
# Run it once, as root, on the machine you call "server". It prepares what a
# team server usually already has:
#   the group devs with the developer alex in it;
#   orders.service, the team's service (a placeholder that just runs);
#   password logins over SSH switched on in
#   /etc/ssh/sshd_config.d/10-trainer-password.conf, as on many old servers.
# Your own login keeps working: nothing else in SSH or sudo is changed.
#
#   sudo bash access-server.sh

set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "access-server: run it as root (sudo)" >&2; exit 2; }

getent group devs >/dev/null || groupadd devs
id alex >/dev/null 2>&1 || useradd -m -s /bin/bash -G devs alex

cat > /etc/systemd/system/orders.service <<'UNIT'
[Unit]
Description=Team orders service

[Service]
ExecStart=/bin/sleep infinity

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now orders.service >/dev/null 2>&1

mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/10-trainer-password.conf <<'CONF'
# DevOps Trainer: the server lets people in with passwords, as many old servers do.
PasswordAuthentication yes
KbdInteractiveAuthentication yes
CONF
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd
echo "access-server: done. Group devs: $(getent group devs | cut -d: -f4). Password logins: on."
