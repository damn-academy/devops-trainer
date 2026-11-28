#!/usr/bin/env python3
"""Instruction-weighted guest profiles; never interpret these as wall-time shares.

Usage: RESULT.json [--symbols ELF_SYMBOLS.json[.gz]] [--maps MAPS.json]
MAPS is a list of {satp OR comm, process, symbolSha256, startMs, endMs, bias}.
Only explicitly mapped address spaces are symbolized. Unknowns remain visible.
For kernel symbols use a mapping with satp="kernel", symbolSha256 and bias.
ELF symbols are produced by rv64-guest-symbols.py against exact guest artifacts.
"""
import argparse
import bisect
import collections
import gzip
import json
from pathlib import Path
from rv64_guest_capture import runs, marker as capture_marker, row_ms, tls_windows, category


def read(path):
    data = Path(path).read_bytes()
    return json.loads(gzip.decompress(data) if str(path).endswith('.gz') else data)


def report(document, symbols=(), mappings=()):
    result = document['result']
    if result.get('type') == 'smp-kuberoot':
        reports = []
        for hart, child in runs(document):
            r = report({'result': child}, symbols, mappings)
            r.update(hart=hart, harts=child['harts'])
            reports.append(r)
        return {'schema': 'rv64.guest-profile-smp/v1', 'reports': reports}
    tables = {}
    for binary in symbols:
        ranges = sorted((int(a, 16), int(b, 16), name) for a, b, name in binary['functions'])
        tables[binary['sha256']] = ([r[0] for r in ranges], ranges)
    def marker(name):
        return capture_marker(result, name)
    windows = [('restore-first-40s', 0, 40000),
               ('first-get-pods', marker('RV64_GET_PODS_BEGIN'), marker('RV64_GET_PODS_END')),
               ('pod-start', marker('RV64_POD_START_BEGIN'), marker('RV64_POD_START_END'))]
    rows, drops, intervals = [], 0, set()
    for m in result['samples']:
        p = m.get('guestProfile')
        if not p:
            continue
        drops += p['dropped']
        intervals.add(p['interval'])
        for row in p['rows']:
            pc, satp, mode, tp, scratch, ticks, attempted = row[:7]
            comm = b''.join(int(x, 16).to_bytes(8, 'little') for x in row[7:9]).split(b'\0')[0].decode('ascii', errors='replace')
            ms = row_ms(result, m, row)
            rows.append((ms, pc, satp, mode, attempted, comm))
    end_ms = result.get('elapsedMs', max((r[0] for r in rows), default=0) + 1)
    windows += tls_windows(result)
    windows += [('all-captured', 0, end_ms), ('after-readyz', marker('RV64_READYZ_BEGIN'), end_ms)]
    output = {'schema': 'rv64.guest-profile/v1', 'hart': 0, 'weight': 'instruction attempts',
              'intervals': sorted(intervals), 'dropped': drops,
              'timestampApproximation': 'profileRequestedAt' not in result and 'guestEpochOffsetMs' not in result,
              'metricsDropped': result.get('metricsDropped', 0), 'consoleDropped': result.get('consoleDropped', 0),
              'categoryScope': 'exclusive resolved leaf PCs; missing categories are not evidence of zero cost; idle samples are not WFI wall time',
              'windows': []}
    for name, start, end in windows:
        counts, processes, categories = collections.Counter(), collections.Counter(), collections.Counter()
        total = unresolved = 0
        if start is not None and end is not None:
            for ms, pc, satp, mode, _, comm in rows:
                if not start <= ms < end:
                    continue
                total += 1
                key = 'kernel' if mode != 0 else satp
                matches = [m for m in mappings if (m.get('satp') == key or (mode == 0 and comm and m.get('comm') == comm)) and m.get('startMs', 0) <= ms < m.get('endMs', float('inf'))]
                process = (comm + '@' if comm else 'satp:') + satp
                identities = {m['process'] for m in mappings if comm and m.get('comm') == comm}
                if len(identities) == 1:
                    process = next(iter(identities)) + '@' + satp
                function = ('kernel' if mode != 0 else 'user') + ':0x' + pc
                resolved = False
                if len(matches) == 1:
                    m = matches[0]
                    if mode == 0:
                        process = m['process'] + '@' + satp
                    addr = int(pc, 16) - int(str(m.get('bias', '0')), 0)
                    starts, ranges = tables.get(m['symbolSha256'], ([], []))
                    i = bisect.bisect_right(starts, addr) - 1
                    if i >= 0 and addr < ranges[i][1]:
                        function = ranges[i][2]
                        resolved = True
                if not resolved:
                    unresolved += 1
                categories[category(function, mode) if resolved else ('unresolved user' if mode == 0 else 'unresolved kernel')] += 1
                counts[process, function] += 1
                processes[process] += 1
        output['windows'].append({'name': name, 'startMs': start, 'endMs': end, 'samples': total,
            'categories': {k: {'samples': v, 'percent': round(v * 100 / total, 3)} for k, v in sorted(categories.items())},
            'unresolved': unresolved, 'processes': processes.most_common(50),
            'top50': [{'process': p, 'function': f, 'samples': n, 'percent': round(n * 100 / total, 3)}
                      for (p, f), n in counts.most_common(50)]})
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('result')
    parser.add_argument('--symbols')
    parser.add_argument('--maps')
    args = parser.parse_args()
    print(json.dumps(report(read(args.result), read(args.symbols) if args.symbols else (),
                            read(args.maps) if args.maps else ()), indent=2))
