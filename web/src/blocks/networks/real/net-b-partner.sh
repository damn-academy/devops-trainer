#!/usr/bin/env bash
# net-b-partner.sh — DevOps Trainer, Networks exam, part B: the machine "probe".
#
# probe plays the outside world. This script gives it:
#   dt-partner.service  the partner's API on port 8081: GET / answers with the
#                       address the request came from, and nothing else.
#   /root/ca            a training certificate authority (ca.crt, ca.key),
#                       valid for 30 days; trust ca.crt to check the portal.
#   dt-ca-sign FILE.csr signs a certificate request with that CA and prints
#                       the certificate (subjectAltName = the request's CN).
# Files: /opt/dt-partner, /root/ca, /etc/systemd/system/dt-partner.service,
# /usr/local/sbin/dt-ca-sign.
#
#   sudo bash net-b-partner.sh

set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "net-b-partner: run it as root (sudo)" >&2; exit 2; }
for p in python3 openssl curl; do
  command -v "$p" >/dev/null 2>&1 || { apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$p" >/dev/null; }
done

mkdir -p /opt/dt-partner
cat > /opt/dt-partner/partner.py <<'PY'
# The partner API of DevOps Trainer (dt-track=net-b): it answers with the caller's address.
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        data = (self.client_address[0] + '\n').encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

ThreadingHTTPServer(('0.0.0.0', 8081), H).serve_forever()
PY

cat > /etc/systemd/system/dt-partner.service <<'UNIT'
[Unit]
Description=DevOps Trainer lab partner API
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /opt/dt-partner/partner.py
Restart=always
DynamicUser=yes

[Install]
WantedBy=multi-user.target
UNIT

umask 077
mkdir -p /root/ca
if [ ! -s /root/ca/ca.crt ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=DevOps Trainer lab CA" \
    -keyout /root/ca/ca.key -out /root/ca/ca.crt 2>/dev/null
fi
chmod 0644 /root/ca/ca.crt

cat > /usr/local/sbin/dt-ca-sign <<'SH'
#!/bin/sh
# dt-ca-sign FILE.csr — sign a certificate request with the training CA in /root/ca.
set -eu
csr="${1:?usage: dt-ca-sign FILE.csr}"
cn="$(openssl req -in "$csr" -noout -subject -nameopt multiline | sed -n 's/^ *commonName *= *//p')"
[ -n "$cn" ] || { echo "dt-ca-sign: the request has no CN" >&2; exit 2; }
ext="$(mktemp)"
printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\n' "$cn" > "$ext"
openssl x509 -req -in "$csr" -CA /root/ca/ca.crt -CAkey /root/ca/ca.key -CAcreateserial -days 30 -extfile "$ext" 2>/dev/null
rm -f "$ext"
SH
chmod 0755 /usr/local/sbin/dt-ca-sign

systemctl daemon-reload
systemctl enable --now dt-partner.service >/dev/null 2>&1
echo "net-b-partner: done. The partner API: http://$(hostname -I | cut -d' ' -f1):8081/ ; the CA: /root/ca/ca.crt"
