package lab

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Sources of what the lab downloads, each overridable for offline use or a
// mirror (DTLAB_UBUNTU_URL, DTLAB_KUBEROOT_URL, or the flags of `up`).
type Sources struct {
	// UbuntuBase: the directory of the Ubuntu 24.04 minimal cloud images
	// (about 250 MB for amd64), with its SHA256SUMS.
	UbuntuBase string
	// Kuberoot: a URL or a local directory with <arch>/{vmlinuz.efi,
	// initrd.cpio, rootfs.squashfs, systemd-boot.efi, VERSION} and
	// bin/mkimage-<os>-<arch>[.exe].
	Kuberoot string
	// Kubectl: where the learner VM's kubectl comes from.
	Kubectl string
}

// DefaultSources: Canonical's images, kuberoot's releases, dl.k8s.io.
func DefaultSources() Sources {
	s := Sources{
		UbuntuBase: "https://cloud-images.ubuntu.com/minimal/releases/noble/release/",
		Kuberoot:   "https://github.com/kuberoot-dev/kuberoot/releases/latest/download/lab/",
		Kubectl:    "https://dl.k8s.io/release/",
	}
	if v := os.Getenv("DTLAB_UBUNTU_URL"); v != "" {
		s.UbuntuBase = v
	}
	if v := os.Getenv("DTLAB_KUBEROOT_URL"); v != "" {
		s.Kuberoot = v
	}
	return s
}

// UbuntuImage is the file name of the image for an architecture; Hyper-V
// takes the Azure build, whose kernel has the Hyper-V drivers the minimal
// (linux-kvm) kernel lacks.
func UbuntuImage(arch string, hyperV bool) string {
	if hyperV {
		return "ubuntu-24.04-server-cloudimg-amd64-azure.vhd.tar.gz"
	}
	return "ubuntu-24.04-minimal-cloudimg-" + arch + ".img"
}

var httpClient = &http.Client{Timeout: 30 * time.Minute}

// fetch downloads url to dst unless dst exists, checking sha256 when given.
// It writes to dst.part first, so a broken download never looks finished.
func fetch(ctx context.Context, url, dst, sha string, log func(string, ...any)) error {
	if _, err := os.Stat(dst); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return err
	}
	if !strings.Contains(url, "://") {
		return copyLocal(url, dst)
	}
	log("downloading %s", url)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "dtlab")
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%s: %w (offline? put the file at %s)", url, err, dst)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: HTTP %d", url, resp.StatusCode)
	}
	part := dst + ".part"
	f, err := os.OpenFile(part, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	h := sha256.New()
	if _, err := io.Copy(io.MultiWriter(f, h), resp.Body); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if sha != "" && hex.EncodeToString(h.Sum(nil)) != sha {
		_ = os.Remove(part)
		return fmt.Errorf("%s: checksum mismatch", url)
	}
	return os.Rename(part, dst)
}

func copyLocal(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst+".part", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Rename(dst+".part", dst)
}

// sumFor reads the line of a SHA256SUMS file for a name.
func sumFor(ctx context.Context, sumsURL, name string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sumsURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	return ParseSums(resp.Body, name)
}

// ParseSums finds a file's sum in SHA256SUMS ("<hex> *<name>" or "<hex>  <name>").
func ParseSums(r io.Reader, name string) (string, error) {
	s := bufio.NewScanner(r)
	for s.Scan() {
		f := strings.Fields(s.Text())
		if len(f) == 2 && strings.TrimPrefix(f[1], "*") == name {
			return f[0], nil
		}
	}
	return "", fmt.Errorf("no checksum for %s", name)
}

func joinURL(base, name string) string {
	if !strings.Contains(base, "://") {
		return filepath.Join(base, filepath.FromSlash(name))
	}
	return strings.TrimRight(base, "/") + "/" + name
}

// httpGet returns a small text resource.
func httpGet(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%s: HTTP %d", url, resp.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	return string(b), err
}
