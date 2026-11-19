// The course registry's images (04 §8.2, §11.4): small, real-looking images
// with their layers, config and platforms. Files that matter for lessons are
// real text (nginx.conf, index.html, app.py, /etc/passwd); binaries are
// weights. Digests are computed with WebCrypto from the layer contents, so a
// changed file gives a new digest, as in a real registry.

import { bin, dir, file, link, makeLayer, type Layer, type LayerFiles } from './layers';
import { canonicalJson, digestOf } from './util';

export interface ImageConfigBody {
  User?: string;
  Env?: string[];
  Entrypoint?: string[] | null;
  Cmd?: string[] | null;
  WorkingDir?: string;
  ExposedPorts?: Record<string, object>;
  Labels?: Record<string, string>;
  StopSignal?: string;
  Healthcheck?: { Test: string[]; Interval?: number; Retries?: number };
  Volumes?: Record<string, object>;
}

export interface HistoryEntry {
  created: string;
  created_by: string;
  empty_layer?: boolean;
  comment?: string;
}

/** The OCI image config (image-spec config.md), the document whose digest is the image ID. */
export interface ImageConfigDoc {
  architecture: string;
  os: string;
  variant?: string;
  created: string;
  config: ImageConfigBody;
  rootfs: { type: 'layers'; diff_ids: string[] };
  history: HistoryEntry[];
}

/** One platform variant of an image before it is turned into registry documents. */
export interface ImageVariant {
  platform: string;
  layers: Layer[];
  config: ImageConfigDoc;
}

export interface CatalogImage {
  repo: string;
  tags: string[];
  variants: ImageVariant[];
}

const BUSYBOX_APPLETS = ['sh', 'ash', 'ls', 'cat', 'echo', 'pwd', 'mkdir', 'rm', 'touch', 'cp', 'mv', 'grep', 'ps', 'hostname', 'env', 'id', 'sleep', 'uname', 'wget', 'nslookup', 'ping', 'top', 'kill', 'chmod', 'chown', 'ln', 'head', 'tail', 'wc', 'sed', 'vi', 'whoami', 'date', 'df', 'mount', 'true', 'false', 'printenv', 'which', 'tr', 'cut', 'sort', 'find', 'xargs', 'tee', 'stat', 'du'];

/** Commands a shell in an image of this family can run (busybox applets or coreutils). */
export const FAMILY_BINS: Record<string, string[]> = {
  busybox: BUSYBOX_APPLETS,
  alpine: [...BUSYBOX_APPLETS, 'apk'],
  debian: ['sh', 'bash', 'dash', 'ls', 'cat', 'echo', 'pwd', 'mkdir', 'rm', 'touch', 'cp', 'mv', 'grep', 'hostname', 'env', 'id', 'sleep', 'uname', 'chmod', 'chown', 'ln', 'head', 'tail', 'wc', 'sed', 'whoami', 'date', 'df', 'mount', 'true', 'false', 'printenv', 'which', 'tr', 'cut', 'sort', 'find', 'xargs', 'tee', 'stat', 'du', 'apt-get', 'useradd', 'su'],
  scratch: [],
};

const PASSWD_ALPINE = 'root:x:0:0:root:/root:/bin/sh\nbin:x:1:1:bin:/bin:/sbin/nologin\ndaemon:x:2:2:daemon:/sbin:/sbin/nologin\nnobody:x:65534:65534:nobody:/:/sbin/nologin\n';
const GROUP_ALPINE = 'root:x:0:root\nbin:x:1:root,bin,daemon\ndaemon:x:2:root,bin,daemon\nnogroup:x:65533:\nnobody:x:65534:\n';
const PASSWD_DEBIAN = 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n';
const GROUP_DEBIAN = 'root:x:0:\ndaemon:x:1:\nbin:x:2:\nnogroup:x:65534:\n';

function applets(prefix: string, names: string[], target: string): LayerFiles {
  const out: LayerFiles = {};
  for (const n of names) if (n !== 'busybox') out[`${prefix}/${n}`] = link(target);
  return out;
}

