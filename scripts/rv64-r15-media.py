#!/usr/bin/env python3
"""Build an isolated R15 candidate from the pinned R6 image, entirely under /work."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

R6 = '29d01f8c77ea7d7e3db539d7b9259943187cad88b3c3ccdada122702ab7a0059'
NAME = 'r15-uncompressed-no-reboot'
PINS = {
    'usr/sbin/kinit.real': '5454fa9450465047ae0b2b94c525f73e1132da56d5e57726b04dadd3fdd962a6',
    'usr/bin/kuberoot-control.real': 'a87019474b1fdfbc135b35b44074a4b386276f77da19fb0d3ba46ebdb661e41c',
    'usr/bin/kubectl': '6de88e9ab2635eb02b4a311082af884fef27da136b79d28f4288b52abe5029c7',
    'usr/share/kuberoot/rv64-probe.sh': '34e7c2975ed4a8d1f222c03f561a8ccfc549bcbcb060530e4571c58b75cd79f6',
}


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('unexpected R6 layout: ' + old[:90])
    return text.replace(old, new, 1)


def probe(text):
    text = re.sub(r'--request-timeout=\d+s', '--request-timeout=600s', text)
    text = text.replace('--timeout=600s', '--timeout=1200s').replace('--timeout=300s', '--timeout=1200s')
    # A wait must have a request budget longer than its watch deadline.
    text = '\n'.join(line.replace('--request-timeout=600s', '--request-timeout=1320s')
                     if 'kubectl' in line and 'wait ' in line else line for line in text.split('\n'))
    text = once(text, 'timeout -s QUIT 180 kubectl', 'timeout 660 kubectl')
    text = once(text, 'until node_ready; do\n  /bin/busybox sleep 10',
                'until node_ready; do\n  /bin/busybox sleep 120')
    text = once(text, 'done\nwait "$importer"', 'done\necho RV64_NODE_REGISTERED_READY\nwait "$importer"')
    text = once(text, "  kubectl --request-timeout=600s get --raw='/readyz?verbose'\n  echo \"RV64_READYZ_STATUS=$?\"",
                "  echo 'RV64_READYZ_DELEGATED observer=R15'")
    text = text.replace('then every 60 guest seconds.', 'then every 120 guest seconds.')
    text = text.replace('      /bin/busybox sleep 60', '      /bin/busybox sleep 120')
    # Include the last unbounded informational query, too.
    text = text.replace('kubectl get pods -A -o wide', 'kubectl --request-timeout=600s get pods -A -o wide')
    return text


def observer(text):
    start = text.index('rv64_diag_quit() {')
    end = text.index('rv64_diag_run() {', start)
    text = text[:start] + text[end:]
    text = text.replace('  failed_since= quit_done=0\n', '')
    start = text.index('    if [ -f /run/rv64-diag-readyz-start ]; then')
    end = text.index('    echo "snapshot END', start)
    text = text[:start] + '''    # One outstanding request; a slow readyz must not block snapshots.
    if [ -f /run/rv64-diag-readyz-start ] && /bin/busybox mkdir /run/rv64-r15-readyz-lock 2>/dev/null; then
      (
        trap '/bin/busybox rmdir /run/rv64-r15-readyz-lock' EXIT
        if /bin/busybox timeout 660 kubectl --request-timeout=600s get --raw='/readyz?verbose'; then
          echo "readyz=success uptime=$(rv64_diag_uptime)"
        else
          echo "readyz=failed_or_timeout uptime=$(rv64_diag_uptime)"
        fi
      ) &
    fi
''' + text[end:]
    return text.replace('rv64_diag_logs 40', 'rv64_diag_logs 10').replace('sleep 60', 'sleep 120')


def install(root):
    for name, expected in PINS.items():
        if sha(root / name) != expected:
            raise ValueError('unsupported R6 file: ' + name)
    control = root / 'usr/bin/kuberoot-control'
    text = control.read_text()
    text = once(text, 'nodeStatusUpdateFrequency: 10s/', 'nodeStatusUpdateFrequency: 30s/')
    text = once(text, 'STATUS_10S', 'STATUS_30S')
    # Keep existing 2400s lease and 3000s monitor grace supplied by kinit.
    text = once(text, 'export KINE_COMPACT_TIMEOUT=5m',
                'export KINE_COMPACT_TIMEOUT=5m\nexport GOMAXPROCS=2 GOGC=100 KUBEROOT_TIMESCALE=300\necho RV64_R15_CONTROL timescale=$KUBEROOT_TIMESCALE gomaxprocs=2 gogc=100')
    control.write_text(text)
    init = root / 'usr/sbin/kinit'
    init.write_text(once(init.read_text(), '#!/bin/sh\n', '''#!/bin/sh
# R15 emulator-only medium. Preserve certificate validation, avoid hybrid KEM CPU cost.
export GODEBUG="${GODEBUG:+$GODEBUG,}tlsmlkem=0"
export GOMAXPROCS=2
'''))
    retained = root / 'usr/share/kuberoot/rv64-probe.sh'
    retained.write_text(probe(retained.read_text()))
    diag = retained.with_name('rv64-diag-probe.sh')
    diag.write_text(observer(diag.read_text()))
    for path in [init, control, retained, diag]:
        subprocess.run(['sh', '-n', str(path)], check=True)
    if 'kill -QUIT' in diag.read_text() or 'SIGQUIT' in diag.read_text():
        raise ValueError('destructive observer remains')
    return {name: sha(root / name) for name in PINS}


def work_path(path):
    path = Path(path).resolve()
    if not path.is_relative_to('/work') or path == Path('/work'):
        raise ValueError('path must be strictly below /work: ' + str(path))
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=work_path, required=True)
    parser.add_argument('--out', type=work_path, default=Path('/work/r15'))
    args = parser.parse_args()
    if sha(args.source) != R6:
        raise ValueError('source is not the pinned R6 image')
    args.out.mkdir()  # fail closed on rerun; no deletion of operator data
    temp = args.out / 'tmp'
    temp.mkdir()
    os.environ['TMPDIR'] = str(temp)
    root = args.out / 'root'
    squash = args.out / 'source.squashfs'
    subprocess.run(['mcopy', '-i', str(args.source) + '@@1048576',
                    '::/kuberoot/rootfs.squashfs', str(squash)], check=True)
    subprocess.run(['unsquashfs', '-processors', '2', '-d', str(root), str(squash)], check=True)
    inputs = install(root)
    env = dict(os.environ, CARGO_HOME='/work/cargo', RV64_MEDIA_ROOT=str(args.out),
               RV64_MEDIA_TEMPLATE=str(args.source), RV64_MEDIA_COMPRESSED='0', RV64_MEDIA_NAME=NAME)
    subprocess.run([sys.executable, str(Path(__file__).with_name('rv64-uncompressed-media.py'))], env=env, check=True)
    img = args.out / (NAME + '.img')
    manifest = {'url': '/rv64/' + img.name, 'bytes': img.stat().st_size, 'version': sha(img)}
    (args.out / (NAME + '.json')).write_text(json.dumps(manifest) + '\n')
    (args.out / 'build-evidence.json').write_text(json.dumps({'sourceSha256': R6, 'files': inputs,
        'settings': {'GODEBUG': 'tlsmlkem=0', 'GOMAXPROCS': 2, 'GOGC': 100,
                     'kinitTimescale': 60, 'controlTimescale': 300, 'nodeStatusUpdateFrequency': '30s'},
        'acceptance': 'not measured'}, indent=2) + '\n')
    subprocess.run(['unsquashfs', '-s', str(args.out / (NAME + '.squashfs'))], check=True)
    print(json.dumps(manifest))


if __name__ == '__main__':
    main()
