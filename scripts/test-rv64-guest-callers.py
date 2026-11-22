import base64
import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('callers', Path(__file__).with_name('rv64-guest-callers.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class CallersTest(unittest.TestCase):
    def test_pcsp_return_slots_and_missing_window(self):
        table = m.GoUnwinder({'quantum': 1, 'pctab': base64.b64encode(bytes([0, 34, 32, 0, 18, 32, 0])).decode(),
            'functions': [['1000', '1020', 'runtime.pcvalue', 1, 0], ['2000', '2020', 'runtime.Callers', 4, 0], ['3000', '3020', 'caller', 0, 1]]})
        row = ['0'] * 44
        row[0], row[9], row[10], row[11] = '1004', 'deadbeef', '8000', '5'
        row[12], row[14] = '2010', '3008'
        self.assertEqual(table.chain(row), (['runtime.pcvalue', 'runtime.Callers', 'caller'], 'top'))
        row[11] = '1'
        self.assertEqual(table.chain(row), (['runtime.pcvalue', 'runtime.Callers'], 'stack-window-end'))
        table.functions[1] = (*table.functions[1][:4], 2)
        self.assertEqual(table.chain(row)[1], 'stack-switch')


if __name__ == '__main__':
    unittest.main()
