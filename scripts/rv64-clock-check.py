#!/usr/bin/env python3
"""Summarize real host/guest time samples; never infer Ready from elapsed time."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('result', type=Path)
parser.add_argument('--stream', action='store_true')
args = parser.parse_args()
raw = args.result.read_text()
if args.stream:
    samples = [json.loads(line[8:]) for line in raw.splitlines() if line.startswith('METRICS {')]
else:
    samples = json.loads(raw)['result']['samples']
samples = [s for s in samples if 'guestTicks' in s]
if len(samples) < 2:
    raise SystemExit('need at least two clock telemetry samples')
first, last = samples[0], samples[-1]
hz = first['timebaseHz']
assert all(s['timebaseHz'] == hz for s in samples)
wall = last['hostMonotonicMs'] - first['hostMonotonicMs']
guest = (last['guestTicks'] - first['guestTicks']) * 1000 / hz
host_delta = last['hostTicks'] - first['hostTicks']
print(json.dumps(dict(
    samples=len(samples), timebaseHz=hz, wallMs=wall, guestMs=guest,
    guestToWallRatio=guest/wall,
    guestMinusHostDeltaTicks=last['guestTicks']-first['guestTicks']-host_delta,
    guestBacksteps=sum(b['guestTicks'] < a['guestTicks'] for a,b in zip(samples,samples[1:])),
    # Restores rebase host ticks. Without the saved offset, an absolute lag
    # would incorrectly include the entire pre-snapshot guest uptime.
    maxHostSampleLagMs=(max(s['hostMonotonicMs']-(s['hostTicks']-s['hostTickOffset'])*1000/hz for s in samples)
                        if all('hostTickOffset' in s for s in samples) else None),
    retired=last['retired']-first['retired'],
), indent=2))
