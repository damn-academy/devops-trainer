#!/usr/bin/env python3
"""Derive the kube-wasm worker medium from the pinned RV64 R16 medium.

The R16 medium boots a standalone kuberoot node (its own control plane). This
medium adds one thing: a placeholder file /kuberoot/join.json on the boot
partition, and a line in the stage-two wrapper (/usr/sbin/kinit) that, when
the file holds a kuberoot Membership, copies it to
/var/lib/kuberoot/membership.json before kinit starts. kinit then runs the
node as a worker of that cluster (containerd, kubelet with a bootstrap token,
kube-proxy, kuberoot-node) instead of a control plane, and the offline
images of the medium are loaded into containerd.

The page fills the placeholder at boot time by laying the Membership over the
placeholder's bytes in the HTTP block device (HTTPDisk.overlay), so one medium
serves every tab, each with its own cluster CA and token. The placeholder's
offset and size are written to the manifest.

Run on the build pod (needs mtools and squashfs-tools; writes only under OUT):
  node-media.py --source r16.img --out /work/kube-wasm/node/r18
"""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

R16 = 'd2f8e658c74a8c4b2d132783eb80030a3f5334f6251cc1f188588da50fb58f95'
NAME = 'r18-kubewasm-worker'
JOIN_BYTES = 32 * 1024
PLACEHOLDER = b'{"kubewasm":"join placeholder; the page lays a Membership over these bytes"}'
FAT = '@@1048576'  # the boot partition starts at 1 MiB

PROBE_LINE = '/bin/sh /usr/share/kuberoot/rv64-probe.sh >/dev/console 2>&1 &\n'
JOIN_BLOCK = '''join=/run/kuberoot/media/kuberoot/join.json
if /bin/busybox grep -q '"role"' "$join" 2>/dev/null; then
  # kube-wasm: join the control plane that runs in the browser tab.
  /bin/busybox mkdir -p /var/lib/kuberoot
  /bin/busybox cp "$join" /var/lib/kuberoot/membership.json
  echo RV64_KUBEWASM_JOIN >/dev/console
  # No registry is reachable: load the offline images, as the standalone probe does.
  (
    while [ ! -S /run/containerd/containerd.sock ]; do /bin/busybox sleep 5; done
    for archive in /usr/share/kuberoot/rv64-images/*.tar; do
      /usr/bin/ctr -n k8s.io images import --digests "$archive" >/dev/null 2>&1 || echo "RV64_KUBEWASM_IMAGE_FAILED $archive"
    done
    echo RV64_KUBEWASM_IMAGES
  ) >/dev/console 2>&1 &
else
  ''' + PROBE_LINE + '''fi
'''


def sha(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def run(*args):
    subprocess.run(args, check=True)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    if sha(a.source) != R16:
        raise SystemExit('source is not the pinned R16 medium')
    a.out.mkdir()  # refuse to reuse an existing output directory
    root, squash, img = a.out / 'root', a.out / 'rootfs.squashfs', a.out / (NAME + '.img')

    run('mcopy', '-i', str(a.source) + FAT, '::/kuberoot/rootfs.squashfs', str(a.out / 'source.squashfs'))
    run('unsquashfs', '-processors', '2', '-q', '-d', str(root), str(a.out / 'source.squashfs'))
    (a.out / 'source.squashfs').unlink()

    wrapper = root / 'usr/sbin/kinit'
    text = wrapper.read_text()
    if text.count(PROBE_LINE) != 1 or 'kube-wasm' in text:
        raise SystemExit('unexpected stage-two wrapper')
    text = text.replace(PROBE_LINE, JOIN_BLOCK)
    subprocess.run(['sh', '-n'], input=text, text=True, check=True)
    wrapper.write_text(text)

    # Uncompressed, like R16: the emulator reads it through 256 KiB HTTP chunks.
    run('mksquashfs', str(root), str(squash), '-noappend', '-noI', '-noD', '-noF', '-noX',
        '-processors', '2', '-quiet')
    shutil.rmtree(root)

    shutil.copyfile(a.source, img)
    fat = str(img) + FAT
    join = a.out / 'join.json'
    join.write_bytes(PLACEHOLDER + b' ' * (JOIN_BYTES - len(PLACEHOLDER)))
    # The placeholder goes first, into free space at the start of the data
    # area, so that it is contiguous; the offset is verified below anyway.
    run('mcopy', '-i', fat, str(join), '::/kuberoot/join.json')
    run('mcopy', '-o', '-i', fat, str(squash), '::/kuberoot/rootfs.squashfs')
    squash.unlink()

    data = img.read_bytes()
    offset = data.find(PLACEHOLDER)
    if offset < 0 or data.find(PLACEHOLDER, offset + 1) >= 0:
        raise SystemExit('placeholder not found exactly once')
    if data[offset:offset + JOIN_BYTES] != join.read_bytes():
        raise SystemExit('placeholder is not contiguous on the medium')
    join.unlink()

    manifest = {'url': '/rv64/' + img.name, 'bytes': img.stat().st_size, 'version': sha(img),
                'join': {'offset': offset, 'bytes': JOIN_BYTES}, 'source': R16}
    (a.out / (NAME + '.json')).write_text(json.dumps(manifest) + '\n')
    print(json.dumps(manifest))


if __name__ == '__main__':
    main()
