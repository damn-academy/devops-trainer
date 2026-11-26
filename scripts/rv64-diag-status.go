// Read-only client for kinit's local service status API; no Kubernetes dependency.
package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

func main() {
	client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", "/run/kuberoot/kinit.sock")
		},
	}}
	resp, err := client.Get("http://kinit/v1/services")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		fmt.Fprintln(os.Stderr, resp.Status)
		os.Exit(1)
	}
	if _, err := io.Copy(os.Stdout, io.LimitReader(resp.Body, 1048576)); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
