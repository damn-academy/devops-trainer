#!/usr/bin/env python3
"""Replace only standalone clients and their TLS environment in pinned R15 media."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

R15 = '02f056c73d9cedfe714f57934d8f5a85cf2aca6c10218f84a1e4aa983369b0a0'
NAME = 'r16-uncompressed-no-reboot'
PINS = {
    'usr/bin/kubectl': '6de88e9ab2635eb02b4a311082af884fef27da136b79d28f4288b52abe5029c7',
    'usr/bin/kuberoot-node': '0a788de2b4531c90c31a324bc4f84810541faf19fc650b4436c777516a1e2b42',
    'usr/share/kuberoot/rv64-probe.sh': 'c5f95a0e3be68879592c687a14375237ee62585ccffe2bad5403c6ac6071386f',
    'usr/share/kuberoot/rv64-diag-probe.sh': 'aa5494ee4c476d8fab828be19ae67d104121342e87658f61652d20a7b9650752',
    'usr/share/kuberoot/profile.yaml': 'db595c8fafc7f7bdceb50165bd32382ddcd27223b909ae733c71af6568ab6034',
}
EXPORT = 'export KUBEROOT_TLS_HANDSHAKE_TIMEOUT=300s\n'


def sha(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def work_path(value):
    p = Path(value).resolve()
    if not p.is_relative_to('/work') or p == Path('/work'):
        raise ValueError('path must be strictly below /work: ' + str(p))
    return p


def digest(value):
    if not re.fullmatch('[0-9a-f]{64}', value):
        raise argparse.ArgumentTypeError('expected lowercase SHA-256')
    return value


def validate_binary(path, expected):
    if sha(path) != expected:
        raise ValueError('client SHA-256 mismatch: ' + str(path))
    data = Path(path).read_bytes()
    if data[:6] != b'\x7fELF\x02\x01' or int.from_bytes(data[18:20], 'little') != 243:
        raise ValueError('expected little-endian ELF64 RISC-V client')
    if b'KUBEROOT_TLS_HANDSHAKE_TIMEOUT' not in data:
        raise ValueError('client is missing TLS overlay')


def export_timeout(text):
    if not text.startswith('#!/bin/sh\n') or 'KUBEROOT_TLS_HANDSHAKE_TIMEOUT' in text:
        raise ValueError('unexpected or already patched shell')
    return text.replace('#!/bin/sh\n', '#!/bin/sh\n' + EXPORT, 1)


def install(root, clients):
    # Validate every input before changing anything.
    for name, expected in PINS.items():
        p = root / name
        if p.is_symlink() or sha(p) != expected:
            raise ValueError('unsupported R15 file: ' + name)
    real = root / 'usr/bin/kuberoot-node.real'
    if real.exists() or real.is_symlink():
        raise ValueError('node wrapper target already exists')
    for path, expected in clients.values():
        validate_binary(path, expected)
    scripts = {}
    for name in ['usr/share/kuberoot/rv64-probe.sh', 'usr/share/kuberoot/rv64-diag-probe.sh']:
        scripts[name] = export_timeout((root / name).read_text())
    scripts['usr/bin/kuberoot-node'] = (
        '#!/bin/sh\n' + EXPORT + 'exec /usr/bin/kuberoot-node.real "$@"\n')
    for text in scripts.values():
        subprocess.run(['sh', '-n'], input=text, text=True, check=True)
    shutil.copyfile(clients['kubectl'][0], root / 'usr/bin/kubectl')
    shutil.copyfile(clients['kuberoot-node'][0], real)
    real.chmod(0o755)
    (root / 'usr/bin/kubectl').chmod(0o755)
    for name, text in scripts.items():
        (root / name).write_text(text)
        (root / name).chmod(0o755)
    return {name: sha(root / name) for name in [*PINS, 'usr/bin/kuberoot-node.real']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=work_path, required=True)
    parser.add_argument('--out', type=work_path, default=Path('/work/r16'))
    for name in ['kubectl', 'kuberoot-node']:
        parser.add_argument('--' + name, type=work_path, required=True)
        parser.add_argument('--' + name + '-sha256', type=digest, required=True)
    args = parser.parse_args()
    if sha(args.source) != R15:
        raise ValueError('source is not pinned R15')
    clients = {name: (getattr(args, name.replace('-', '_')),
                     getattr(args, name.replace('-', '_') + '_sha256'))
               for name in ['kubectl', 'kuberoot-node']}
    for path, expected in clients.values():
        validate_binary(path, expected)
    args.out.mkdir()  # refuse existing output; no operator data deletion
    temp = args.out / 'tmp'
    temp.mkdir()
    os.environ['TMPDIR'] = str(temp)
    root = args.out / 'root'
    squash = args.out / 'source.squashfs'
    subprocess.run(['mcopy', '-i', str(args.source) + '@@1048576',
                    '::/kuberoot/rootfs.squashfs', str(squash)], check=True)
    subprocess.run(['unsquashfs', '-processors', '1', '-d', str(root), str(squash)], check=True)
    files = install(root, clients)
    env = dict(os.environ, CARGO_HOME='/work/cargo', RV64_MEDIA_ROOT=str(args.out),
               RV64_MEDIA_TEMPLATE=str(args.source), RV64_MEDIA_COMPRESSED='0',
               RV64_MEDIA_PROCESSORS='1', RV64_MEDIA_NAME=NAME)
    subprocess.run([sys.executable, str(Path(__file__).with_name('rv64-uncompressed-media.py'))],
                   env=env, check=True)
    subprocess.run(['unsquashfs', '-s', str(args.out / (NAME + '.squashfs'))], check=True)
    img = args.out / (NAME + '.img')
    manifest = {'url': '/rv64/' + img.name, 'bytes': img.stat().st_size, 'version': sha(img)}
    evidence = {'sourceSha256': R15, 'clients': {n: h for n, (_, h) in clients.items()},
                'files': files, 'settings': {'KUBEROOT_TLS_HANDSHAKE_TIMEOUT': '300s'},
                'unchanged': 'All other R15 rootfs files and runtime settings',
                'acceptance': 'not measured'}
    (args.out / 'build-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    (args.out / (NAME + '.json')).write_text(json.dumps(manifest) + '\n')
    print(json.dumps(manifest))


if __name__ == '__main__':
    main()
