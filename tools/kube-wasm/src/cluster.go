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

// Command kube-wasm runs etcd (in memory), kube-apiserver,
// kube-controller-manager, kube-scheduler and kubectl in one process. Built
// with GOOS=js it exposes a small API to JavaScript (see main_js.go); built
// natively it is a test driver (see main_other.go).
//
// All components talk over TCP addresses on 127.0.0.1. Under GOOS=js those
// connections stay inside the process: Go's js/wasm port implements
// net.Listen and net.Dial with an in-memory fake network.
package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/spf13/pflag"

	"k8s.io/apiserver/pkg/server/flagz"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	cliflag "k8s.io/component-base/cli/flag"
	basecompatibility "k8s.io/component-base/compatibility"
	"k8s.io/component-base/featuregate"
	logsapi "k8s.io/component-base/logs/api/v1"
	"k8s.io/klog/v2"

	apiserverapp "k8s.io/kubernetes/cmd/kube-apiserver/app"
	apiserveroptions "k8s.io/kubernetes/cmd/kube-apiserver/app/options"
	kcmapp "k8s.io/kubernetes/cmd/kube-controller-manager/app"
	kcmoptions "k8s.io/kubernetes/cmd/kube-controller-manager/app/options"
	schedapp "k8s.io/kubernetes/cmd/kube-scheduler/app"
	schedoptions "k8s.io/kubernetes/cmd/kube-scheduler/app/options"

	"k8s.io/kubernetes/cmd/kube-wasm/memetcd"
)

const (
	etcdAddr = "127.0.0.1:2379"
	// securePort is the real TLS port; the apiserver loopback clients use it.
	securePort = "6443"
	// plainAddr serves the same handler chain without TLS for in-process
	// clients (kubectl, controller-manager, scheduler). Like the insecure
	// port of old Kubernetes releases, requests on it act as the admin user.
	plainAddr = "127.0.0.1:8080"
	// advertiseAddr is where a node on the future virtual network will
	// reach the apiserver. Nothing listens on it yet.
	advertiseAddr = "10.0.2.2"
)

// Options select what Start runs.
type Options struct {
	PKIDir      string
	Verbosity   int
	Controllers bool
	Scheduler   bool

	kubeconfig string
}

// Cluster is one in-process control plane.
type Cluster struct {
	mu      sync.Mutex
	started bool
	ready   chan struct{}
	err     error
	// Kubeconfig is the admin kubeconfig written at start.
	Kubeconfig string
	Timings    map[string]time.Duration
	t0         time.Time
}

func NewCluster() *Cluster {
	return &Cluster{ready: make(chan struct{}), Timings: map[string]time.Duration{}}
}

func (c *Cluster) mark(phase string) {
	c.mu.Lock()
	c.Timings[phase] = time.Since(c.t0)
	c.mu.Unlock()
	klog.InfoS("kube-wasm phase", "phase", phase, "since_start", time.Since(c.t0))
}

// TimingsMillis returns a copy of the phase timings in milliseconds.
func (c *Cluster) TimingsMillis() map[string]any {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := map[string]any{}
	for k, v := range c.Timings {
		out[k] = v.Milliseconds()
	}
	return out
}

