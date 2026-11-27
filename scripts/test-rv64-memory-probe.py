#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import subprocess
import unittest
import tempfile

spec = importlib.util.spec_from_file_location('memory_probe', Path(__file__).with_name('rv64-memory-probe.py'))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class MemoryProbeTests(unittest.TestCase):
    def test_retained_opt_ins_and_shell_syntax(self):
        original = '#!/bin/sh\necho RV64_SETTLE_BEGIN\n(\n' + probe.MARKER + '  /bin/busybox cat /proc/uptime /proc/cmdline\n  echo RV64_READYZ_END\n) &\n'
        result = probe.instrument(original)
        self.assertEqual(probe.instrument(result), result)
        self.assertEqual(result.replace(probe.BLOCK, ''), original)
        subprocess.run(['sh', '-n'], input=result, text=True, check=True)

    def test_unknown_or_duplicate_layout_rejected(self):
        for text in ['', probe.MARKER, probe.MARKER * 2]:
            with self.assertRaises(ValueError):
                probe.instrument(text)

    def test_live_proc_fields(self):
        # Execute just the awk program locally: no guest or 60s wait needed.
        awk = probe.BLOCK.split("/bin/busybox awk '", 1)[1].split("' /proc/uptime", 1)[0]
        with tempfile.TemporaryDirectory() as tmp:
            fixtures = {
                'uptime': '123.45 12.00\n',
                'meminfo': 'MemAvailable: 100 kB\nCached: 90 kB\nActive(file): 80 kB\nInactive(file): 70 kB\nMemFree: 60 kB\n',
                'vmstat': 'pgmajfault 3\nworkingset_refault_file 4\npgscan_kswapd 5\npgsteal_direct 6\nnr_free_pages 7\n',
            }
            paths = []
            for name, data in fixtures.items():
                path = Path(tmp) / name
                path.write_text(data)
                paths.append(str(path))
                awk = awk.replace('/proc/' + name, str(path))
            result = subprocess.check_output(['awk', awk, *paths], text=True)
        self.assertEqual(len(result.splitlines()), 8)
        self.assertNotIn('MemFree', result)
        self.assertNotIn('nr_free_pages', result)
        for key in ['MemAvailable', 'Cached', 'Active(file)', 'Inactive(file)', 'pgmajfault', 'workingset_refault_file', 'pgscan', 'pgsteal']:
            self.assertIn(key, result)
        self.assertTrue(all(line.startswith('RV64_MEM uptime=') for line in result.splitlines()))


if __name__ == '__main__':
    unittest.main()
