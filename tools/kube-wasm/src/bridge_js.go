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
	"net"
	"sync"
	"syscall/js"
)

// bridge carries one TCP stream between JavaScript and a listener inside
// this process. The page accepts a node's connection on its emulated
// network (for example to 10.0.0.1:6443) and hands the bytes here; they
// reach the apiserver's TLS port unchanged, so TLS stays end to end between
// the kubelet and kube-apiserver.
//
// JS API: connect(addr, onData(Uint8Array), onClose(error?)) returns
// {write(Uint8Array), end(), close()}.
type bridge struct {
	out     chan []byte
	once    sync.Once
	onData  js.Value
	onClose js.Value
	closed  chan struct{}
	conn    net.Conn
	mu      sync.Mutex
}

func newBridge(addr string, onData, onClose js.Value) js.Value {
	b := &bridge{out: make(chan []byte, 1024), onData: onData, onClose: onClose, closed: make(chan struct{})}
	go b.run(addr)
	obj := js.Global().Get("Object").New()
	obj.Set("write", js.FuncOf(func(_ js.Value, args []js.Value) any {
		buf := make([]byte, args[0].Length())
		js.CopyBytesToGo(buf, args[0])
		select {
		case b.out <- buf:
		case <-b.closed:
		}
		return nil
	}))
	obj.Set("end", js.FuncOf(func(js.Value, []js.Value) any {
		select {
		case b.out <- nil: // nil marks the end of the stream
		case <-b.closed:
		}
		return nil
	}))
	obj.Set("close", js.FuncOf(func(js.Value, []js.Value) any {
		b.finish("")
		return nil
	}))
	return obj
}

func (b *bridge) finish(reason string) {
	b.once.Do(func() {
		close(b.closed)
		b.mu.Lock()
		if b.conn != nil {
			b.conn.Close()
		}
		b.mu.Unlock()
		if reason == "" {
			b.onClose.Invoke()
		} else {
			b.onClose.Invoke(reason)
		}
	})
}

func (b *bridge) run(addr string) {
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		b.finish(err.Error())
		return
	}
	b.mu.Lock()
	b.conn = conn
	b.mu.Unlock()
	go func() {
		buf := make([]byte, 64*1024)
		for {
			n, err := conn.Read(buf)
			if n > 0 {
				chunk := js.Global().Get("Uint8Array").New(n)
				js.CopyBytesToJS(chunk, buf[:n])
				b.onData.Invoke(chunk)
			}
			if err != nil {
				b.finish("")
				return
			}
		}
	}()
	for {
		select {
		case data := <-b.out:
			if data == nil {
				if tc, ok := conn.(interface{ CloseWrite() error }); ok {
					_ = tc.CloseWrite()
				}
				continue
			}
			if _, err := conn.Write(data); err != nil {
				b.finish(err.Error())
				return
			}
		case <-b.closed:
			return
		}
	}
}
