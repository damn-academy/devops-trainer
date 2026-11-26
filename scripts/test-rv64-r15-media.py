#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('r15', HERE / 'rv64-r15-media.py')
r15 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r15)
PROBE = (HERE / 'fixtures/rv64-r15/r6-probe.sh').read_text()
DIAG = (HERE / 'rv64-diag-probe.sh').read_text()


class R15Tests(unittest.TestCase):
    def test_actual_pinned_probe(self):
        self.assertEqual(r15.sha(HERE / 'fixtures/rv64-r15/r6-probe.sh'),
                         r15.PINS['usr/share/kuberoot/rv64-probe.sh'])
        result = r15.probe(PROBE)
        subprocess.run(['sh', '-n'], input=result, text=True, check=True)
        for marker in ['RV64_MEM', 'RV64_NODE_READY', 'RV64_SETTLE_END', 'RV64_PROBE_DONE',
                       'image-pull-policy=Never', 'rv64-warmup', 'rv64-busybox']:
            self.assertIn(marker, result)
        self.assertLess(result.index('RV64_NODE_REGISTERED_READY'), result.index('RV64_SETTLE_BEGIN'))
        self.assertNotIn('-s QUIT', result)
        self.assertNotIn('--request-timeout=120s', result)
        self.assertIn('--request-timeout=1320s wait', result)
        with self.assertRaises(ValueError):
            r15.probe(result)

    def test_observer(self):
        result = r15.observer(DIAG)
        subprocess.run(['sh', '-n'], input=result, text=True, check=True)
        self.assertNotIn('SIGQUIT', result)
        self.assertNotIn('kill ', result)
        self.assertNotIn('rv64_diag_failed', result)
        for needle in ['sleep 120', 'rv64_diag_processes', 'rv64_diag_sockets',
                       'rv64-diag-status', 'rv64_diag_logs 10', 'timeout 660 kubectl',
                       'mkdir /run/rv64-r15-readyz-lock', 'trap ', ') &']:
            self.assertIn(needle, result)

    def test_readyz_lock_prevents_overlap(self):
        # Execute observer twice with a blocked fake request and ensure one client.
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script = r15.observer(DIAG)
            block = script[script.index('    # One outstanding'):script.index('    echo "snapshot END')]
            block = block.replace('/bin/busybox ', '').replace('/run/', temp + '/')
            (root / 'rv64-diag-readyz-start').touch()
            # Fake timeout returns after the test releases it; loop runs in one shell.
            shell = '''timeout() { echo called >> "$CALLS"; while [ ! -f "$RELEASE" ]; do sleep 0.05; done; }
rv64_diag_uptime() { echo 1; }
'''
            shell += block + '\nsleep 0.1\n' + block + '\ntouch "$RELEASE"\nwait\n'
            subprocess.run(['sh'], input=shell, text=True, check=True,
                           env={'PATH': '/usr/bin:/bin', 'CALLS': str(root / 'calls'), 'RELEASE': str(root / 'release')})
            self.assertEqual((root / 'calls').read_text().splitlines(), ['called'])
            self.assertFalse((root / 'rv64-r15-readyz-lock').exists())

    def test_fail_closed(self):
        with self.assertRaises(ValueError):
            r15.once('duplicate duplicate', 'duplicate', 'new')
        with self.assertRaises(ValueError):
            r15.probe('unknown probe')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for path in r15.PINS:
                p = root / path
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text('wrong binary')
            with self.assertRaises(ValueError):
                r15.install(root)
            self.assertEqual((root / 'usr/bin/kubectl').read_text(), 'wrong binary')

    def test_proposed_transport_overlay(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            patchfile = HERE.parent / 'design/rv64/kuberoot-patches/0001-standalone-client-tls-timeout.patch'
            subprocess.run(['git', 'apply', str(patchfile.resolve())], cwd=root, check=True)
            transport = root / 'client-go/transport'
            transport.mkdir(parents=True)
            cache = transport / 'cache.go'
            cache.write_text('TLSHandshakeTimeout: 10 * time.Second,\n')
            command = ['python3', str(root / 'build/client-go-tls-timeout.py'), str(transport.parent)]
            subprocess.run(command, check=True)
            self.assertIn('kuberootTLSHandshakeTimeout()', cache.read_text())
            helper = (transport / 'kuberoot_tls_timeout.go').read_text()
            self.assertIn('KUBEROOT_TLS_HANDSHAKE_TIMEOUT', helper)
            self.assertIn('return 10 * time.Second', helper)
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)

    def test_manifest_of_mock_packaging(self):
        # Exercise orchestration and hash publication without Linux tools or a pod.
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / 'source.img'
            source.write_bytes(b'pinned-test-input')
            out = root / 'out'
            def run(argv, **kwargs):
                if len(argv) > 1 and str(argv[1]).endswith('rv64-uncompressed-media.py'):
                    (out / (r15.NAME + '.img')).write_bytes(b'packaged-test-output')
            with patch.object(r15, 'R6', r15.sha(source)), \
                 patch.object(r15, 'work_path', side_effect=Path), \
                 patch.object(r15, 'install', return_value={'fixture': 'validated'}), \
                 patch.object(r15.subprocess, 'run', side_effect=run), \
                 patch.object(r15.sys, 'argv', ['builder', '--source', str(source), '--out', str(out)]), \
                 patch.dict(r15.os.environ):
                r15.main()
                with self.assertRaises(FileExistsError):
                    r15.main()
            meta = r15.json.loads((out / (r15.NAME + '.json')).read_text())
            self.assertEqual(set(meta), {'url', 'bytes', 'version'})
            self.assertEqual(meta['version'], r15.sha(out / (r15.NAME + '.img')))
            self.assertEqual(meta['bytes'], len(b'packaged-test-output'))
            self.assertEqual(source.read_bytes(), b'pinned-test-input')

    def test_install_after_generated_kubelet_config(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = {
                'usr/sbin/kinit.real': b'fake pinned kinit',
                'usr/bin/kuberoot-control.real': b'fake pinned control',
                'usr/bin/kubectl': b'fake pinned kubectl',
                'usr/share/kuberoot/rv64-probe.sh': PROBE.encode(),
                'usr/share/kuberoot/rv64-diag-probe.sh': DIAG.encode(),
                'usr/sbin/kinit': b'#!/bin/sh\nexec /usr/sbin/kinit.real\n',
                'usr/bin/kuberoot-control': b"#!/bin/sh\nexport KINE_COMPACT_TIMEOUT=5m\n# nodeStatusUpdateFrequency: 10s/\necho STATUS_10S\nexec /usr/bin/kuberoot-control.real \"$@\"\n",
            }
            for name, data in files.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
            pins = {name: r15.sha(root / name) for name in r15.PINS}
            with patch.object(r15, 'PINS', pins):
                r15.install(root)
            for name in ['usr/sbin/kinit.real', 'usr/bin/kuberoot-control.real', 'usr/bin/kubectl']:
                self.assertEqual((root / name).read_bytes(), files[name])
            control = (root / 'usr/bin/kuberoot-control').read_text()
            self.assertIn('KUBEROOT_TIMESCALE=300', control)
            self.assertIn('nodeStatusUpdateFrequency: 30s/', control)
            self.assertIn('tlsmlkem=0', (root / 'usr/sbin/kinit').read_text())

    def test_work_paths(self):
        for path in ['/work', '/tmp/output', '/work/../etc/output']:
            with self.assertRaises(ValueError):
                r15.work_path(path)
        self.assertEqual(r15.work_path('/work/r15'), Path('/work/r15'))
        with tempfile.TemporaryDirectory() as temp:
            link = Path(temp) / 'escape'
            link.symlink_to('/etc')
            with self.assertRaises(ValueError):
                r15.work_path(link / 'output')


if __name__ == '__main__':
    unittest.main()
