package kuberoot

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMkimageAndArgs(t *testing.T) {
	got := strings.Join(MkimageArgs("mk", "arm64", "/a", "0.1.0", "/t", "/o.img", KernelArgs("eth1", "10.10.1.30", 24, "1.1.1.1")), " ")
	want := "mk -arch arm64 -artifacts /a -trust /t -out /o.img -version 0.1.0 -args kuberoot.nameserver=1.1.1.1 kuberoot.ip=eth1:10.10.1.30/24"
	if got != want {
		t.Errorf("%s\nwant %s", got, want)
	}
	if KernelArgs("", "", 0, "") != "" {
		t.Error("DHCP needs no arguments")
	}
	var m map[string]any
	if err := json.Unmarshal(InstallationManifest("vda"), &m); err != nil || m["kind"] != "Installation" || m["spec"].(map[string]any)["disk"] != "vda" {
		t.Error(m, err)
	}
}

func TestInstalled(t *testing.T) {
	if Installed([]BootEntry{{Booted: false, State: "Good"}}) || !Installed([]BootEntry{{Booted: true, State: "Good"}}) {
		t.Error("installed")
	}
}

func TestRewriteServer(t *testing.T) {
	kc := "clusters:\n- cluster:\n    certificate-authority-data: X\n    server: https://10.10.1.30:6443\n  name: k\n"
	got := RewriteServer(kc, "https://127.0.0.1:6443", "10.10.1.30")
	if !strings.Contains(got, "    server: https://127.0.0.1:6443\n    tls-server-name: 10.10.1.30\n") {
		t.Error(got)
	}
}

// A node API on httptest with mTLS: the client presents mkimage's admin
// certificate and trusts the serving CA under the name kuberoot-node.
func TestClientAgainstFakeNode(t *testing.T) {
	var installs int
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.TLS.PeerCertificates) == 0 {
			http.Error(w, "no client cert", 401)
			return
		}
		switch r.URL.Path {
		case group + "/osconfigs":
			_, _ = w.Write([]byte(`{"items":[]}`))
		case group + "/bootentries":
			_, _ = w.Write([]byte(`{"items":[{"metadata":{"name":"slot-a"},"status":{"booted":true,"state":"Good","release":"0.1"}}]}`))
		case group + "/installations":
			installs++
			w.WriteHeader(201)
		case group + "/kubeconfigs/admin":
			_, _ = w.Write([]byte(`{"kubeconfig":"server: https://x:6443\n"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	srv.TLS = &tls.Config{ClientAuth: tls.RequireAnyClientCert}
	srv.StartTLS()
	defer srv.Close()
	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw})
	// The test server's own certificate doubles as the client's.
	cert := srv.TLS.Certificates[0]
	keyDER, _ := x509.MarshalPKCS8PrivateKey(cert.PrivateKey)
	b64 := base64.StdEncoding.EncodeToString
	cfg := "    certificate-authority-data: " + b64(caPEM) + "\n    tls-server-name: example.com\n    client-certificate-data: " + b64(caPEM) + "\n    client-key-data: " + b64(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})) + "\n"
	a, err := ParseAdmin([]byte(cfg))
	if err != nil {
		t.Fatal(err)
	}
	c, err := NewClient(srv.URL, a)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := c.Ready(ctx); err != nil {
		t.Fatal(err)
	}
	e, err := c.BootEntries(ctx)
	if err != nil || !Installed(e) {
		t.Fatal(e, err)
	}
	if err := c.Install(ctx, "vda"); err != nil || installs != 1 {
		t.Fatal(err)
	}
	if kc, err := c.Kubeconfig(ctx); err != nil || !strings.Contains(kc, "server:") {
		t.Fatal(kc, err)
	}
}
