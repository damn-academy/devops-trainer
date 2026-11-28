#!/usr/bin/env python3
"""Summarize retained R11 compiler snapshots, not individual block sizes."""
import argparse
import json
import math


def quantiles(values):
    values = sorted(values)
    return dict(zip(('min', 'p10', 'p50', 'p90', 'max'),
                    (values[math.floor((len(values) - 1) * q)] for q in (0, .1, .5, .9, 1)))) if values else None


def summarize(rows):
    rows = [r for r in rows if r['compiler'].get('installed')]
    metrics = {
        'encoded_bytes_per_installed_block': lambda c: c['installedWasmBytes'] / c['installed'],
        'estimated_native_bytes_per_installed_block': lambda c: 8 * c['installedWasmBytes'] / c['installed'],
        'module_allowance_per_installed_block': lambda c: 65536 * c['modules'] / c['installed'],
        'charged_bytes_per_installed_block': lambda c: c['estimatedHostBytes'] / c['installed'],
        'blocks_per_module': lambda c: c['installed'] / c['modules'],
        'module_allowance_fraction': lambda c: 65536 * c['modules'] / c['estimatedHostBytes'],
    }
    return {'snapshots': len(rows), **{name: quantiles([fn(r['compiler']) for r in rows]) for name, fn in metrics.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('results', nargs='+')
    args = parser.parse_args()
    out = {}
    for path in args.results:
        with open(path) as stream:
            data = json.load(stream)
        samples = data.get('result', data)['samples']
        out[path] = []
        for sample in samples:
            rows = [r for r in sample['metrics'] if r.get('type') == 'metrics']
            end = sample.get('markers', {}).get('RV64_READYZ_END')
            out[path].append({'harts': sample['harts'], 'metricsDropped': sample.get('metricsDropped'),
                              'all_retained': summarize(rows),
                              'after_readyz_end': summarize([r for r in rows if end is not None and r['ms'] >= end]),
                              'per_hart': {hart: summarize([r for r in rows if r['hart'] == hart]) for hart in range(sample['harts'])}})
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
