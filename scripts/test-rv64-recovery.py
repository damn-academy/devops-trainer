#!/usr/bin/env python3
import hashlib
import importlib.util
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).parent
spec = importlib.util.spec_from_file_location('no_reboot', SCRIPTS / 'rv64-no-reboot.py')
no_reboot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(no_reboot)


class RecoveryTests(unittest.TestCase):
    def test_pinned_symbol_patch_and_repeat(self):
        raw = bytearray(256)
        struct.pack_into('<Q', raw, 40, 64)
        struct.pack_into('<HH', raw, 58, 64, 1)
        struct.pack_into('<IIQQQQIIQQ', raw, 64, 0, 1, 6, 0x1000, 128, 128, 0, 0, 4, 0)
        raw[128:132] = b'abcd'
        fake = types.SimpleNamespace(symbols=lambda _: {'functions': [('0x1000', '0x1020', 'main.shutdown')]})
        loader = types.SimpleNamespace(exec_module=lambda _: None)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'kinit.real'
            path.write_bytes(raw)
            path.chmod(0o755)
            with patch.object(no_reboot, 'PIN', hashlib.sha256(raw).hexdigest()), \
                 patch.object(no_reboot.importlib.util, 'spec_from_file_location', return_value=types.SimpleNamespace(loader=loader)), \
                 patch.object(no_reboot.importlib.util, 'module_from_spec', return_value=fake):
                first = no_reboot.patch(path)
                self.assertEqual(first, no_reboot.patch(path))
            self.assertEqual(path.read_bytes()[128:132], bytes.fromhex('67800000'))
            self.assertEqual(path.read_bytes()[132:], raw[132:])
            self.assertEqual(path.stat().st_mode & 0o777, 0o755)

    def test_unknown_binary_rejected_without_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'kinit.real'
            p.write_bytes(b'unknown')
            with self.assertRaises(ValueError):
                no_reboot.patch(p)
            self.assertEqual(p.read_bytes(), b'unknown')
            self.assertEqual(len(list(Path(tmp).iterdir())), 1)

    def test_default_profile_and_multicall_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'usr/bin').mkdir(parents=True)
            (root / 'usr/share/kuberoot').mkdir(parents=True)
            control = root / 'usr/bin/kuberoot-control'
            control.write_bytes(b'\x7fELFfixture')
            proxy = control.with_name('kube-proxy')
            proxy.symlink_to('kuberoot-control')
            (root / 'usr/share/kuberoot/profile.yaml').write_text('- name: kube-proxy\n')
            env = dict(os.environ, CARGO_HOME='/work/cargo', RV64_PROBE_ROOT=tmp, RV64_RECOVERY_VARIANT='default')
            subprocess.run(['python3', str(SCRIPTS / 'rv64-emulator-recovery.py')], env=env, check=True, capture_output=True)
            self.assertIn('RV64_RECOVERY_PROFILE_COMPACT_5M_STATUS_10S_SYNC_1M', control.read_text())
            self.assertNotIn('RV64_RECOVERY_NO_REBOOT', control.read_text())
            self.assertEqual(os.readlink(proxy), 'kuberoot-control.real')


if __name__ == '__main__':
    unittest.main()
