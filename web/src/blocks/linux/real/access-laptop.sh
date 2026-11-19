#!/usr/bin/env bash
# access-laptop.sh — DevOps Trainer, learning exam "Access for a new developer".
#
# Run it once, as root, on the machine you call "laptop", with the address of
# "server". It creates maria's account (no keys yet) and adds the name
# "server" to /etc/hosts, so that `ssh server` works from here.
#
#   sudo bash access-laptop.sh SERVER_ADDRESS

set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "access-laptop: run it as root (sudo)" >&2; exit 2; }
addr="${1:?usage: sudo bash access-laptop.sh SERVER_ADDRESS}"

id maria >/dev/null 2>&1 || useradd -m -s /bin/bash maria
sed -i '/[[:space:]]server$/d' /etc/hosts
echo "$addr server" >> /etc/hosts
echo "access-laptop: done. Work as maria with: sudo -iu maria"
