//go:build !js

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
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"k8s.io/client-go/tools/clientcmd"
)

// Native test driver: starts the control plane, then runs each argument as
// one kubectl command line and prints its output and latency. It exercises
// the same code as the browser build, minus syscall/js.
func main() {
	dir, err := os.MkdirTemp("", "kube-wasm-pki")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	ctx := context.Background()
	c := NewCluster()
	t0 := time.Now()
	v, _ := strconv.Atoi(os.Getenv("KW_V"))
	o := Options{PKIDir: dir, Verbosity: v, Controllers: os.Getenv("KW_NO_KCM") == "", Scheduler: os.Getenv("KW_NO_SCHED") == ""}
	if err := c.Start(ctx, o); err != nil {
		fmt.Fprintln(os.Stderr, "start:", err)
		os.Exit(1)
	}
	if err := c.Ready(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "ready:", err)
		os.Exit(1)
	}
	fmt.Printf("== ready in %v\n", time.Since(t0))
	for _, line := range os.Args[1:] {
		if strings.HasPrefix(line, "sleep ") {
			d, _ := time.ParseDuration(strings.TrimPrefix(line, "sleep "))
			time.Sleep(d)
			continue
		}
		if strings.HasPrefix(line, "GET ") {
			rawGet(c.Kubeconfig, strings.TrimPrefix(line, "GET "))
			continue
		}
		t := time.Now()
		out, errOut, code := Kubectl(c.Kubeconfig, strings.Fields(line), "")
		fmt.Printf("== kubectl %s  (code %d, %v)\n%s%s", line, code, time.Since(t), out, errOut)
	}
	fmt.Printf("== timings %v\n", c.TimingsMillis())
}

// rawGet prints the status and the start of the body of one plain request.
func rawGet(kubeconfig, path string) {
	cfg, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		fmt.Println(err)
		return
	}
	req, _ := http.NewRequest(http.MethodGet, cfg.Host+path, nil)
	req.Header.Set("Accept", "application/json")
	resp, err := plainHTTPClient().Do(req)
	if err != nil {
		fmt.Println("== GET", path, err)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 600))
	fmt.Printf("== GET %s -> %d %v\n%s\n", path, resp.StatusCode, resp.Header, body)
}
