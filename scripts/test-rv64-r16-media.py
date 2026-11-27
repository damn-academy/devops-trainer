#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('r16', HERE / 'rv64-r16-media.py')
r16 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r16)


def binary():
    return b'\x7fELF\x02\x01' + bytes(12) + (243).to_bytes(2, 'little') + b'KUBEROOT_TLS_HANDSHAKE_TIMEOUT'


class R16Tests(unittest.TestCase):
    def fixture(self, base):
        root = base / 'root'
        for name in r16.PINS:
            p = root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            fixture = HERE / 'fixtures/rv64-r16' / p.name
            p.write_bytes(fixture.read_bytes() if fixture.exists() else b'original')
        (root / 'untouched').write_bytes(b'preserve me')
        clients = {}
        for name in ['kubectl', 'kuberoot-node']:
            p = base / name
            p.write_bytes(binary())
            clients[name] = (p, r16.sha(p))
        pins = {n: r16.sha(root / n) for n in r16.PINS}
        return root, clients, pins

    def test_exact_probe_fixtures(self):
        for name in ['rv64-probe.sh', 'rv64-diag-probe.sh']:
            p = HERE / 'fixtures/rv64-r16' / name
            self.assertEqual(r16.sha(p), r16.PINS['usr/share/kuberoot/' + name])
            result = r16.export_timeout(p.read_text())
            self.assertEqual(result.replace(r16.EXPORT, ''), p.read_text())
            subprocess.run(['sh', '-n'], input=result, text=True, check=True)
            with self.assertRaises(ValueError):
                r16.export_timeout(result)

    def test_install_preserves_other_files_and_arguments(self):
        with tempfile.TemporaryDirectory() as temp:
            root, clients, pins = self.fixture(Path(temp))
            with patch.object(r16, 'PINS', pins):
                evidence = r16.install(root, clients)
                with self.assertRaises(ValueError):
                    r16.install(root, clients)
            self.assertEqual((root / 'untouched').read_bytes(), b'preserve me')
            self.assertEqual((root / 'usr/share/kuberoot/profile.yaml').read_bytes(), b'original')
            self.assertEqual(evidence['usr/bin/kubectl'], clients['kubectl'][1])
            self.assertEqual(evidence['usr/bin/kuberoot-node.real'], clients['kuberoot-node'][1])
            wrapper = (root / 'usr/bin/kuberoot-node').read_text()
            # Execute shell wrapper with a fake service to prove explicit env and argv.
            fake = Path(temp) / 'fake'
            fake.write_text('#!/bin/sh\nprintf "%s|%s|%s" "$KUBEROOT_TLS_HANDSHAKE_TIMEOUT" "$1" "$2"\n')
            fake.chmod(0o755)
            result = subprocess.check_output(['sh', '-c', wrapper.replace('/usr/bin/kuberoot-node.real', str(fake)),
                                              'wrapper', 'arg with space', '--flag=x'], env={}, text=True)
            self.assertEqual(result, '300s|arg with space|--flag=x')

    def test_rejection_before_mutation(self):
        for failure in ['pin', 'sha', 'arch', 'patch', 'existing']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                root, clients, pins = self.fixture(Path(temp))
                if failure == 'pin': pins['usr/bin/kubectl'] = '0' * 64
                if failure == 'sha': clients['kubectl'] = (clients['kubectl'][0], '0' * 64)
                if failure in ['arch', 'patch']:
                    p = clients['kubectl'][0]
                    p.write_bytes(b'not ELF' if failure == 'arch' else binary()[:20])
                    clients['kubectl'] = (p, r16.sha(p))
                if failure == 'existing': (root / 'usr/bin/kuberoot-node.real').touch()
                before = {str(p): p.read_bytes() for p in root.rglob('*') if p.is_file()}
                with patch.object(r16, 'PINS', pins), self.assertRaises(ValueError):
                    r16.install(root, clients)
                self.assertEqual(before, {str(p): p.read_bytes() for p in root.rglob('*') if p.is_file()})

    def test_paths_and_digest(self):
        for p in ['/work', '/tmp/out', '/work/../etc/out']:
            with self.assertRaises(ValueError): r16.work_path(p)
        self.assertEqual(r16.work_path('/work/r16'), Path('/work/r16'))
        for h in ['', 'a'*63, 'G'*64]:
            with self.assertRaises(r16.argparse.ArgumentTypeError): r16.digest(h)

    def test_orchestration_manifest_and_input_gate(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root, clients, pins = self.fixture(base)
            source = base / 'source.img'
            source.write_bytes(b'source')
            out = base / 'out'
            argv = ['builder', '--source', str(source), '--out', str(out)]
            for name, (p, h) in clients.items(): argv += ['--'+name, str(p), '--'+name+'-sha256', h]
            calls = []
            def run(cmd, **kw):
                calls.append((cmd, kw))
                if len(cmd)>1 and str(cmd[1]).endswith('rv64-uncompressed-media.py'):
                    self.assertEqual(kw['env']['RV64_MEDIA_PROCESSORS'], '1')
                    (out / (r16.NAME+'.img')).write_bytes(b'image')
            with patch.object(r16, 'work_path', side_effect=Path), patch.object(r16.sys, 'argv', argv), \
                 patch.object(r16.subprocess, 'run', side_effect=run), patch.dict(r16.os.environ), \
                 patch.object(r16, 'install', return_value={'checked':'hash'}):
                with self.assertRaises(ValueError): r16.main()
                self.assertFalse(out.exists())
                self.assertFalse(calls)
                with patch.object(r16, 'R15', r16.sha(source)):
                    r16.main()
                    with self.assertRaises(FileExistsError): r16.main()
            meta = json.loads((out / (r16.NAME+'.json')).read_text())
            self.assertEqual(meta, {'url':'/rv64/'+r16.NAME+'.img', 'bytes':5,
                                    'version':r16.sha(out / (r16.NAME+'.img'))})
            ev = json.loads((out/'build-evidence.json').read_text())
            self.assertEqual(ev['clients'], {n:h for n, (_, h) in clients.items()})
            self.assertEqual(ev['acceptance'], 'not measured')
            self.assertEqual(source.read_bytes(), b'source')


if __name__ == '__main__':
    unittest.main()
