#!/usr/bin/env python3
"""Pod-only read-only range server for one test image, over loopback port-forward.
Usage in rv64-dev: python3 rv64-serve-media.py IMAGE PORT
No directory listing, writes, or non-loopback listener. Stop after the probe.
"""
import hashlib, http.server, json, os, pathlib, re, sys
assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
path = pathlib.Path(sys.argv[1]).resolve()
assert path.is_relative_to('/work/guest'), 'only public guest artifacts may be served'
size = path.stat().st_size
with path.open('rb') as f:
    digest = hashlib.file_digest(f, 'sha256').hexdigest()
class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    requests = 0
    transferred = 0
    def do_GET(self):
        if self.path.split('?')[0] != '/media':
            self.send_error(404); return
        match = re.fullmatch(r'bytes=(\d+)-(\d+)', self.headers.get('Range', ''))
        if not match:
            self.send_error(416); return
        start, end = map(int, match.groups())
        if not 0 <= start <= end < size or end-start >= 262144:
            self.send_error(416); return
        with path.open('rb') as f:
            f.seek(start); data = f.read(end-start+1)
        self.send_response(206)
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range')
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        self.end_headers(); self.wfile.write(data)
        Handler.requests += 1; Handler.transferred += len(data)
        if Handler.requests % 64 == 0: print(json.dumps(dict(requests=Handler.requests, transferred=Handler.transferred)), flush=True)
    def log_message(self, *_): pass
print(json.dumps(dict(bytes=size, version=digest)), flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), Handler).serve_forever()
