#!/usr/bin/env bash
# net-b-app.sh — DevOps Trainer, Networks exam, part B: the application on vm2.
#
# Run it on vm2 after the tunnel is up. It installs two small services:
#   dt-stub.service      the "orders" application, http://10.99.0.2:8080/ — it
#                        listens on the tunnel address only. GET / answers at
#                        once; GET /report takes as many seconds as
#                        /etc/dt-stub/delay says (3 by default).
#   dt-exporter.service  a metrics endpoint on port 9100 of every interface,
#                        as monitoring agents usually do.
# and the command dt-stub-delay SECONDS, which changes the report's delay.
# Files: /opt/dt-stub, /etc/dt-stub, /etc/systemd/system/dt-*.service,
# /usr/local/sbin/dt-stub-delay.
#
#   sudo bash net-b-app.sh

set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "net-b-app: run it as root (sudo)" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 >/dev/null; }

mkdir -p /opt/dt-stub /etc/dt-stub
[ -s /etc/dt-stub/delay ] || echo 3 > /etc/dt-stub/delay

cat > /opt/dt-stub/app.py <<'PY'
# The lab application of DevOps Trainer (dt-track=net-b).
import json, socket, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODE, HOST, PORT = sys.argv[1], sys.argv[2], int(sys.argv[3])

def delay():
    try:
        with open('/etc/dt-stub/delay') as f:
            return float(f.read().strip() or 0)
    except OSError:
        return 0.0

class H(BaseHTTPRequestHandler):
    def reply(self, code, body, kind='application/json'):
        data = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if MODE == 'exporter':
            return self.reply(200, 'dt_stub_up 1\n', 'text/plain')
        if self.path.startswith('/report'):
            time.sleep(delay())
            return self.reply(200, json.dumps({'report': 'ready', 'host': socket.gethostname()}) + '\n')
        if self.path.startswith('/health'):
            return self.reply(200, '{"status":"ok"}\n')
        return self.reply(200, json.dumps({'service': 'orders', 'status': 'ok', 'host': socket.gethostname()}) + '\n')

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))

ThreadingHTTPServer((HOST, PORT), H).serve_forever()
PY

cat > /etc/systemd/system/dt-stub.service <<'UNIT'
[Unit]
Description=DevOps Trainer lab application (orders)
After=network-online.target wg-quick@wg0.service
Wants=network-online.target

[Service]
ExecStart=/usr/bin/python3 /opt/dt-stub/app.py app 10.99.0.2 8080
Restart=always
RestartSec=5
DynamicUser=yes

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/dt-exporter.service <<'UNIT'
[Unit]
Description=DevOps Trainer lab metrics endpoint
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /opt/dt-stub/app.py exporter 0.0.0.0 9100
Restart=always
DynamicUser=yes

[Install]
WantedBy=multi-user.target
UNIT

cat > /usr/local/sbin/dt-stub-delay <<'SH'
#!/bin/sh
# dt-stub-delay SECONDS — how long GET /report of the lab application takes.
[ -n "${1:-}" ] || { echo "usage: dt-stub-delay SECONDS (now: $(cat /etc/dt-stub/delay))" >&2; exit 2; }
echo "$1" > /etc/dt-stub/delay && echo "GET /report now takes $1 s"
SH
chmod 0755 /usr/local/sbin/dt-stub-delay

systemctl daemon-reload
systemctl enable --now dt-stub.service dt-exporter.service >/dev/null 2>&1
sleep 1
systemctl --no-pager --lines=0 status dt-stub.service dt-exporter.service || true
echo "net-b-app: done. From vm1: curl http://10.99.0.2:8080/"
