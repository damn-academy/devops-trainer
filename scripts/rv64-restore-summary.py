#!/usr/bin/env python3
"""Summarize retained Chromium restore evidence without changing timing boundaries."""
import json
from pathlib import Path
import re
import sys

for name in sys.argv[1:]:
    document = json.loads(Path(name).read_text())
    result = document['result']
    console = result.get('console', '')
    def durations(begin, end):
        values = []
        for match in re.finditer(begin + r'\n(.*?)' + end, console, re.S):
            times = re.findall(r'^(\d+\.\d+) \d+\.\d+\r?$', match[1], re.M)
            if len(times) >= 2:
                values.append(round(float(times[-1]) - float(times[0]), 3))
        return values
    samples = result.get('samples', [])
    selected = []
    for seconds in [1, 5, 10, 30, 60]:
        if not samples or samples[-1]['elapsedMs'] < seconds * 1000:
            continue
        s = min(samples, key=lambda s: abs(s['elapsedMs'] - seconds * 1000))
        keys = ['elapsedMs', 'snapshotFaults', 'snapshotFaultMs', 'retiredSinceStart',
                'jitRetired', 'busyMilliseconds', 'waitMs', 'diskActiveMs', 'compilerYieldMs']
        selected.append({k: s.get(k) for k in keys})
    summary = {'source': name, 'type': result['type'], 'error': result.get('error'),
               'wasmSha256': document.get('wasmSha256'), 'sourceSha256': document.get('jitSourceSha256'),
               'memoryMB': result.get('memoryMB'),
               'clock': samples[0].get('restoreClock') if samples else None,
               'engineReadyMs': result.get('engineReadyMs'), 'nodeReadyMs': result.get('bootReadyMs'),
               'getPodsSeconds': durations('RV64_GET_PODS_BEGIN', 'RV64_GET_PODS_END'),
               'podStartSeconds': durations('RV64_POD_START_BEGIN', 'RV64_POD_START_END'),
               'probeDone': 'RV64_PROBE_DONE' in console,
               'rcuStalls': console.count('self-detected stall'),
               'expiredBookmarks': console.count('event bookmark expired'), 'samples': selected}
    print(json.dumps(summary, indent=2))