// Ready blocks until the apiserver reports /readyz ok or start failed.
func (c *Cluster) Ready(ctx context.Context) error {
	select {
	case <-c.ready:
		return c.err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Start launches all components in the background. It returns once the
// apiserver is constructed; use Ready to wait for it to serve.
func (c *Cluster) Start(ctx context.Context, o Options) error {
	c.mu.Lock()
	if c.started {
		c.mu.Unlock()
		return nil
	}
	c.started = true
	c.t0 = time.Now()
	c.mu.Unlock()

	fail := func(err error) error {
		c.err = err
		close(c.ready)
		return err
	}

	lis, err := net.Listen("tcp", etcdAddr)
	if err != nil {
		return fail(fmt.Errorf("etcd listen: %w", err))
	}
	memetcd.Serve(memetcd.NewStore(), lis)
	c.mark("etcd")

	if err := writePKI(o.PKIDir, []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("10.96.0.1"), net.ParseIP(advertiseAddr)}); err != nil {
		return fail(fmt.Errorf("pki: %w", err))
	}
	kubeconfig, token, err := writeAuth(o.PKIDir, "http://"+plainAddr)
	if err != nil {
		return fail(fmt.Errorf("auth: %w", err))
	}
	c.Kubeconfig = kubeconfig
	o.kubeconfig = kubeconfig
	c.mark("pki")

	handler, run, err := buildAPIServer(ctx, o)
	if err != nil {
		return fail(fmt.Errorf("kube-apiserver: %w", err))
	}
	c.mark("apiserver-built")

	plain, err := net.Listen("tcp", plainAddr)
	if err != nil {
		return fail(fmt.Errorf("plain listen: %w", err))
	}
	go func() {
		srv := &http.Server{Handler: plainHandler(handler, token), ReadHeaderTimeout: time.Minute}
		if err := srv.Serve(plain); err != nil {
			klog.ErrorS(err, "plain listener stopped")
		}
	}()
	go func() {
		if err := run(); err != nil {
			klog.ErrorS(err, "kube-apiserver exited")
		}
	}()

	go func() {
		if err := waitReady(ctx); err != nil {
			fail(err)
			return
		}
		c.mark("apiserver-ready")
		close(c.ready)
		if o.Controllers {
			if err := startControllerManager(ctx, o); err != nil {
				klog.ErrorS(err, "kube-controller-manager failed")
			} else {
				c.mark("controller-manager-started")
			}
		}
		if o.Scheduler {
			if err := startScheduler(ctx, o); err != nil {
				klog.ErrorS(err, "kube-scheduler failed")
			} else {
				c.mark("scheduler-started")
			}
		}
	}()
	return nil
}

// plainHTTPClient dials explicitly so that GOOS=js uses Go's own transport
// (and thus the in-process fake network) instead of the browser fetch API.
func plainHTTPClient() *http.Client {
	return &http.Client{Transport: &http.Transport{DialContext: (&net.Dialer{}).DialContext}, Timeout: 10 * time.Second}
}

// plainHandler authenticates every request without credentials as the
// admin user by adding its bearer token.
func plainHandler(h http.Handler, token string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		h.ServeHTTP(w, r)
	})
}

func waitReady(ctx context.Context) error {
	client := plainHTTPClient()
	var last string
	for i := 0; ; i++ {
		resp, err := client.Get("http://" + plainAddr + "/readyz")
		if err == nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
			last = string(body)
		} else {
			last = err.Error()
		}
		if i%50 == 49 {
			klog.InfoS("waiting for /readyz", "last", last)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("apiserver not ready: %s", last)
		case <-time.After(100 * time.Millisecond):
		}
	}
}

func parseFlags(name string, nfs cliflag.NamedFlagSets, args []string) error {
	fs := pflag.NewFlagSet(name, pflag.ContinueOnError)
	for _, f := range nfs.FlagSets {
		fs.AddFlagSet(f)
	}
	return fs.Parse(args)
}

