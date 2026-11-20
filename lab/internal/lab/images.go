package lab

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
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
	// UbuntuServerBase: the directory of the full Ubuntu 24.04 server cloud
	// images, for Hyper-V (DTLAB_UBUNTU_SERVER_URL).
	UbuntuServerBase string
	// Kuberoot: a URL or a local directory given instead of kuberoot's
	// GitHub release: either a release's assets with their manifest
	// (kuberoot-edge.json), or a build's own layout, <arch>/{vmlinuz.efi,
	// initrd.cpio, rootfs.squashfs, systemd-boot.efi, VERSION} and
	// bin/mkimage-<os>-<arch>[.exe], which is used without checksums.
	Kuberoot string
	// KuberootVersion: the release to take when Kuberoot is empty, a
	// version (1.2.3) or "latest".
	KuberootVersion string
	// Kubectl: where the learner VM's kubectl comes from.
	Kubectl string
}

// DefaultSources: Canonical's images, kuberoot's releases, dl.k8s.io.
func DefaultSources() Sources {
	s := Sources{
		UbuntuBase:       "https://cloud-images.ubuntu.com/minimal/releases/noble/release/",
		UbuntuServerBase: "https://cloud-images.ubuntu.com/releases/noble/release/",
		Kubectl:          "https://dl.k8s.io/release/",
	}
	if v := os.Getenv("DTLAB_UBUNTU_URL"); v != "" {
		s.UbuntuBase = v
	}
	if v := os.Getenv("DTLAB_UBUNTU_SERVER_URL"); v != "" {
		s.UbuntuServerBase = v
	}
	if v := os.Getenv("DTLAB_KUBEROOT_URL"); v != "" {
		s.Kuberoot = v
	}
	return s
}

// UbuntuImage is the file name of the image for an architecture, and the
// directory it is in. Hyper-V takes the full server image: its "virtual"
// kernel has Hyper-V's storage and network drivers, which the minimal
// image's linux-kvm kernel lacks. (Canonical's Azure image has them too,
// but it is a VHD in a tarball and its cloud-init reads only Azure's
// metadata, never a NoCloud seed.)
func UbuntuImage(arch string, hyperV bool) string {
	if hyperV {
		return "ubuntu-24.04-server-cloudimg-" + arch + ".img"
	}
	return "ubuntu-24.04-minimal-cloudimg-" + arch + ".img"
}

func (s Sources) ubuntuBase(hyperV bool) string {
	if hyperV {
		return s.UbuntuServerBase
	}
	return s.UbuntuBase
}

var httpClient = &http.Client{Timeout: 30 * time.Minute}

// fetch downloads url to dst unless dst exists, checking sha256 when given:
// a file already there that does not match it is fetched again. It writes
// to dst.part first, so a broken download never looks finished.
func fetch(ctx context.Context, url, dst, sha string, log func(string, ...any)) error {
	if _, err := os.Stat(dst); err == nil {
		if sha == "" {
			return nil
		}
		if got, err := fileSum(dst); err == nil && got == sha {
			return nil
		}
		log("%s does not match its checksum, fetching it again", dst)
		if err := os.Remove(dst); err != nil {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return err
	}
	if !strings.Contains(url, "://") {
		return copyLocal(url, dst, sha)
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

func copyLocal(src, dst, sha string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst+".part", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	h := sha256.New()
	if _, err := io.Copy(io.MultiWriter(out, h), in); err != nil {
		out.Close()
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	if sha != "" && hex.EncodeToString(h.Sum(nil)) != sha {
		_ = os.Remove(dst + ".part")
		return fmt.Errorf("%s: checksum mismatch", src)
	}
	return os.Rename(dst+".part", dst)
}

func fileSum(name string) (string, error) {
	f, err := os.Open(name)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// errNotFound: the source has no such file (HTTP 404, or no file in a
// directory), as opposed to a source that cannot be reached.
var errNotFound = errors.New("not found")

// readSmall reads a small file from a URL or a local path.
func readSmall(ctx context.Context, url string) ([]byte, error) {
	if !strings.Contains(url, "://") {
		b, err := os.ReadFile(url)
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("%s: %w", url, errNotFound)
		}
		return b, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "dtlab")
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("%s: %w", url, errNotFound)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: HTTP %d", url, resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 1<<20))
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
