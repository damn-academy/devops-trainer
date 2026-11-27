#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('diag', HERE / 'rv64-diag-probe.py')
diag = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diag)
SHELL = (HERE / 'rv64-diag-probe.sh').read_text()


class DiagnosticsTests(unittest.TestCase):
    def test_retention_and_syntax(self):
        original = '#!/bin/sh\n' + diag.CONFIG + '(\n' + diag.READY + '  echo retained\n) &\n'
        patched = diag.instrument(original)
        self.assertEqual(diag.instrument(patched), patched)
        self.assertEqual(patched.replace(diag.BLOCK, '').replace(diag.START, ''), original)
        for script in [patched, SHELL]:
            subprocess.run(['sh', '-n'], input=script, text=True, check=True)
        for invalid in ['', original + diag.CONFIG, original + diag.READY]:
            with self.assertRaises(ValueError):
                diag.instrument(invalid)

    def run_shell(self, root, call):
        script = SHELL.split('(rv64_diag_run 2>&1', 1)[0]
        script = script.replace('/bin/busybox ', '').replace('/proc/', str(root) + '/proc/')
        script = script.replace('/etc/kubernetes/', str(root) + '/etc/kubernetes/')
        return subprocess.check_output(['sh'], input=script + '\n' + call, text=True)

    def test_process_names_and_tcp_ports(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            proc = root / 'proc'
            (proc / 'net').mkdir(parents=True)
            for table, addr in [('tcp', '0100007F:192B'), ('tcp6', '00000000000000000000000000000000:0933')]:
                (proc / 'net' / table).write_text('header\n 0: ' + addr + ' 00000000:0000 0A 0 0 0 0 0 42\n 1: ' + addr + ' 0:0 01 0 0 0 0 0 43\n')
            for pid, name in [(123, 'kube-controller-manager'), (124, 'unrelated')]:
                d = proc / str(pid)
                d.mkdir()
                (d / 'cmdline').write_bytes(('/usr/bin/' + name + '\0--flag\0').encode())
                (d / 'status').write_text('Name:\ttruncated\nState:\tS (sleeping)\nVmRSS:\t1234 kB\nThreads:\t4\n')
                (d / 'stat').write_text(str(pid) + ' (name with ) spaces) S ' + ' '.join(['0'] * 18) + ' 12345 0\n')
            out = self.run_shell(root, 'rv64_diag_processes; rv64_diag_sockets')
            self.assertIn('executable=kube-controller-manager', out)
            self.assertNotIn('unrelated', out)
            self.assertIn('VmRSS:\t1234 kB', out)
            self.assertIn('start_ticks=12345', out)
            self.assertIn('port=6443', out)
            self.assertIn('port=2355', out)
            self.assertEqual(out.count('listen table='), 2)

    def test_failure_window_and_one_shot(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = self.run_shell(Path(tmp), """
rv64_diag_uptime() { echo "$clock"; }
rv64_diag_quit() { echo "dump at $clock"; }
failed_since= quit_done=0 attempt_start=100 clock=110
rv64_diag_failed
clock=699; rv64_diag_failed
clock=700; rv64_diag_failed
clock=900; rv64_diag_failed
# A successful readiness check clears the failure interval (as in the loop).
failed_since= quit_done=0 attempt_start=1000 clock=1010
rv64_diag_failed
failed_since= attempt_start=1500 clock=1600
rv64_diag_failed
clock=2100; rv64_diag_failed
""")
            self.assertEqual(out.splitlines(), ['dump at 700', 'dump at 2100'])

    def test_combined_quit_and_absent_runtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'proc/123').mkdir(parents=True)
            (root / 'proc/uptime').write_text('950.1 0\n')
            (root / 'proc/123/cmdline').write_bytes(b'/usr/bin/kuberoot-control.real\0/etc/kubernetes/components.json\0')
            (root / 'etc/kubernetes').mkdir(parents=True)
            (root / 'etc/kubernetes/components.json').write_text('{"kube-apiserver":[]}')
            # Override side effects: no real signal, sleep or log access in tests.
            mocks = 'kill() { echo "signal $*"; }; sleep() { :; }; tail() { echo "tail $*"; }; '
            out = self.run_shell(root, mocks + 'rv64_diag_quit')
            self.assertIn('signal -QUIT 123', out)
            self.assertIn('tail -n 400', out)
            (root / 'proc/123/cmdline').unlink()
            out = self.run_shell(root, mocks + 'rv64_diag_quit || true')
            self.assertIn('no apiserver runtime found', out)
            self.assertNotIn('signal -QUIT', out)


if __name__ == '__main__':
    unittest.main()