// buildAPIServer follows cmd/kube-apiserver/app.NewAPIServerCommand and
// app.Run, but keeps the handler so it can also be served without TLS.
func buildAPIServer(ctx context.Context, o Options) (http.Handler, func() error, error) {
	s := apiserveroptions.NewServerRunOptions()
	nfs := s.Flags()
	pki := func(f string) string { return filepath.Join(o.PKIDir, f) }
	args := []string{
		"--etcd-servers=http://" + etcdAddr,
		"--bind-address=127.0.0.1",
		"--secure-port=" + securePort,
		"--advertise-address=" + advertiseAddr,
		"--tls-cert-file=" + pki("apiserver.crt"),
		"--tls-private-key-file=" + pki("apiserver.key"),
		"--client-ca-file=" + pki("ca.crt"),
		"--service-account-issuer=https://kubernetes.default.svc.cluster.local",
		"--service-account-key-file=" + pki("sa.pub"),
		"--service-account-signing-key-file=" + pki("sa.key"),
		"--service-cluster-ip-range=10.96.0.0/12",
		"--token-auth-file=" + pki("tokens.csv"),
		"--authorization-mode=Node,RBAC",
		// No reachable advertise address yet: do not publish endpoints for
		// the kubernetes service.
		"--endpoint-reconciler-type=none",
		"--enable-priority-and-fairness=false",
		"--profiling=false",
		"--allow-privileged=true",
		fmt.Sprintf("--v=%d", o.Verbosity),
	}
	if err := parseFlags("kube-apiserver", nfs, args); err != nil {
		return nil, nil, err
	}
	s.Flagz = flagz.NamedFlagSetsReader{FlagSets: nfs}
	if err := s.GenericServerRunOptions.ComponentGlobalsRegistry.Set(); err != nil {
		return nil, nil, err
	}
	rest.SetDefaultWarningHandler(rest.NoWarnings{})
	featureGate := s.GenericServerRunOptions.ComponentGlobalsRegistry.FeatureGateFor(basecompatibility.DefaultKubeComponent)
	if err := logsapi.ValidateAndApply(s.Logs, featureGate); err != nil {
		return nil, nil, err
	}
	completed, err := s.Complete(ctx)
	if err != nil {
		return nil, nil, err
	}
	if errs := completed.Validate(); len(errs) != 0 {
		return nil, nil, fmt.Errorf("%v", errs)
	}
	featureGate.(featuregate.MutableFeatureGate).AddMetrics()
	informerName, err := cache.NewInformerName("kube-apiserver")
	if err != nil {
		return nil, nil, err
	}
	completed.InformerName = informerName

	config, err := apiserverapp.NewConfig(completed)
	if err != nil {
		return nil, nil, err
	}
	cc, err := config.Complete()
	if err != nil {
		return nil, nil, err
	}
	server, err := apiserverapp.CreateServerChain(cc)
	if err != nil {
		return nil, nil, err
	}
	prepared, err := server.PrepareRun()
	if err != nil {
		return nil, nil, err
	}
	return server.GenericAPIServer.Handler, func() error { return prepared.Run(ctx) }, nil
}

func startControllerManager(ctx context.Context, o Options) error {
	s, err := kcmoptions.NewKubeControllerManagerOptions()
	if err != nil {
		return err
	}
	nfs := s.Flags(kcmapp.KnownControllers(), kcmapp.ControllersDisabledByDefault(), kcmapp.ControllerAliases())
	pki := func(f string) string { return filepath.Join(o.PKIDir, f) }
	args := []string{
		"--kubeconfig=" + o.kubeconfig,
		"--leader-elect=false",
		"--secure-port=0",
		"--use-service-account-credentials=false",
		"--service-account-private-key-file=" + pki("sa.key"),
		"--root-ca-file=" + pki("ca.crt"),
		"--cluster-signing-cert-file=" + pki("ca.crt"),
		"--cluster-signing-key-file=" + pki("ca.key"),
		"--cluster-cidr=10.244.0.0/16",
		"--allocate-node-cidrs=true",
		"--service-cluster-ip-range=10.96.0.0/12",
		fmt.Sprintf("--v=%d", o.Verbosity),
	}
	if err := parseFlags("kube-controller-manager", nfs, args); err != nil {
		return err
	}
	c, err := s.Config(ctx, kcmapp.KnownControllers(), kcmapp.ControllersDisabledByDefault(), kcmapp.ControllerAliases())
	if err != nil {
		return err
	}
	go func() {
		if err := kcmapp.Run(ctx, c.Complete()); err != nil {
			klog.ErrorS(err, "kube-controller-manager exited")
		}
	}()
	return nil
}

func startScheduler(ctx context.Context, o Options) error {
	opts := schedoptions.NewOptions()
	args := []string{
		"--kubeconfig=" + o.kubeconfig,
		"--leader-elect=false",
		"--secure-port=0",
		fmt.Sprintf("--v=%d", o.Verbosity),
	}
	if err := parseFlags("kube-scheduler", *opts.Flags, args); err != nil {
		return err
	}
	informerName, err := cache.NewInformerName("kube-scheduler")
	if err != nil {
		return err
	}
	opts.InformerName = informerName
	cc, sched, err := schedapp.Setup(ctx, opts)
	if err != nil {
		return err
	}
	go func() {
		if err := schedapp.Run(ctx, cc, sched); err != nil {
			klog.ErrorS(err, "kube-scheduler exited")
		}
	}()
	return nil
}
