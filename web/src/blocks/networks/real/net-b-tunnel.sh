#!/usr/bin/env bash
# net-b-tunnel.sh — DevOps Trainer, Networks exam, part B: the tunnel.
#
# Run it on vm1 and on vm2. It installs wireguard-tools if needed and builds
# the tunnel 10.99.0.0/24 between the two machines: vm1 is 10.99.0.1, vm2 is
# 10.99.0.2, UDP port 51820. It changes only /etc/wireguard and the unit
# wg-quick@wg0.
#
#   1. sudo bash net-b-tunnel.sh vm1          (prints vm1's public key)
#      sudo bash net-b-tunnel.sh vm2          (prints vm2's public key)
#   2. sudo bash net-b-tunnel.sh vm1 VM2_ADDRESS VM2_PUBLIC_KEY
#      sudo bash net-b-tunnel.sh vm2 VM1_ADDRESS VM1_PUBLIC_KEY
#
# The private keys never leave their machines. On vm2 the tunnel accepts any
# destination (AllowedIPs = 0.0.0.0/0) but adds no routes (Table = off):
# what goes into wg0 is decided by vm2's routing table, which is yours.

set -euo pipefail

role="${1:-}"
peer="${2:-}"
peer_key="${3:-}"
case "$role" in
  vm1) me=10.99.0.1; allowed=10.99.0.2/32; table="" ;;
  vm2) me=10.99.0.2; allowed=0.0.0.0/0; table="Table = off" ;;
  *) echo "usage: sudo bash net-b-tunnel.sh vm1|vm2 [PEER_ADDRESS PEER_PUBLIC_KEY]" >&2; exit 2 ;;
esac
[ "$(id -u)" -eq 0 ] || { echo "net-b-tunnel: run it as root (sudo)" >&2; exit 2; }

if ! command -v wg >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq wireguard-tools >/dev/null
fi

umask 077
mkdir -p /etc/wireguard
[ -s /etc/wireguard/private.key ] || wg genkey > /etc/wireguard/private.key
wg pubkey < /etc/wireguard/private.key > /etc/wireguard/public.key

if [ -z "$peer" ] || [ -z "$peer_key" ]; then
  echo "The public key of $role (give it to the other machine):"
  cat /etc/wireguard/public.key
  exit 0
fi

cat > /etc/wireguard/wg0.conf <<CONF
# Written by net-b-tunnel.sh (DevOps Trainer, dt-track=net-b).
[Interface]
Address = $me/24
ListenPort = 51820
PostUp = wg set %i private-key /etc/wireguard/private.key
$table

[Peer]
PublicKey = $peer_key
Endpoint = $peer:51820
AllowedIPs = $allowed
PersistentKeepalive = 25
CONF

systemctl enable wg-quick@wg0 >/dev/null 2>&1
systemctl restart wg-quick@wg0
wg show wg0
echo "net-b-tunnel: wg0 is up on $role ($me). Check with: ping -c 3 10.99.0.$([ "$role" = vm1 ] && echo 2 || echo 1)"
