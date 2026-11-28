"""Common old/R10 capture traversal. Times are host milliseconds from request."""


def runs(document):
    result = document['result']
    if result.get('type') == 'smp-kuberoot':
        for run in result['samples']:
            for hart in range(run['harts']):
                yield hart, dict(run, samples=[dict(m, elapsedMs=m['ms'])
                    for m in run['metrics'] if m.get('hart') == hart])
    else:
        yield 0, result


def marker(result, name):
    if name in result.get('markers', {}):
        return result['markers'][name]
    console = result.get('console', '')
    offset = console.find('\n' + name + '\n')
    if offset < 0:
        return None
    return next((e['ms'] for e in result.get('events', [])
                 if e.get('consoleEnd', 0) > offset + len(name)), None)


def row_ms(result, sample, row):
    ticks = row[5]
    if 'guestEpochOffsetMs' in result:
        return ticks / 10000 + result['guestEpochOffsetMs']
    offset = (sample['hostMonotonicMs'] - sample['elapsedMs'] - result['profileRequestedAt']
              if 'profileRequestedAt' in result else result.get('engineReadyMs', 0))
    return offset + sample['elapsedMs'] - (sample['guestTicks'] - ticks) / 10000


def tls_windows(result):
    return [('config-to-readyz', marker(result, 'RV64_CONFIG_CREATED'), marker(result, 'RV64_READYZ_BEGIN')),
            ('readyz-loop', marker(result, 'RV64_READYZ_BEGIN'), marker(result, 'RV64_READYZ_END')),
            ('after-readyz-end', marker(result, 'RV64_READYZ_END'), result.get('elapsedMs'))]


def category(function, mode):
    # Exclusive leaf-PC buckets, not inclusive caller costs.
    f = function.lower()
    if mode != 0:
        return 'idle' if function in ('cpu_do_idle', 'arch_cpu_idle', 'default_idle_call') else 'kernel'
    if 'crypto/tls.' in f:
        return 'crypto/tls'
    if 'bigmod' in f or 'math/big.' in f or '/fiat.' in f or '/field.' in f:
        return 'bigmod/field/math-big'
    if 'nistec' in f or 'p256' in f:
        return 'nistec/P-256'
    if f.startswith('runtime.'):
        if any(x in f for x in ('gc', 'scanobject', 'greyobject', 'markroot', 'sweep', 'wbbuf')):
            return 'Go GC'
        if any(x in f for x in ('schedule', 'findrunnable', 'park', 'ready', 'gosched', 'execute', 'stealwork', 'netpoll', 'sema', 'futex', 'notetsleep', 'notesleep', 'wakep', 'stopm', 'startm')):
            return 'Go scheduler'
        return 'Go runtime other'
    if 'sqlite' in f or '/kine' in f:
        return 'SQLite/kine'
    return 'other'
