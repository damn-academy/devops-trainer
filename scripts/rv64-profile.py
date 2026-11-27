#!/usr/bin/env python3
"""Summarize V8 CPU samples by profile/thread, with self and inclusive weights."""
import collections, json, sys
trace = json.load(open(sys.argv[1]))['traceEvents']
profiles = {}
for event in trace:
    if event.get('name') != 'ProfileChunk':
        continue
    key = (event['pid'], event['tid'], event.get('id'))
    p = profiles.setdefault(key, {'nodes': {}, 'samples': []})
    data = event['args']['data']; cpu = data.get('cpuProfile', {})
    for node in cpu.get('nodes', []):
        p['nodes'][node['id']] = node
    samples = cpu.get('samples', [])
    # timeDeltas are microseconds; absent weights fall back to sample counts.
    weights = data.get('timeDeltas', [1000] * len(samples))
    p['samples'].extend(zip(samples, weights))
for key, p in profiles.items():
    own = collections.Counter(); inclusive = collections.Counter()
    def name(node):
        f = node['callFrame']
        return f.get('functionName') or f.get('url', '(anonymous)')
    for node_id, weight in p['samples']:
        node = p['nodes'].get(node_id)
        if not node:
            continue
        own[name(node)] += weight
        seen = set()
        while node:
            n = name(node)
            if n not in seen:
                inclusive[n] += weight; seen.add(n)
            node = p['nodes'].get(node.get('parent'))
    total = sum(own.values())
    print(json.dumps({'profile': key, 'sampledMs': total/1000,
        'self': [(k,round(v/1000,3),round(v/max(total,1)*100,2)) for k,v in own.most_common(25)],
        'inclusive': [(k,round(v/1000,3),round(v/max(total,1)*100,2)) for k,v in inclusive.most_common(25)]}, indent=2))
