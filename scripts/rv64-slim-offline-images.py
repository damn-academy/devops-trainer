#!/usr/bin/env python3
"""Pod-only: preload the slim fixture's exact riscv64 addon images.
Modifies only RV64_PROBE_ROOT (an extracted experimental root), not publications.
Archives are verified against platform digests; offline addons use their imported tags.
"""
import json
import os
import re
from pathlib import Path
import subprocess
import tarfile

assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
root = Path(os.environ['RV64_PROBE_ROOT'])
images = root / 'usr/share/kuberoot/rv64-images'
images.mkdir(exist_ok=True)
pins = [
    ('coredns', 'docker.io/coredns/coredns:1.14.7',
     '7efd3c635b03efd68c4e8398fc45f0d993d0e9ab016f72c1cefb0fd6d01aa286',
     '5a03868dca97830fa491f036b883630dd2dc4993f909d283ac072c2399e476c0', '30-coredns.yaml'),
    ('local-path', 'docker.io/rancher/local-path-provisioner:v0.0.37',
     'e757967a5ec338f6a9b371c5a9688bedaa8c3578ea3dd4db329ea0084be0a86f',
     'b92124d1376d790f5e2e23cf41fbd8ef7ac9bc7df59842fb96c2e335764c2b89', '40-local-path.yaml'),
]
for name, reference, index, digest, addon in pins:
    repo = reference.rsplit(':', 1)[0]
    raw = subprocess.check_output(['skopeo', 'inspect', '--raw', f'docker://{repo}@sha256:{index}'])
    assert any(m['digest'] == f'sha256:{digest}' and m.get('platform') == {'architecture': 'riscv64', 'os': 'linux'}
               for m in json.loads(raw)['manifests']), 'riscv64 pin is not in the source index'
    archive = images / f'{name}.tar'
    subprocess.run(['skopeo', 'copy', '--preserve-digests', '--override-arch', 'riscv64',
                    f'docker://{repo}@sha256:{digest}', f'oci-archive:{archive}:{reference}'], check=True)
    with tarfile.open(archive) as tar:
        descriptor = json.load(tar.extractfile('index.json'))['manifests'][0]
        assert descriptor['digest'] == f'sha256:{digest}'
    path = root / 'usr/share/kuberoot/addons' / addon
    text = path.read_text()
    assert index in text or digest in text or f'image: {reference}\n' in text, 'addon pin changed; re-audit before replacing'
    text = text.replace(f'{reference}@sha256:{index}', reference).replace(f'{reference}@sha256:{digest}', reference)
    # ctr import registers tags and generated digest names, not repo@platform-digest.
    # Never permits only the locally verified archive, with no registry fallback.
    text = re.sub(r'(?m)^(\s*)image: ' + re.escape(reference) + r'\n(?:\s*imagePullPolicy: \w+\n)?',
                  lambda m: f'{m[1]}image: {reference}\n{m[1]}imagePullPolicy: Never\n', text)
    path.write_text(text)
# The fixture already carries this verified BusyBox platform in its archive;
# avoid asking the offline runtime to resolve the unavailable multi-platform index.
path = root / 'usr/share/kuberoot/addons/40-local-path.yaml'
path.write_text(path.read_text().replace('@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e', ''))
print('Slim addon archives prepared; import with the console probe before snapshot capture.')
