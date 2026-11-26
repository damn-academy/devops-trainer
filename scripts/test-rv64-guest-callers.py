import base64
import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('callers', Path(__file__).with_name('rv64-guest-callers.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class CallersTest(unittest.TestCase):
    def test_old_and_r10_capture_coverage(self):
        row = ['0'] * 44
        row[0], row[1], row[2], row[5] = '1004', '123', 0, 20000000
        sample = {'ms': 2500, 'elapsedMs': 2500, 'hart': 1, 'guestProfile': {'rows': [row]}}
        run = {'harts': 2, 'metrics': [sample], 'guestEpochOffsetMs': 0, 'elapsedMs': 4000,
               'markers': {'RV64_CONFIG_CREATED': 1000, 'RV64_READYZ_BEGIN': 2000, 'RV64_READYZ_END': 3000}}
        metadata = [{'sha256': 'test', 'goUnwind': {'quantum': 1, 'pctab': '',
                     'functions': [['1000', '1020', 'crypto/tls.handshake', 0, 1]]}}]
        maps = [{'satp': '123', 'symbolSha256': 'test'}]
        doc = {'result': {'type': 'smp-kuberoot', 'samples': [run]}}
        report = m.report(doc, metadata, maps)
        window = next(r for r in report['reports'] if r['hart'] == 1 and r['window'] == 'readyz-loop')
        self.assertEqual(window['chains'][0]['frames'], ['crypto/tls.handshake'])
        self.assertEqual(window['sampledPCs'], 1)
        self.assertEqual(window['emptyStackBitmapSamples'], 1)
        self.assertEqual(m.report(doc, [], maps)['reports'][4]['missingUnwindOrMapping'], 1)
        old = {'result': dict(run, samples=[sample], events=[], console='')}
        self.assertEqual(m.report(old, metadata, maps)['reports'][0]['sampledPCs'], 1)

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
