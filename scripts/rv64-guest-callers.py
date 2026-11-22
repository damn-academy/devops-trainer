#!/usr/bin/env python3
"""Bounded Go/RV64 caller reconstruction from observer stack samples and exact pclntab.
Stops at stack switches, missing resident words, unsupported frames, or eight frames.
Unlike scanning stack words for text addresses, only pcsp-proven return slots count.
"""
import argparse
import base64
import bisect
import collections
import gzip
import json
from pathlib import Path


def read(path):
    data = Path(path).read_bytes()
    return json.loads(gzip.decompress(data) if str(path).endswith('.gz') else data)


class GoUnwinder:
    def __init__(self, metadata):
        self.quantum = metadata['quantum']
        self.table = base64.b64decode(metadata['pctab'])
        self.functions = sorted((int(a, 16), int(b, 16), name, offset, flags) for a, b, name, offset, flags in metadata['functions'])
        self.starts = [f[0] for f in self.functions]

    def find(self, pc):
        index = bisect.bisect_right(self.starts, pc) - 1
        return self.functions[index] if index >= 0 and pc < self.functions[index][1] else None

    def delta(self, function, target):
        pc, _, _, offset, _ = function
        if not offset:
            return None
        value, first = -1, True
        def varint():
            nonlocal offset
            result = 0
            for shift in range(0, 35, 7):
                b = self.table[offset]; offset += 1
                result |= (b & 127) << shift
                if b < 128:
                    return result
            raise ValueError('oversized pclntab varint')
        while offset < len(self.table):
            uv = varint()
            if uv == 0 and not first:
                return None
            first = False
            value += -(uv & 1) ^ (uv >> 1)
            pc += varint() * self.quantum
            if target < pc:
                return value
        return None

    def chain(self, row):
        pc, ra, start, valid = (int(row[i], 16) for i in (0, 9, 10, 11))
        sp, frames, seen = start, [], set()
        for depth in range(8):
            f = self.find(pc)
            if not f or (pc, sp) in seen:
                return frames, 'unresolved-or-cycle'
            seen.add((pc, sp)); frames.append(f[2])
            if f[4] & 1:
                return frames, 'top'
            if f[4] & 2:
                return frames, 'stack-switch'
            delta = self.delta(f, pc)
            if delta is None or delta < 0 or delta & 7:
                return frames, 'unknown-frame-size'
            if depth == 0 and delta == 0:
                ret = ra
            else:
                offset = sp - start
                if offset < 0 or offset & 7 or offset // 8 >= 32 or not valid & (1 << (offset // 8)):
                    return frames, 'stack-window-end'
                ret = int(row[12 + offset // 8], 16)
            if not ret:
                return frames, 'zero-return'
            pc, sp = ret - 1, sp + delta
        return frames, 'depth-limit'


def report(document, symbols, mappings):
    tables = {s['sha256']: GoUnwinder(s['goUnwind']) for s in symbols if s.get('goUnwind')}
    chains, stops = collections.Counter(), collections.Counter()
    total = 0
    for sample in document['result']['samples']:
        for row in sample.get('guestProfile', {}).get('rows', []):
            if len(row) < 44 or row[2] != 0:
                continue
            comm = b''.join(int(v, 16).to_bytes(8, 'little') for v in row[7:9]).split(b'\0')[0].decode(errors='replace')
            candidates = [m for m in mappings if m.get('comm') == comm or m.get('satp') == row[1]]
            if len(candidates) != 1 or int(str(candidates[0].get('bias', 0)), 0) != 0:
                continue
            table = tables.get(candidates[0]['symbolSha256'])
            if not table:
                continue
            f = table.find(int(row[0], 16))
            if not f or not any(x in f[2] for x in ['runtime.Caller', 'runtime.callers', 'runtime.pcvalue', 'runtime.step', 'runtime.tracebackPCs', 'runtime.findfunc', 'runtime.(*unwinder)']):
                continue
            frames, stop = table.chain(row)
            total += 1; chains[tuple(frames)] += 1; stops[stop] += 1
    return {'sampledUnwinderPCs': total, 'chains': [{'frames': list(c), 'samples': n} for c, n in chains.most_common()], 'stops': stops,
            'scope': 'instruction-weighted samples; bounded Go frames only; no inferred stack switches'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('result'); p.add_argument('--symbols', required=True); p.add_argument('--maps', required=True)
    args = p.parse_args()
    print(json.dumps(report(read(args.result), read(args.symbols), read(args.maps)), indent=2))
