// Package kuberoot prepares and installs the lab's kuberoot node: boot
// media written by kuberoot's own `mkimage` with a trust directory of this
// lab, then an Installation through the node API onto the VM's system disk,
// and finally the cluster's admin kubeconfig from the same API.
//
// kuberoot has no SSH and no cloud-init: everything goes through its node
// API (https://<node>:50000), whose admin credentials mkimage writes into
// the trust directory.
package kuberoot

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const group = "/apis/node.kuberoot.dev/v1alpha1"

// Artifacts a media is written from (a kuberoot build or release).
var Artifacts = []string{"vmlinuz.efi", "initrd.cpio", "rootfs.squashfs", "systemd-boot.efi", "VERSION"}

// KernelArgs of the lab's node. With the lab's DHCP (QEMU) the node takes
// its fixed address by DHCP and needs nothing; on Hyper-V the lab card is
// the second one and has no DHCP, so its address is given.
func KernelArgs(staticIface, ip string, prefix int, nameserver string) string {
	var a []string
	if nameserver != "" {
		a = append(a, "kuberoot.nameserver="+nameserver)
	}
	if staticIface != "" {
		a = append(a, fmt.Sprintf("kuberoot.ip=%s:%s/%d", staticIface, ip, prefix))
	}
	return strings.Join(a, " ")
}

// MkimageArgs is the command that writes the lab's media.
func MkimageArgs(mkimage, arch, artifacts, version, trust, out, kernelArgs string) []string {
	a := []string{mkimage, "-arch", arch, "-artifacts", artifacts, "-trust", trust, "-out", out}
	if version != "" {
		a = append(a, "-version", version)
	}
	if kernelArgs != "" {
		a = append(a, "-args", kernelArgs)
	}
	return a
}

// InstallationManifest installs onto the system disk, the first virtio
// disk (vda) because the lab attaches it before the media; reboot: true
// boots the installed system, whose disk comes first in the boot order.
func InstallationManifest(disk string) []byte {
	raw, _ := json.Marshal(map[string]any{
		"apiVersion": "node.kuberoot.dev/v1alpha1",
		"kind":       "Installation",
		"metadata":   map[string]string{"name": "dtlab"},
		"spec":       map[string]any{"disk": disk, "reboot": true},
	})
	return raw
}

// Client talks to a node API with the trust directory's admin credentials.
type Client struct {
	Server string // https://127.0.0.1:50000
	HTTP   *http.Client
}

// AdminConfig is what mkimage's admin.kubeconfig holds.
type AdminConfig struct {
	CA, Cert, Key []byte
	ServerName    string
}

// LoadAdmin reads <trust>/admin.kubeconfig (written by mkimage in a fixed
// form: one cluster, one user).
func LoadAdmin(trust string) (AdminConfig, error) {
	raw, err := os.ReadFile(filepath.Join(trust, "admin.kubeconfig"))
	if err != nil {
		return AdminConfig{}, err
	}
	return ParseAdmin(raw)
}

// ParseAdmin pulls the base64 fields out of the kubeconfig text.
func ParseAdmin(raw []byte) (AdminConfig, error) {
	var c AdminConfig
	field := func(name string) ([]byte, error) {
		for _, l := range strings.Split(string(raw), "\n") {
			if v, ok := strings.CutPrefix(strings.TrimSpace(l), name+":"); ok {
				return base64.StdEncoding.DecodeString(strings.TrimSpace(v))
			}
		}
		return nil, fmt.Errorf("admin.kubeconfig has no %s", name)
	}
	var err error
	if c.CA, err = field("certificate-authority-data"); err != nil {
		return c, err
	}
	if c.Cert, err = field("client-certificate-data"); err != nil {
		return c, err
	}
	if c.Key, err = field("client-key-data"); err != nil {
		return c, err
	}
	c.ServerName = "kuberoot-node"
	for _, l := range strings.Split(string(raw), "\n") {
		if v, ok := strings.CutPrefix(strings.TrimSpace(l), "tls-server-name:"); ok {
			c.ServerName = strings.TrimSpace(v)
		}
	}
	return c, nil
}

