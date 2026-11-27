#!/usr/bin/env python3
"""Extract only observed Kubernetes markers and command timings from a browser result."""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('result', type=Path)
args = parser.parse_args()
document = json.loads(args.result.read_text())
result = document['result']
console = result.get('console', '').replace('\r', '')

def timings(name):
    durations = []
    for block in re.findall(rf'(?:^|\n)RV64_{name}_BEGIN\n(.*?)\nRV64_{name}_END(?=\n|$)', console, re.S):
        stamps = re.findall(r'^(\d+\.\d+) \d+\.\d+\s*$', block, re.M)
        if len(stamps) >= 2:
            durations.append(round(float(stamps[-1]) - float(stamps[0]), 3))
    return durations

samples = result.get('samples', [])
last = samples[-1] if samples else {}
print(json.dumps(dict(
    resultType=result.get('type'), error=result.get('error'),
    readyObservedSeconds=result.get('bootReadyMs', 0)/1000 if 'bootReadyMs' in result else None,
    getPodsSeconds=timings('GET_PODS'), podStartSeconds=timings('POD_START'),
    probeDone='\nRV64_PROBE_DONE\n' in console,
    observedSeconds=last.get('elapsedMs', 0)/1000,
    busyMips=last.get('retired', 0)/max(last.get('busyMilliseconds', 0), 1)/1000,
    effectiveMips=last.get('retired', 0)/max(last.get('elapsedMs', 0), 1)/1000,
    tlsTimeoutLines=sum('TLS handshake timeout' in line for line in console.splitlines()),
    postStartFailures=[line for line in console.splitlines() if 'PostStartHook' in line and 'failed:' in line],
    restarts=[line for line in console.splitlines() if 'exited (code' in line],
    wasmSha256=document.get('wasmSha256'), jitSourceSha256=document.get('jitSourceSha256'),
), indent=2))