const T0 = '2026-10-08T12:00:00Z';

function alpineBase(arch: string): LayerFiles {
  return {
    '/bin': dir(),
    '/bin/busybox': bin(828_000, { text: `\x7fELF ${arch} busybox\n` }),
    ...applets('/bin', BUSYBOX_APPLETS.filter((a) => a !== 'apk'), '/bin/busybox'),
    '/sbin/apk': bin(176_000, { text: `\x7fELF ${arch} apk-tools\n` }),
    '/lib/ld-musl.so.1': bin(663_000, { text: `\x7fELF ${arch} musl\n` }),
    '/lib/apk/db/installed': file('P:alpine-baselayout\nP:busybox\nP:musl\nP:apk-tools\n', { size: 26_400 }),
    '/usr/lib/libcrypto.so.3': bin(4_400_000, { text: `\x7fELF ${arch} libcrypto\n` }),
    '/usr/lib/libssl.so.3': bin(1_200_000, { text: `\x7fELF ${arch} libssl\n` }),
    '/etc/alpine-release': file('3.22.2\n'),
    '/etc/os-release': file('NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.22.2\nPRETTY_NAME="Alpine Linux v3.22"\nHOME_URL="https://alpinelinux.org/"\n'),
    '/etc/passwd': file(PASSWD_ALPINE),
    '/etc/group': file(GROUP_ALPINE),
    '/etc/hostname': file('localhost\n'),
    '/etc/hosts': file('127.0.0.1\tlocalhost\n'),
    '/root': dir({ mode: 0o700 }),
    '/home': dir(),
    '/tmp': dir({ mode: 0o1777 }),
    '/var/log': dir(),
    '/usr/local/bin': dir(),
    '/proc': dir({ mode: 0o555 }),
    '/sys': dir({ mode: 0o555 }),
    '/dev': dir(),
  };
}

const DEBIAN_UTILS = ['ls', 'cat', 'echo', 'pwd', 'mkdir', 'rm', 'touch', 'cp', 'mv', 'grep', 'hostname', 'env', 'id', 'sleep', 'uname', 'chmod', 'chown', 'ln', 'head', 'tail', 'wc', 'sed', 'whoami', 'date', 'df', 'mount', 'true', 'false', 'printenv', 'which', 'tr', 'cut', 'sort', 'find', 'xargs', 'tee', 'stat', 'du', 'useradd', 'su'];

function debianBase(arch: string): LayerFiles {
  const utils: LayerFiles = {};
  for (const u of DEBIAN_UTILS) utils[`${['useradd'].includes(u) ? '/usr/sbin' : '/usr/bin'}/${u}`] = bin(['ls', 'cp', 'mv'].includes(u) ? 150_000 : 40_000, { text: `\x7fELF ${arch} ${u}\n` });
  return {
    ...utils,
    '/bin/bash': bin(1_265_000, { text: `\x7fELF ${arch} bash\n` }),
    '/bin/dash': bin(125_000, { text: `\x7fELF ${arch} dash\n` }),
    '/bin/sh': link('dash'),
    '/usr/bin/apt-get': bin(1_800_000, { text: `\x7fELF ${arch} apt\n` }),
    '/usr/lib/x86_64-linux-gnu/libc.so.6': bin(2_100_000, { text: `\x7fELF ${arch} glibc\n` }),
    '/usr/share/doc': dir(),
    '/usr/share/locale': file('(locale data)\n', { size: 9_800_000 }),
    '/usr/lib/coreutils': file('(coreutils, findutils, grep, sed, tar, util-linux…)\n', { size: 13_900_000 }),
    '/var/lib/dpkg/status': file('Package: base-files\nPackage: bash\nPackage: coreutils\nPackage: dash\nPackage: libc6\n', { size: 290_000 }),
    '/etc/debian_version': file('13.2\n'),
    '/etc/os-release': file('PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nNAME="Debian GNU/Linux"\nVERSION_ID="13"\nVERSION="13 (trixie)"\nID=debian\n'),
    '/etc/passwd': file(PASSWD_DEBIAN),
    '/etc/group': file(GROUP_DEBIAN),
    '/etc/hostname': file('localhost\n'),
    '/root': dir({ mode: 0o700 }),
    '/home': dir(),
    '/tmp': dir({ mode: 0o1777 }),
    '/var/log': dir(),
    '/proc': dir({ mode: 0o555 }),
    '/sys': dir({ mode: 0o555 }),
    '/dev': dir(),
  };
}

