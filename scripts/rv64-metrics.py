#!/usr/bin/env python3
"""Summarize measured counters; rates use sampled wall time, not guest cycles."""
import json, re, sys
if '--native' in sys.argv:
    text = open(sys.argv[1]).read()
    rows = re.findall(r'^METRICS (.+)$', text, re.M)
    elapsed = re.search(r'elapsed_ms=(\d+) retired=(\d+)', text)
    if not rows or not elapsed:
        raise SystemExit('native run has no final timing/counters')
    counters = json.loads(rows[-1]); seconds = int(elapsed[1])/1000
    timing = re.search(r'BUSY_MS=([^ ]+) IDLE_MS=([^ ]+) BUSY_MIPS=([^ ]+)', text)
    print(json.dumps(dict(seconds=seconds, retired=int(elapsed[2]), jitAvailable=False,
        busyMips=float(timing[3]) if timing else None,
        idleMs=float(timing[2]) if timing else None,
        perSecond={k: ([x/seconds for x in v] if isinstance(v,list) else v/seconds)
                   for k,v in counters.items()}), indent=2))
    raise SystemExit()
if '--pod-v8' in sys.argv or '--stream' in sys.argv:
    lines = open(sys.argv[1]).read().splitlines()
    rows = [json.loads(line.split(' ',1)[1]) for line in lines if line.startswith(('METRICS {','RESULT {'))]
    r = {'samples': rows}
else:
    r = json.load(open(sys.argv[1]))['result']
samples = r.get('samples', [])
if '--until' in sys.argv:
    limit = float(sys.argv[sys.argv.index('--until') + 1]) * 1000
    samples = [sample for sample in samples if sample['elapsedMs'] <= limit]
if not samples:
    raise SystemExit('no diagnostic samples')
last = samples[-1]
start = samples[0] if '--interval' in sys.argv else {}
seconds = (last['elapsedMs'] - start.get('elapsedMs', 0)) / 1000
c = last['counters']; prev = start.get('counters', {})
delta = {k: v - prev.get(k, 0) for k, v in c.items() if isinstance(v, (int, float))}
retired = last['retired'] - start.get('retired', 0)
jit = last['jitRetired'] - start.get('jitRetired', 0)
busy = last['busyMilliseconds'] - start.get('busyMilliseconds', 0)
report = dict(seconds=seconds, retired=retired, busyMilliseconds=busy,
    busyMips=retired/busy/1000, effectiveMips=retired/seconds/1e6,
    jitShare=jit/retired, instructionsPerDispatch=jit/max(delta['jit_dispatches'],1),
    contextHitRate=delta['jit_context_hits']/max(delta['jit_lookups'],1),
    rustTlbWalkRate=delta['tlb_walks']/max(delta['tlb_requests'],1),
    compiledDispatchRate=delta['jit_dispatches']/max(delta['jit_lookups'],1),
    meanInstructionsPerGeneratedBlock=jit/max(delta['jit_dispatches']+delta.get('jit_chains',0),1),
    inlineTlbMissRate=delta.get('inline_tlb_misses',0)/max(delta.get('inline_tlb_checks',0),1),
    compiler=last['compiler'], perSecond={k:v/seconds for k,v in delta.items()})
for k in ['waitMs','diskMs','diskActiveMs','compilerYieldMs']:
    if k in last: report[k] = last[k] - start.get(k,0)
for k in ['exceptions','interrupts']:
    report[k+'PerSecond'] = [(v-start.get('counters',{}).get(k,[0]*16)[i])/seconds for i,v in enumerate(c[k])]
print(json.dumps(report, indent=2))
