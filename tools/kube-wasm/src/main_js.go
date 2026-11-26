//go:build js

/*
Copyright 2026 The damn.academy Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"context"
	"syscall/js"
)

// The JavaScript API, installed as globalThis.kubeWasm:
//
//	start(opts?: {v?: number, controllers?: boolean, scheduler?: boolean}): Promise<void>
//	ready(): Promise<{[phase: string]: number}>   // phase timings in ms
//	kubectl(args: string[], stdin?: string): Promise<{stdout, stderr, code}>
//
// The file system the Go side sees (PKI files, kubectl caches) is provided
// by the page loader; see web/src/engine/kube-wasm/loader.ts.
func main() {
	ctx := context.Background()
	cluster := NewCluster()
	api := js.Global().Get("Object").New()

	api.Set("start", js.FuncOf(func(_ js.Value, args []js.Value) any {
		o := Options{PKIDir: "/etc/kubernetes/pki", Controllers: true, Scheduler: true}
		if len(args) > 0 && args[0].Type() == js.TypeObject {
			if v := args[0].Get("v"); v.Type() == js.TypeNumber {
				o.Verbosity = v.Int()
			}
			if v := args[0].Get("controllers"); v.Type() == js.TypeBoolean {
				o.Controllers = v.Bool()
			}
			if v := args[0].Get("scheduler"); v.Type() == js.TypeBoolean {
				o.Scheduler = v.Bool()
			}
		}
		return promise(func() (any, error) { return nil, cluster.Start(ctx, o) })
	}))

	api.Set("ready", js.FuncOf(func(js.Value, []js.Value) any {
		return promise(func() (any, error) {
			if err := cluster.Ready(ctx); err != nil {
				return nil, err
			}
			return cluster.TimingsMillis(), nil
		})
	}))

	api.Set("timings", js.FuncOf(func(js.Value, []js.Value) any {
		return cluster.TimingsMillis()
	}))

	api.Set("kubectl", js.FuncOf(func(_ js.Value, args []js.Value) any {
		var argv []string
		if len(args) > 0 {
			for i := 0; i < args[0].Length(); i++ {
				argv = append(argv, args[0].Index(i).String())
			}
		}
		stdin := ""
		if len(args) > 1 && args[1].Type() == js.TypeString {
			stdin = args[1].String()
		}
		return promise(func() (any, error) {
			out, errOut, code := Kubectl(cluster.Kubeconfig, argv, stdin)
			return map[string]any{"stdout": out, "stderr": errOut, "code": code}, nil
		})
	}))

	js.Global().Set("kubeWasm", api)
	if cb := js.Global().Get("__kubeWasmLoaded"); cb.Type() == js.TypeFunction {
		cb.Invoke()
	}
	select {}
}

// promise runs fn on a new goroutine (JS callbacks must not block) and
// settles a JavaScript Promise with its result.
func promise(fn func() (any, error)) js.Value {
	return js.Global().Get("Promise").New(js.FuncOf(func(_ js.Value, args []js.Value) any {
		resolve, reject := args[0], args[1]
		go func() {
			v, err := fn()
			if err != nil {
				reject.Invoke(js.Global().Get("Error").New(err.Error()))
				return
			}
			resolve.Invoke(v)
		}()
		return nil
	}))
}
