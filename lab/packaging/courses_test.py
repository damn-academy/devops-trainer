import hashlib
import json
import pathlib
import subprocess
import tarfile
import tempfile
import unittest

from courses import group


class Bundles(unittest.TestCase):
    def test_paths(self):
        for name in ('v86/lab/root.bin', 'assets/v86-ab.wasm', 'assets/libv86-cd.js'):
            self.assertEqual(group(name), 'v86')
        for name in ('rv64/kernel.bin', 'assets/rv64-ab.wasm'):
            self.assertEqual(group(name), 'rv64')
        self.assertEqual(group('assets/index-a.js'), 'academy')

    def test_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            source, out = root / 'dist', root / 'release'
            source.mkdir()
            for file in ('index.html', 'v86/lab/image', 'assets/v86-a.wasm', 'rv64/kernel'):
                target = source / file
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(file)
            (source / 'catalog-courses.json').write_text(json.dumps([dict(id='linux', title=dict(ru='Linux', en='Linux'))]))
            (source / 'catalog-labels.json').write_text(json.dumps({id: dict(title=dict(ru=id, en=id), description=dict(ru=id, en=id)) for id in ('academy', 'v86', 'rv64')}))
            script = pathlib.Path(__file__).with_name('courses.py')
            subprocess.run(['python3', str(script), '1.2.3', str(source), str(out)], check=True)
            catalog = json.loads((out / 'catalog.json').read_text())
            self.assertEqual(catalog['schemaVersion'], 1)
            self.assertEqual(len(catalog['packages']), 3)
            names = []
            for p in catalog['packages']:
                archive = out / p['file']
                self.assertEqual(p['bytes'], archive.stat().st_size)
                self.assertEqual(p['sha256'], hashlib.sha256(archive.read_bytes()).hexdigest())
                with tarfile.open(archive) as tar:
                    for name in tar.getnames():
                        self.assertEqual(group(name), p['id'])
                        names.append(name)
            self.assertEqual(len(names), 6)
            (source / 'link').symlink_to(source / 'index.html')
            result = subprocess.run(['python3', str(script), '1.2.3', str(source), str(out)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
