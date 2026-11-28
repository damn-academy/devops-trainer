#!/usr/bin/env python3
"""Pod-only recovery fixes for the retained, older slim emulator fixture.
Use an extracted experimental RV64_PROBE_ROOT, never a published builder root.
No guest binary or Rust rebuild: preserve multicall symlinks when wrapping control.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path

assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
root = Path(os.environ['RV64_PROBE_ROOT'])
variant = os.environ.get('RV64_RECOVERY_VARIANT', 'default')
if variant not in ('default', 'no-reboot'):
    raise SystemExit('RV64_RECOVERY_VARIANT must be default or no-reboot')
kinit = root / 'usr/sbin/kinit.real'
if variant == 'no-reboot':
    spec = importlib.util.spec_from_file_location('no_reboot', Path(__file__).with_name('rv64-no-reboot.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    evidence = module.patch(kinit)
    (root / 'usr/share/kuberoot/rv64-no-reboot.json').write_text(json.dumps(evidence, indent=2))
elif kinit.with_name(kinit.name + '.rv64-reboot-original').exists():
    raise SystemExit('default requires a fresh unpatched root')
control = root / 'usr/bin/kuberoot-control'
original = control.with_name('kuberoot-control.real')
if not original.exists():
    assert control.is_file() and control.read_bytes()[:4] == b'\x7fELF'
    control.rename(original)
for path in control.parent.iterdir():
    if path.is_symlink() and os.readlink(path) == 'kuberoot-control':
        path.unlink()
        path.symlink_to('kuberoot-control.real')
control.write_text('''#!/bin/sh
set -eu
# Kine's 5-second default expired during compaction and MustCommit exited the
# entire combined process. Match the emulator profile's factor-60 timeout.
export KINE_COMPACT_TIMEOUT=5m
# Scale deadlines, not the periodic reconciliation/status cadence.
if [ -f /etc/kubernetes/kubelet.yaml ]; then
  /bin/busybox sed -i \\
    -e 's/^nodeStatusUpdateFrequency:.*/nodeStatusUpdateFrequency: 10s/' \\
    -e 's/^nodeStatusReportFrequency:.*/nodeStatusReportFrequency: 5m/' \\
    -e 's/^syncFrequency:.*/syncFrequency: 1m/' \\
    /etc/kubernetes/kubelet.yaml
fi
echo RV64_RECOVERY_PROFILE_COMPACT_5M_STATUS_10S_SYNC_1M
exec /usr/bin/kuberoot-control.real "$@"
''')
control.chmod(0o755)
profile = root / 'usr/share/kuberoot/profile.yaml'
text = profile.read_text()
assert '- name: kube-proxy\n' in text or '- name: rv64-kube-proxy\n' in text
# combineServices matches service names. Keep proxy independently supervised,
# with its original multicall executable and flags, so NodeIPs exit(1) cannot
# restart kine/apiserver/scheduler/kubelet as well.
profile.write_text(text.replace('- name: kube-proxy\n', '- name: rv64-kube-proxy\n'))
print('Wrapped control SHA-256:', hashlib.sha256(original.read_bytes()).hexdigest())

if variant == 'no-reboot':
    control.write_text(control.read_text().replace('echo RV64_RECOVERY_PROFILE_', 'echo RV64_RECOVERY_NO_REBOOT\necho RV64_RECOVERY_PROFILE_'))
