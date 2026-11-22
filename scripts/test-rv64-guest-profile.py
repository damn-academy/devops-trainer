#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest
import struct
import tempfile

spec = importlib.util.spec_from_file_location('profile', Path(__file__).with_name('rv64-guest-profile.py'))
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)
spec = importlib.util.spec_from_file_location('symbols', Path(__file__).with_name('rv64-guest-symbols.py'))
symbols = importlib.util.module_from_spec(spec)
spec.loader.exec_module(symbols)


class ProfileTests(unittest.TestCase):
    def test_external_go_text_base(self):
        b = bytearray(2048)
        b[:6] = b'\x7fELF\x02\x01'
        struct.pack_into('<H', b, 18, 243)
        struct.pack_into('<Q', b, 40, 0x500)
        struct.pack_into('<HHH', b, 58, 64, 5, 4)
        names = b'\0.text\0.gopclntab\0.go.module\0.shstrtab\0'
        b[0x480:0x480+len(names)] = names
        sections = [(0, 0, 0, 0, 0, 0), (1, 1, 6, 0x5500000, 0x100, 16),
                    (7, 1, 2, 0x200000, 0x200, 128), (18, 1, 2, 0x300000, 0x300, 192),
                    (29, 3, 0, 0, 0x480, len(names))]
        for i, fields in enumerate(sections):
            struct.pack_into('<IIQQQQIIQQ', b, 0x500+64*i, *fields, 0, 0, 1, 0)
        b[0x200:0x208] = b'\xf1\xff\xff\xff\0\0\x02\x08'
        struct.pack_into('<8Q', b, 0x208, 1, 0, 0, 72, 0, 0, 0, 96)
        b[0x248:0x258] = b'runtime.pcvalue\0'
        struct.pack_into('<IIIIII', b, 0x260, 0, 16, 16, 0, 0, 0)
        struct.pack_into('<Q', b, 0x300, 0x200000)
        struct.pack_into('<Q', b, 0x3b0, 0x5500000)
        with tempfile.NamedTemporaryFile() as f:
            f.write(b); f.flush()
            self.assertEqual(symbols.symbols(f.name)['functions'], [('0x5500000', '0x5500010', 'runtime.pcvalue')])

    def test_exact_clock_and_unknown_addresses(self):
        document = {'result': {'profileRequestedAt': 100, 'console': '', 'events': [], 'samples': [{
            'hostMonotonicMs': 2100, 'elapsedMs': 1500, 'guestTicks': 90000000,
            'guestProfile': {'interval': 17, 'dropped': 2, 'rows': [
                ['ffffffff80000100', '8000000000081234', 1, '0', '0', 80000000, 17],
                ['1000', '8000000000081234', 0, '0', '0', 80000000, 34],
                ['1010', '8000000000081234', 0, '0', '0', 80000000, 51]]}}]}}
        symbols = [{'sha256': 'test', 'functions': [['0x1000', '0x1010', 'runtime.init']]}]
        mapping = [{'satp': '8000000000081234', 'process': 'kubectl', 'symbolSha256': 'test', 'startMs': 500, 'endMs': 1500}]
        r = profile.report(document, symbols, mapping)
        self.assertFalse(r['timestampApproximation'])
        self.assertEqual(r['dropped'], 2)
        self.assertEqual(r['windows'][0]['samples'], 3)
        self.assertEqual(r['windows'][0]['unresolved'], 2)
        self.assertIn({'process': 'kubectl@8000000000081234', 'function': 'runtime.init', 'samples': 1, 'percent': 33.333}, r['windows'][0]['top50'])
        self.assertIsNone(r['windows'][1]['endMs'])

    def test_ambiguous_mapping_is_not_guessed(self):
        doc = {'result': {'console': '', 'events': [], 'samples': [{
            'elapsedMs': 100, 'guestTicks': 100, 'guestProfile': {'interval': 17, 'dropped': 0,
            'rows': [['1000', '123', 0, '0', '0', 100, 17]]}}]}}
        mappings = [{'satp': '123'}, {'satp': '123'}]
        r = profile.report(doc, mappings=mappings)
        self.assertEqual(r['windows'][0]['unresolved'], 1)
        self.assertEqual(r['windows'][0]['top50'][0]['process'], 'satp:123')


if __name__ == '__main__':
    unittest.main()