const NGINX_CONF = `user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    keepalive_timeout  65;
    include /etc/nginx/conf.d/*.conf;
}
`;

const NGINX_DEFAULT = `server {
    listen       80;
    listen  [::]:80;
    server_name  localhost;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
`;

export const NGINX_INDEX = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>
`;

const ENTRYPOINT_SH = `#!/bin/sh
# vim:sw=4:ts=4:et
set -e
entrypoint_log() {
    if [ -z "\${NGINX_ENTRYPOINT_QUIET_LOGS:-}" ]; then
        echo "$@"
    fi
}
if [ "$1" = "nginx" ] || [ "$1" = "nginx-debug" ]; then
    entrypoint_log "$0: Looking for shell scripts in /docker-entrypoint.d/"
    # ... runs every script in /docker-entrypoint.d/ ...
    entrypoint_log "$0: Configuration complete; ready for start up"
fi
exec "$@"
`;

export const TRAINER_API = `import json
import os
import socket
from http.server import BaseHTTPRequestHandler, HTTPServer

DB_HOST = os.environ["DB_HOST"]          # the address of the database: required
BIND = os.environ.get("BIND", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))

# the database must answer right now, or the API exits
socket.create_connection((DB_HOST, 5432), timeout=3).close()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"status": "ok", "db": DB_HOST}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)


print(f"api: listening on {BIND}:{PORT}, database at {DB_HOST}", flush=True)
HTTPServer((BIND, PORT), Handler).serve_forever()
`;

const TRAINER_API_SIGNALS = TRAINER_API.replace(
  'from http.server import BaseHTTPRequestHandler, HTTPServer\n',
  'import signal\nimport sys\nfrom http.server import BaseHTTPRequestHandler, HTTPServer\n',
).replace(
  'print(f"api: listening',
  'def stop(signum, frame):\n    print("api: got SIGTERM, closing connections", flush=True)\n    sys.exit(0)\n\n\nsignal.signal(signal.SIGTERM, stop)\nprint(f"api: listening',
);

export const TRAINER_WEB = `import os
from http.server import BaseHTTPRequestHandler, HTTPServer

BIND = os.environ.get("BIND", "127.0.0.1")   # where the server listens
PORT = int(os.environ.get("PORT", "8000"))


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"web: hello from the container")


print(f"web: listening on {BIND}:{PORT}", flush=True)
HTTPServer((BIND, PORT), Handler).serve_forever()
`;

export const TRAINER_LOGGER = `import os
import time

LOG_FILE = os.environ.get("LOG_FILE", "/var/log/app.log")
log = open(LOG_FILE, "a", buffering=1)
log.write("2026-11-18 09:01:02 started\\n")
while True:
    time.sleep(60)
