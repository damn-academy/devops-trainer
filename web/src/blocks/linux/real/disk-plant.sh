#!/usr/bin/env bash
# disk-plant.sh — DevOps Trainer, learning exam "The partition is full".
#
# Run it once, as root, on a fresh lab VM (Debian 12 or Ubuntu 24.04). It
# builds the shop's data partition and fills it the way a real server fills
# up. It never touches your system partitions: everything lives in a 160 MB
# file system kept in /var/lib/dt-trainer/shop.img, mounted at /srv/shop by
# /etc/fstab, as a separate disk would be.
#
# What it creates:
#   /srv/shop/lib/orders     the shop's data — it must survive the exam
#   /srv/shop/cache/build    build cache, safe to drop
#   /srv/shop/tmp            temporary files of past jobs
#   /srv/shop/log/legacy     logs of legacy-agent.service
#   /srv/shop/backups/legacy where /etc/cron.d/legacy-dump puts a 1 MB dump
#                            every two minutes
#   orders.service           the shop's application; it writes to /srv/shop/log
#   legacy-agent.service     an old agent with its log open
# and the fingerprint of the data in /var/lib/dt-trainer/disk.start, so that
# the check can tell whether the data is intact.
#
#   sudo bash disk-plant.sh

set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "disk-plant: run it as root (sudo)" >&2; exit 2; }
if mountpoint -q /srv/shop; then echo "disk-plant: /srv/shop is already mounted; the exam is planted" >&2; exit 1; fi

mkdir -p /var/lib/dt-trainer /srv/shop
img=/var/lib/dt-trainer/shop.img
fallocate -l 160M "$img"
mkfs.ext4 -q -F -m 0 -L shop "$img"
grep -q ' /srv/shop ' /etc/fstab || echo "$img /srv/shop ext4 loop,defaults 0 2" >> /etc/fstab
mount /srv/shop
mkdir -p /srv/shop/lib/orders /srv/shop/cache/build /srv/shop/tmp /srv/shop/log/legacy /srv/shop/backups/legacy

blob() { head -c "$2" /dev/urandom > "$1"; }

for i in $(seq 1 15); do blob "/srv/shop/cache/build/layer-$i.tar" 1M; done
for i in $(seq 1 10); do blob "/srv/shop/tmp/job-$((4100 + i)).tmp" 1M; done
touch -d '40 days ago' /srv/shop/tmp/*.tmp

cat > /usr/local/sbin/orders-app <<'SH'
#!/bin/bash
# The shop's application of the exam: it records a heartbeat every 30 seconds.
while true; do
  echo "$(date -Is) orders: heartbeat" >> /srv/shop/log/orders.log || echo "orders: cannot write to /srv/shop/log/orders.log" >&2
  sleep 30
done
SH
cat > /usr/local/sbin/legacy-agent <<'SH'
#!/bin/bash
# The old agent of the exam: it opens its debug log once and keeps it open.
exec 3>>/srv/shop/log/legacy/debug.log
echo "$(date -Is) legacy-agent: started" >&3
exec sleep infinity
SH
chmod 0755 /usr/local/sbin/orders-app /usr/local/sbin/legacy-agent

cat > /etc/systemd/system/orders.service <<'UNIT'
[Unit]
Description=Shop orders application
RequiresMountsFor=/srv/shop

[Service]
ExecStart=/usr/local/sbin/orders-app
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/legacy-agent.service <<'UNIT'
[Unit]
Description=Legacy reporting agent
RequiresMountsFor=/srv/shop

[Service]
ExecStart=/usr/local/sbin/legacy-agent

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now legacy-agent.service >/dev/null 2>&1
sleep 1
# 45 MB of debug output into the agent's open log, then the file is deleted
# by someone tidying up: the name is gone, the agent still holds the data.
head -c 45M /dev/zero | tr '\0' '.' >> /srv/shop/log/legacy/debug.log
rm -f /srv/shop/log/legacy/debug.log

cat > /etc/cron.d/legacy-dump <<'CRON'
# legacy reporting: a fresh dump every two minutes
*/2 * * * * root head -c 1M /dev/urandom > /srv/shop/backups/legacy/dump-$(date +\%s).bin
CRON

# The shop's data takes what is left, but a few hundred kilobytes.
i=0
while [ "$(df --output=avail -k /srv/shop | tail -1)" -gt 1536 ]; do
  i=$((i + 1))
  blob "/srv/shop/lib/orders/orders-$(printf %04d $i).db" 1M 2>/dev/null || break
done
echo "orders v3" > /srv/shop/lib/orders/VERSION

(cd /srv/shop/lib/orders && find . -type f -print | LC_ALL=C sort | while IFS= read -r f; do printf '%s ' "$f"; sha256sum < "$f"; done) | sha256sum | cut -d' ' -f1 > /var/lib/dt-trainer/disk.start
chmod 0600 /var/lib/dt-trainer/disk.start

systemctl enable --now orders.service >/dev/null 2>&1
df -h /srv/shop
echo "disk-plant: done. Monitoring says: /srv/shop is full. The exam starts now."
