// A proxy for the start of a Kubernetes component: the binary links net/http,
// crypto/tls, crypto/x509 and encoding/json (their package init runs before
// main), then does what an apiserver does at start-up on a small scale: makes a
// serving certificate, starts an HTTPS listener, answers a request and decodes
// a JSON list of objects.
package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"time"
)

type object struct {
	APIVersion string            `json:"apiVersion"`
	Kind       string            `json:"kind"`
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Labels     map[string]string `json:"labels"`
	Replicas   int               `json:"replicas"`
}

func main() {
	start := time.Now()
	phase := func(name string) {
		fmt.Printf("%-10s %7.1f ms\n", name, float64(time.Since(start).Microseconds())/1000)
	}
	phase("main")

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	check(err)
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "r0-apiserver"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	check(err)
	phase("cert")

	items := make([]object, 1000)
	for i := range items {
		items[i] = object{"v1", "Pod", fmt.Sprintf("web-%d", i), "default",
			map[string]string{"app": "web", "tier": "frontend"}, 1}
	}
	body, err := json.Marshal(items)
	check(err)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	check(err)
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	})}
	cert := tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
	go srv.Serve(tls.NewListener(ln, &tls.Config{Certificates: []tls.Certificate{cert}}))
	phase("listen")

	pool := x509.NewCertPool()
	parsed, err := x509.ParseCertificate(der)
	check(err)
	pool.AddCert(parsed)
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool}}}
	resp, err := client.Get("https://" + ln.Addr().String() + "/api/v1/pods")
	check(err)
	raw, err := io.ReadAll(resp.Body)
	check(err)
	resp.Body.Close()
	phase("https-get")

	var got []object
	check(json.Unmarshal(raw, &got))
	phase("json")
	fmt.Printf("decoded %d objects, %d bytes\n", len(got), len(raw))
}

func check(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