`;

const PG_ENTRYPOINT = `#!/usr/bin/env bash
set -Eeo pipefail
# usage: docker-entrypoint.sh postgres
# initialises $PGDATA on the first start (needs POSTGRES_PASSWORD), then runs postgres
exec "$@"
`;

interface Recipe {
  repo: string;
  tags: string[];
  platforms: string[];
  /** Layers bottom-up: files and the instruction that created them. */
  layers: (arch: string) => { files: LayerFiles; by: string }[];
  /** History lines without a layer (ENV, CMD, …). */
  meta: string[];
  config: ImageConfigBody;
}

const archOf = (platform: string) => (platform.includes('arm64') ? 'aarch64' : platform.includes('386') ? 'i386' : 'x86_64');

const ALPINE_ENV = 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

const RECIPES: Recipe[] = [
  {
    repo: 'library/hello-world',
    tags: ['latest'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [{ files: { '/hello': bin(10_072, { text: `\x7fELF ${arch} hello\n` }) }, by: 'COPY hello / # buildkit' }],
    meta: ['CMD ["/hello"]'],
    config: { Env: [ALPINE_ENV], Cmd: ['/hello'], WorkingDir: '/' },
  },
  {
    repo: 'library/busybox',
    tags: ['1.37', 'latest'],
    platforms: ['linux/amd64', 'linux/arm64', 'linux/386'],
    layers: (arch) => [
      {
        files: {
          '/bin/busybox': bin(1_130_000, { text: `\x7fELF ${arch} busybox (static)\n` }),
          ...applets('/bin', [...BUSYBOX_APPLETS, 'httpd'], '/bin/busybox'),
          '/etc/passwd': file('root:x:0:0:root:/root:/bin/sh\nnobody:x:65534:65534:nobody:/home:/bin/false\n'),
          '/etc/group': file('root:x:0:\nnogroup:x:65534:\n'),
          '/root': dir({ mode: 0o700 }),
          '/tmp': dir({ mode: 0o1777 }),
          '/home': dir(),
          '/var/www': dir(),
          '/proc': dir({ mode: 0o555 }),
          '/sys': dir({ mode: 0o555 }),
          '/dev': dir(),
        },
        by: 'ADD busybox.tar.xz / # buildkit',
      },
    ],
    meta: ['CMD ["sh"]'],
    config: { Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'], Cmd: ['sh'] },
  },
  {
    repo: 'library/alpine',
    tags: ['3.22', 'latest'],
    platforms: ['linux/amd64', 'linux/arm64', 'linux/386'],
    layers: (arch) => [{ files: alpineBase(arch), by: 'ADD alpine-minirootfs-3.22.2-x86_64.tar.gz / # buildkit' }],
    meta: ['CMD ["/bin/sh"]'],
    config: { Env: [ALPINE_ENV], Cmd: ['/bin/sh'] },
  },
  {
    repo: 'library/nginx',
    tags: ['1.30-alpine', 'alpine', 'latest'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: alpineBase(arch), by: 'ADD alpine-minirootfs-3.22.2-x86_64.tar.gz / # buildkit' },
      {
        files: {
          '/usr/sbin/nginx': bin(1_620_000, { text: `\x7fELF ${arch} nginx/1.30.0\n` }),
          '/usr/lib/nginx/modules': dir(),
          '/etc/nginx/nginx.conf': file(NGINX_CONF),
          '/etc/nginx/mime.types': file('types {\n    text/html  html htm shtml;\n    text/css   css;\n    application/javascript js;\n}\n', { size: 5_349 }),
          '/etc/nginx/conf.d/default.conf': file(NGINX_DEFAULT),
          '/usr/share/nginx/html/index.html': file(NGINX_INDEX),
          '/usr/share/nginx/html/50x.html': file('<!DOCTYPE html>\n<html>\n<head><title>Error</title></head>\n<body><h1>An error occurred.</h1></body>\n</html>\n'),
          '/var/log/nginx/access.log': link('/dev/stdout'),
          '/var/log/nginx/error.log': link('/dev/stderr'),
          '/var/cache/nginx': dir(),
          '/etc/passwd': file(PASSWD_ALPINE + 'nginx:x:101:101:nginx:/var/cache/nginx:/sbin/nologin\n'),
          '/etc/group': file(GROUP_ALPINE + 'nginx:x:101:nginx\n'),
        },
        by: 'RUN /bin/sh -c set -x && addgroup -g 101 -S nginx && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx && apk add --no-cache nginx=1.30.0-r1 # buildkit',
      },
      { files: { '/docker-entrypoint.sh': file(ENTRYPOINT_SH, { mode: 0o755 }) }, by: 'COPY docker-entrypoint.sh / # buildkit' },
      {
        files: {
          '/docker-entrypoint.d/10-listen-on-ipv6-by-default.sh': file('#!/bin/sh\n# enables listen [::]:80 if IPv6 is available\n', { mode: 0o755, size: 2_125 }),
          '/docker-entrypoint.d/20-envsubst-on-templates.sh': file('#!/bin/sh\n# renders /etc/nginx/templates/*.template with envsubst\n', { mode: 0o755, size: 3_018 }),
          '/docker-entrypoint.d/30-tune-worker-processes.sh': file('#!/bin/sh\n# sets worker_processes from the cgroup CPU limit\n', { mode: 0o755, size: 4_620 }),
        },
        by: 'COPY docker-entrypoint.d/ /docker-entrypoint.d/ # buildkit',
      },
    ],
    meta: ['ENV NGINX_VERSION=1.30.0', 'ENTRYPOINT ["/docker-entrypoint.sh"]', 'EXPOSE map[80/tcp:{}]', 'STOPSIGNAL SIGQUIT', 'CMD ["nginx" "-g" "daemon off;"]'],
    config: {
      Env: [ALPINE_ENV, 'NGINX_VERSION=1.30.0'],
      Entrypoint: ['/docker-entrypoint.sh'],
      Cmd: ['nginx', '-g', 'daemon off;'],
      ExposedPorts: { '80/tcp': {} },
      StopSignal: 'SIGQUIT',
    },
  },
  {
    repo: 'library/python',
    tags: ['3.13-slim', '3.13-slim-trixie'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: debianBase(arch), by: '# debian.sh --arch amd64 out/ trixie @1762214400' },
      { files: { '/usr/lib/x86_64-linux-gnu/libssl.so.3': bin(3_600_000), '/etc/ssl/certs/ca-certificates.crt': file('(CA bundle)\n', { size: 220_000 }) }, by: 'RUN /bin/sh -c set -eux; apt-get update; apt-get install -y --no-install-recommends ca-certificates netbase tzdata; rm -rf /var/lib/apt/lists/* # buildkit' },
      {
        files: {
          '/usr/local/bin/python3.13': bin(16_000, { text: `\x7fELF ${arch} python3.13\n` }),
          '/usr/local/bin/python3': link('python3.13'),
          '/usr/local/bin/python': link('python3'),
          '/usr/local/bin/pip': bin(230, { text: '#!/usr/local/bin/python3.13\n# pip launcher\n' }),
          '/usr/local/lib/libpython3.13.so.1.0': bin(22_400_000),
          '/usr/local/lib/python3.13/stdlib': file('(standard library)\n', { size: 18_700_000 }),
          '/usr/local/lib/python3.13/site-packages/pip': file('(pip 25.3)\n', { size: 12_100_000 }),
        },
        by: 'RUN /bin/sh -c set -eux; savedAptMark=...; ./configure --enable-optimizations ...; make install # buildkit',
      },
    ],
    meta: ['ENV PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'ENV LANG=C.UTF-8', 'ENV PYTHON_VERSION=3.13.9', 'CMD ["python3"]'],
    config: { Env: ['PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG=C.UTF-8', 'PYTHON_VERSION=3.13.9'], Cmd: ['python3'] },
  },
  {
    repo: 'library/golang',
    tags: ['1.25', '1.25-trixie'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: debianBase(arch), by: '# debian.sh --arch amd64 out/ trixie @1762214400' },
      { files: { '/usr/bin/gcc': bin(1_400_000), '/usr/lib/gcc': file('(gcc, binutils, libc6-dev, make, git)\n', { size: 248_000_000 }), '/usr/bin/git': bin(4_200_000), '/usr/bin/make': bin(250_000) }, by: 'RUN /bin/sh -c set -eux; apt-get update; apt-get install -y --no-install-recommends g++ gcc libc6-dev make pkg-config git; rm -rf /var/lib/apt/lists/* # buildkit' },
      { files: { '/usr/local/go/bin/go': bin(14_800_000, { text: `\x7fELF ${arch} go1.25.4\n` }), '/usr/local/go/bin/gofmt': bin(3_600_000), '/usr/local/go/pkg': file('(the Go toolchain and standard library)\n', { size: 248_000_000 }), '/usr/local/bin/go': link('/usr/local/go/bin/go'), '/go': dir({ mode: 0o1777 }) }, by: 'COPY /target/ / # buildkit' },
    ],
    meta: ['ENV GOLANG_VERSION=1.25.4', 'ENV GOTOOLCHAIN=local', 'ENV GOPATH=/go', 'ENV PATH=/go/bin:/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'WORKDIR /go'],
    config: { Env: ['PATH=/go/bin:/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'GOLANG_VERSION=1.25.4', 'GOTOOLCHAIN=local', 'GOPATH=/go'], WorkingDir: '/go', Cmd: ['bash'] },
  },
  {
    repo: 'library/postgres',
    tags: ['17-alpine'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: alpineBase(arch), by: 'ADD alpine-minirootfs-3.22.2-x86_64.tar.gz / # buildkit' },
      {
        files: {
          '/usr/local/bin/postgres': bin(9_800_000, { text: `\x7fELF ${arch} postgres 17.6\n` }),
          '/usr/local/bin/psql': bin(820_000),
          '/usr/local/bin/initdb': bin(310_000),
          '/usr/local/bin/docker-entrypoint.sh': file(PG_ENTRYPOINT, { mode: 0o755, size: 12_224 }),
          '/usr/local/share/postgresql': file('(timezones, catalogs)\n', { size: 6_400_000 }),
          '/var/lib/postgresql/data': dir({ mode: 0o700, uid: 70, gid: 70 }),
          '/etc/passwd': file(PASSWD_ALPINE + 'postgres:x:70:70:PostgreSQL user:/var/lib/postgresql:/bin/sh\n'),
          '/etc/group': file(GROUP_ALPINE + 'postgres:x:70:\n'),
        },
        by: 'RUN /bin/sh -c set -eux; ./configure --prefix=/usr/local ...; make install-world # buildkit',
      },
    ],
    meta: ['ENV PG_MAJOR=17', 'ENV PGDATA=/var/lib/postgresql/data', 'VOLUME [/var/lib/postgresql/data]', 'ENTRYPOINT ["docker-entrypoint.sh"]', 'STOPSIGNAL SIGINT', 'EXPOSE map[5432/tcp:{}]', 'CMD ["postgres"]'],
    config: {
      Env: [ALPINE_ENV, 'PG_MAJOR=17', 'PGDATA=/var/lib/postgresql/data'],
      Entrypoint: ['docker-entrypoint.sh'],
      Cmd: ['postgres'],
      ExposedPorts: { '5432/tcp': {} },
      StopSignal: 'SIGINT',
      Volumes: { '/var/lib/postgresql/data': {} },
    },
  },
  {
    repo: 'trainer/api',
    tags: ['1.0'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: debianBase(arch), by: '# debian.sh --arch amd64 out/ trixie @1762214400' },
      { files: { '/usr/local/bin/python3.13': bin(16_000), '/usr/local/bin/python3': link('python3.13'), '/usr/local/bin/python': link('python3'), '/usr/local/lib/libpython3.13.so.1.0': bin(22_400_000), '/usr/local/lib/python3.13/stdlib': file('(standard library)\n', { size: 18_700_000 }) }, by: 'RUN /bin/sh -c make install # buildkit' },
      { files: { '/app': dir(), '/app/app.py': file(TRAINER_API) }, by: 'COPY app.py /app/ # buildkit' },
    ],
    meta: ['WORKDIR /app', 'EXPOSE map[8000/tcp:{}]', 'CMD ["python" "app.py"]'],
    config: { Env: ['PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG=C.UTF-8'], Cmd: ['python', 'app.py'], WorkingDir: '/app', ExposedPorts: { '8000/tcp': {} } },
  },
  {
    repo: 'trainer/api',
    tags: ['1.1'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: debianBase(arch), by: '# debian.sh --arch amd64 out/ trixie @1762214400' },
      { files: { '/usr/local/bin/python3.13': bin(16_000), '/usr/local/bin/python3': link('python3.13'), '/usr/local/bin/python': link('python3'), '/usr/local/lib/libpython3.13.so.1.0': bin(22_400_000), '/usr/local/lib/python3.13/stdlib': file('(standard library)\n', { size: 18_700_000 }) }, by: 'RUN /bin/sh -c make install # buildkit' },
      { files: { '/app': dir(), '/app/app.py': file(TRAINER_API_SIGNALS) }, by: 'COPY app.py /app/ # buildkit' },
    ],
    meta: ['WORKDIR /app', 'EXPOSE map[8000/tcp:{}]', 'CMD ["python" "app.py"]'],
    config: { Env: ['PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG=C.UTF-8'], Cmd: ['python', 'app.py'], WorkingDir: '/app', ExposedPorts: { '8000/tcp': {} } },
  },
  {
    repo: 'trainer/web',
    tags: ['1.0'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: debianBase(arch), by: '# debian.sh --arch amd64 out/ trixie @1762214400' },
      { files: { '/usr/local/bin/python3.13': bin(16_000), '/usr/local/bin/python3': link('python3.13'), '/usr/local/bin/python': link('python3'), '/usr/local/lib/libpython3.13.so.1.0': bin(22_400_000), '/usr/local/lib/python3.13/stdlib': file('(standard library)\n', { size: 18_700_000 }) }, by: 'RUN /bin/sh -c make install # buildkit' },
      { files: { '/app': dir(), '/app/web.py': file(TRAINER_WEB) }, by: 'COPY web.py /app/ # buildkit' },
    ],
    meta: ['WORKDIR /app', 'EXPOSE map[8000/tcp:{}]', 'CMD ["python" "web.py"]'],
    config: { Env: ['PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG=C.UTF-8'], Cmd: ['python', 'web.py'], WorkingDir: '/app', ExposedPorts: { '8000/tcp': {} } },
  },
  {
    repo: 'trainer/logger',
    tags: ['1.0'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: debianBase(arch), by: '# debian.sh --arch amd64 out/ trixie @1762214400' },
      { files: { '/usr/local/bin/python3.13': bin(16_000), '/usr/local/bin/python3': link('python3.13'), '/usr/local/bin/python': link('python3'), '/usr/local/lib/libpython3.13.so.1.0': bin(22_400_000), '/usr/local/lib/python3.13/stdlib': file('(standard library)\n', { size: 18_700_000 }) }, by: 'RUN /bin/sh -c make install # buildkit' },
      { files: { '/app': dir(), '/app/logger.py': file(TRAINER_LOGGER), '/var/log': dir() }, by: 'COPY logger.py /app/ # buildkit' },
    ],
    meta: ['WORKDIR /app', 'CMD ["python" "logger.py"]'],
    config: { Env: ['PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG=C.UTF-8'], Cmd: ['python', 'logger.py'], WorkingDir: '/app' },
  },
  {
    repo: 'trainer/worker',
    tags: ['1.0'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: alpineBase(arch), by: 'ADD alpine-minirootfs-3.22.2-x86_64.tar.gz / # buildkit' },
      { files: { '/usr/local/bin/worker': bin(6_200_000, { text: `\x7fELF ${arch} worker (needs ~90 MiB for its cache)\n` }), '/README': file('worker: keeps a 90 MiB cache in memory.\nRun it with at least --memory 128m.\n') }, by: 'COPY worker /usr/local/bin/ # buildkit' },
    ],
    meta: ['CMD ["worker"]'],
    config: { Env: [ALPINE_ENV], Cmd: ['worker'], Labels: { 'org.opencontainers.image.description': 'needs 128 MiB of memory' } },
  },
  {
    repo: 'trainer/tool',
    tags: ['1.0'],
    platforms: ['linux/arm64'],
    layers: (arch) => [
      { files: alpineBase(arch), by: 'ADD alpine-minirootfs-3.22.2-aarch64.tar.gz / # buildkit' },
      { files: { '/usr/local/bin/tool': bin(4_100_000, { text: `\x7fELF ${arch} tool\n` }) }, by: 'COPY tool /usr/local/bin/ # buildkit' },
    ],
    meta: ['CMD ["tool", "--version"]'],
    config: { Env: [ALPINE_ENV], Cmd: ['tool', '--version'] },
  },
  {
    repo: 'trainer/tool',
    tags: ['1.0-multiarch'],
    platforms: ['linux/amd64', 'linux/arm64'],
    layers: (arch) => [
      { files: alpineBase(arch), by: 'ADD alpine-minirootfs-3.22.2-x86_64.tar.gz / # buildkit' },
      { files: { '/usr/local/bin/tool': bin(4_100_000, { text: `\x7fELF ${arch} tool\n` }) }, by: 'COPY tool /usr/local/bin/ # buildkit' },
    ],
    meta: ['CMD ["tool", "--version"]'],
    config: { Env: [ALPINE_ENV], Cmd: ['tool', '--version'] },
  },
];

let built: Promise<CatalogImage[]> | null = null;

/** The catalog with real digests; computed once per page (WebCrypto is async). */
export function catalog(): Promise<CatalogImage[]> {
  built ??= buildCatalog();
  return built;
}

async function buildCatalog(): Promise<CatalogImage[]> {
  const out: CatalogImage[] = [];
  const layerCache = new Map<string, Layer>();
  for (const r of RECIPES) {
    const variants: ImageVariant[] = [];
    for (const platform of r.platforms) {
      const arch = archOf(platform);
      const layers: Layer[] = [];
      for (const l of r.layers(arch)) {
        const key = canonicalJson(l);
        let layer = layerCache.get(key);
        if (!layer) {
          layer = await makeLayer(l.files, l.by);
          layerCache.set(key, layer);
        }
        layers.push(layer);
      }
      const history: HistoryEntry[] = [...layers.map((l) => ({ created: T0, created_by: l.createdBy, comment: 'buildkit.dockerfile.v0' })), ...r.meta.map((m) => ({ created: T0, created_by: m, comment: 'buildkit.dockerfile.v0', empty_layer: true }))];
      const [os, cpu, variant] = platform.split('/');
      variants.push({
        platform,
        layers,
        config: {
          architecture: cpu,
          os,
          ...(variant ? { variant } : cpu === 'arm64' ? { variant: 'v8' } : {}),
          created: T0,
          config: r.config,
          rootfs: { type: 'layers', diff_ids: layers.map((l) => l.diffId) },
          history,
        },
      });
    }
    out.push({ repo: r.repo, tags: r.tags, variants });
  }
  return out;
}

export const MEDIA = {
  index: 'application/vnd.oci.image.index.v1+json',
  manifest: 'application/vnd.oci.image.manifest.v1+json',
  config: 'application/vnd.oci.image.config.v1+json',
  layer: 'application/vnd.oci.image.layer.v1.tar+gzip',
} as const;

export interface RegistryDocs {
  manifest: string;
  manifestDigest: string;
  configJson: string;
  configDigest: string;
}

/** The OCI manifest and config of one variant, as bytes and digests (image-spec manifest.md). */
export async function documentsOf(v: ImageVariant): Promise<RegistryDocs> {
  const configJson = canonicalJson(v.config);
  const configDigest = await digestOf(configJson);
  const manifest = JSON.stringify(
    {
      schemaVersion: 2,
      mediaType: MEDIA.manifest,
      config: { mediaType: MEDIA.config, digest: configDigest, size: configJson.length },
      layers: v.layers.map((l) => ({ mediaType: MEDIA.layer, digest: l.digest, size: l.csize })),
    },
    null,
    3,
  );
  return { manifest, manifestDigest: await digestOf(manifest), configJson, configDigest };
}

/** The index (image-spec image-index.md) of a multi-platform image. */
export function indexOf(entries: { platform: string; digest: string; size: number }[]): string {
  return JSON.stringify(
    {
      schemaVersion: 2,
      mediaType: MEDIA.index,
      manifests: entries.map((e) => {
        const [os, architecture, variant] = e.platform.split('/');
        return { mediaType: MEDIA.manifest, digest: e.digest, size: e.size, platform: { architecture, os, ...(variant ? { variant } : architecture === 'arm64' ? { variant: 'v8' } : {}) } };
      }),
    },
    null,
    3,
  );
}
