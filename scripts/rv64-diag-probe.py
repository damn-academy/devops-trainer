#!/usr/bin/env python3
"""Install R6 diagnostics without replacing R5's retained probe or rootfs."""
import hashlib
import json
import os
from pathlib import Path
import shutil

CONFIG = 'echo RV64_CONFIG_CREATED\n'
READY = '  echo RV64_READYZ_BEGIN\n'
BLOCK = '# RV64_DIAG_PROBE_V1\n. /usr/share/kuberoot/rv64-diag-probe.sh\n'
START = '  : > /run/rv64-diag-readyz-start\n'


def instrument(text):
    if BLOCK in text:
        return text
    if text.count(CONFIG) != 1 or text.count(READY) != 1:
        raise ValueError('unknown retained probe layout')
    return text.replace(CONFIG, CONFIG + BLOCK, 1).replace(READY, READY + START, 1)


def install(root, status):
    evidence = json.loads((root / 'usr/share/kuberoot/rv64-no-reboot.json').read_text())
    assert hashlib.sha256((root / 'usr/sbin/kinit.real').read_bytes()).hexdigest() == evidence['sha256']
    assert 'RV64_RECOVERY_NO_REBOOT' in (root / 'usr/bin/kuberoot-control').read_text()
    probe = root / 'usr/share/kuberoot/rv64-probe.sh'
    original = probe.read_text()
    assert '# RV64_MEM_PROBE_V1:' in original, 'expected R5 memory probe'
    updated = instrument(original)
    shutil.copyfile(Path(__file__).with_suffix('.sh'), probe.with_name('rv64-diag-probe.sh'))
    shutil.copyfile(status, root / 'usr/bin/rv64-diag-status')
    (root / 'usr/bin/rv64-diag-status').chmod(0o755)
    probe.write_text(updated)


if __name__ == '__main__':
    assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
    install(Path(os.environ['RV64_PROBE_ROOT']), Path(os.environ['RV64_DIAG_STATUS']))
    print('Installed R6 diagnostics; retained memory/recovery/acceptance settings')
