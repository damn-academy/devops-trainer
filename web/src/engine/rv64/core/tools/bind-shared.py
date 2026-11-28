#!/usr/bin/env python3
"""Route the core's raw `rv64shared` wasm imports to wasm functions.

wasm-bindgen turns an import module it does not own into an ES import of a
module named `rv64shared`. The SMP workers instead instantiate the direct
shared-bus module (smp.ts sharedAccessModule) and publish its exports as
globalThis.rv64SharedImports before initializing the core. Single-hart hosts
never touch shared RAM and get functions that fail loudly if called.
"""
import re, sys

path = sys.argv[1]
js = open(path).read()
star = re.search(r"^import \* as (__wbg_star\d+) from ['\"]rv64shared['\"];\n", js, re.M)
if not star:
    sys.exit(f"{path}: no rv64shared import emitted by wasm-bindgen")
name = star.group(1)
js = js.replace(star.group(0), "")
use = re.compile(r"imports\[['\"]rv64shared['\"]\] = " + name + ";")
if len(use.findall(js)) != 1:
    sys.exit(f"{path}: unexpected rv64shared import wiring")
stub = ("globalThis.rv64SharedImports ?? Object.fromEntries(['load', 'store', 'fetch', 'generation', 'cas', 'mark']"
        ".map(n => [n, () => { throw new Error('rv64shared.' + n + ' requires an SMP worker'); }]))")
js = use.sub(lambda _: "imports['rv64shared'] = " + stub + ";", js)
open(path, "w").write(js)