// NewClient builds an mTLS client for the node API.
func NewClient(server string, a AdminConfig) (*Client, error) {
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(a.CA) {
		return nil, fmt.Errorf("node API: bad CA")
	}
	cert, err := tls.X509KeyPair(a.Cert, a.Key)
	if err != nil {
		return nil, err
	}
	tr := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, Certificates: []tls.Certificate{cert}, ServerName: a.ServerName, MinVersion: tls.VersionTLS12}}
	return &Client{Server: strings.TrimRight(server, "/"), HTTP: &http.Client{Transport: tr, Timeout: 20 * time.Second}}, nil
}

func (c *Client) do(ctx context.Context, method, path string, body []byte) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.Server+path, bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	return out, resp.StatusCode, err
}

// Ready: the node API answers.
func (c *Client) Ready(ctx context.Context) error {
	_, code, err := c.do(ctx, http.MethodGet, group+"/osconfigs", nil)
	if err != nil {
		return err
	}
	if code != http.StatusOK {
		return fmt.Errorf("node API: HTTP %d", code)
	}
	return nil
}

// BootEntry is the part of a bootentry the lab reads.
type BootEntry struct {
	Name    string
	Booted  bool
	State   string
	Release string
}

// BootEntries lists the node's slots; on the live media there are none.
func (c *Client) BootEntries(ctx context.Context) ([]BootEntry, error) {
	raw, code, err := c.do(ctx, http.MethodGet, group+"/bootentries", nil)
	if err != nil {
		return nil, err
	}
	if code != http.StatusOK {
		return nil, fmt.Errorf("bootentries: HTTP %d: %s", code, short(raw))
	}
	var l struct {
		Items []struct {
			Metadata struct{ Name string }
			Status   struct {
				Booted  bool
				State   string
				Release string
			}
		}
	}
	if err := json.Unmarshal(raw, &l); err != nil {
		return nil, err
	}
	var out []BootEntry
	for _, i := range l.Items {
		out = append(out, BootEntry{i.Metadata.Name, i.Status.Booted, i.Status.State, i.Status.Release})
	}
	return out, nil
}

// Installed: the node runs from its disk and the slot is Good.
func Installed(e []BootEntry) bool {
	for _, b := range e {
		if b.Booted && b.State == "Good" {
			return true
		}
	}
	return false
}

// Install creates the Installation (an existing one is fine).
func (c *Client) Install(ctx context.Context, disk string) error {
	raw, code, err := c.do(ctx, http.MethodPost, group+"/installations", InstallationManifest(disk))
	if err != nil {
		return err
	}
	if code != http.StatusCreated && code != http.StatusOK && code != http.StatusConflict {
		return fmt.Errorf("installation: HTTP %d: %s", code, short(raw))
	}
	return nil
}

// Kubeconfig fetches the cluster's admin kubeconfig. The node API writes
// the server address it was reached at; the lab rewrites it to the host's
// forwarded port.
func (c *Client) Kubeconfig(ctx context.Context) (string, error) {
	raw, code, err := c.do(ctx, http.MethodGet, group+"/kubeconfigs/admin", nil)
	if err != nil {
		return "", err
	}
	if code != http.StatusOK {
		return "", fmt.Errorf("kubeconfig: HTTP %d: %s", code, short(raw))
	}
	var k struct{ Kubeconfig string }
	if err := json.Unmarshal(raw, &k); err != nil {
		return "", err
	}
	if k.Kubeconfig == "" {
		return "", fmt.Errorf("kubeconfig: empty")
	}
	return k.Kubeconfig, nil
}

// RewriteServer points a kubeconfig at server, keeping the node's own
// address as the TLS name the API server's certificate carries.
func RewriteServer(kubeconfig, server, tlsName string) string {
	var out []string
	for _, l := range strings.Split(kubeconfig, "\n") {
		t := strings.TrimSpace(l)
		if strings.HasPrefix(t, "server:") {
			ind := l[:len(l)-len(strings.TrimLeft(l, " "))]
			out = append(out, ind+"server: "+server)
			if tlsName != "" {
				out = append(out, ind+"tls-server-name: "+tlsName)
			}
			continue
		}
		if strings.HasPrefix(t, "tls-server-name:") {
			continue
		}
		out = append(out, l)
	}
	return strings.Join(out, "\n")
}

func short(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 300 {
		s = s[:300] + "..."
	}
	return s
}
