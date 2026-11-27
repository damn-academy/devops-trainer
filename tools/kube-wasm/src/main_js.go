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
	"net"
	"net/http"
	"runtime"
	"syscall/js"
)

func init() {
	// client-go uses http.DefaultTransport for plain-HTTP configs. On
	// GOOS=js that transport goes through the browser fetch API unless a
	// dialer is set; with one it uses Go's HTTP stack over the in-process
	// fake network, where the apiserver listens.
	http.DefaultTransport.(*http.Transport).DialContext = (&net.Dialer{}).DialContext
}

// The JavaScript API, installed as globalThis.kubeWasm:
//
//	start(opts?: {v?: number, controllers?: boolean, scheduler?: boolean,
//	              apiserverArgs?: string[], controllerManagerArgs?: string[]}): Promise<void>
//	              restore?: {pki: {[file]: Uint8Array}, etcd: Uint8Array}}   // from saveState
//	saveState(): Promise<{pki: {[file]: Uint8Array}, etcd: Uint8Array}>
//	memStats(): {heapAlloc, heapSys, sys, numGC}   // Go runtime, bytes
//	ready(): Promise<{[phase: string]: number}>   // phase timings in ms
//	kubectl(args: string[], stdin?: string): Promise<{stdout, stderr, code}>
//	connect(addr: string, onData: (b: Uint8Array) => void, onClose: (err?: string) => void): {write, end, close}
//	listen(addr: string, onConn: (c: {start(onData, onClose), write, end, close}) => void): string | null   // error
//	joinMembership(nodeName: string, nodeIP: string): Promise<string>   // kuberoot Membership JSON
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
			o.APIServerArgs = jsStrings(args[0].Get("apiserverArgs"))
			if r := args[0].Get("restore"); r.Type() == js.TypeObject {
				o.Restore = &State{PKI: map[string][]byte{}, Etcd: jsBytes(r.Get("etcd"))}
				files := r.Get("pki")
				keys := js.Global().Get("Object").Call("keys", files)
				for i := 0; i < keys.Length(); i++ {
					name := keys.Index(i).String()
					o.Restore.PKI[name] = jsBytes(files.Get(name))
				}
			}
			o.ControllerManagerArgs = jsStrings(args[0].Get("controllerManagerArgs"))
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

	api.Set("saveState", js.FuncOf(func(js.Value, []js.Value) any {
		return promise(func() (any, error) {
			st, err := cluster.SaveState()
			if err != nil {
				return nil, err
			}
			files := js.Global().Get("Object").New()
			for name, data := range st.PKI {
				files.Set(name, toJSBytes(data))
			}
			out := js.Global().Get("Object").New()
			out.Set("pki", files)
			out.Set("etcd", toJSBytes(st.Etcd))
			return out, nil
		})
	}))

	api.Set("memStats", js.FuncOf(func(js.Value, []js.Value) any {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		return map[string]any{"heapAlloc": float64(m.HeapAlloc), "heapSys": float64(m.HeapSys), "sys": float64(m.Sys), "numGC": int(m.NumGC)}
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

	api.Set("connect", js.FuncOf(func(_ js.Value, args []js.Value) any {
		return newBridge(args[0].String(), args[1], args[2])
	}))

	api.Set("listen", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if err := listenBridge(args[0].String(), args[1]); err != nil {
			return err.Error()
		}
		return nil
	}))

	api.Set("joinMembership", js.FuncOf(func(_ js.Value, args []js.Value) any {
		name, ip := args[0].String(), args[1].String()
		return promise(func() (any, error) {
			if err := cluster.Ready(ctx); err != nil {
				return nil, err
			}
			return cluster.JoinMembership(name, ip)
		})
	}))

	js.Global().Set("kubeWasm", api)
	if cb := js.Global().Get("__kubeWasmLoaded"); cb.Type() == js.TypeFunction {
		cb.Invoke()
	}
	select {}
}

func jsBytes(v js.Value) []byte {
	b := make([]byte, v.Length())
	js.CopyBytesToGo(b, v)
	return b
}

func toJSBytes(b []byte) js.Value {
	v := js.Global().Get("Uint8Array").New(len(b))
	js.CopyBytesToJS(v, b)
	return v
}

// jsStrings converts a JavaScript array of strings (or undefined) to Go.
func jsStrings(v js.Value) []string {
	if v.Type() != js.TypeObject {
		return nil
	}
	out := make([]string, v.Length())
	for i := range out {
		out[i] = v.Index(i).String()
	}
	return out
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
