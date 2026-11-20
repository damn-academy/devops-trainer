package lab

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tym83/devops-trainer/lab/internal/kuberoot"
)

// release serves a kuberoot release's assets as GitHub does, flat, with
// their manifest; tamper changes a file after its sum was taken.
type release struct {
	files    map[string]string
	manifest string
	hits     map[string]int
}

func newRelease(version string) *release {
	r := &release{files: map[string]string{}, hits: map[string]int{}}
	var entries []string
	add := func(name, path, arch, os, body string) {
		r.files[name] = body
		s := sha256.Sum256([]byte(body))
		o := ""
		if os != "" {
			o = fmt.Sprintf(`, "os": %q`, os)
		}
		entries = append(entries, fmt.Sprintf(`{"name": %q, "path": %q, "arch": %q%s, "size": %d, "sha256": %q}`, name, path, arch, o, len(body), hex.EncodeToString(s[:])))
	}
	for _, f := range kuberoot.Artifacts {
		body := "amd64 " + f
		if f == "VERSION" {
			body = version + "\n"
		}
		add("edge-amd64-"+f, "amd64/"+f, "amd64", "", body)
	}
	add("mkimage-linux-amd64", "bin/mkimage-linux-amd64", "amd64", "linux", "#!mkimage")
	r.manifest = fmt.Sprintf(`{"distro": "edge", "version": %q, "kubernetes": "v1.37.2", "arches": ["amd64"], "files": [%s]}`, version, strings.Join(entries, ","))
	return r
}

func (r *release) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	name := filepath.Base(req.URL.Path)
	r.hits[name]++
	if name == kuberoot.ManifestName {
		fmt.Fprint(w, r.manifest)
		return
	}
	body, ok := r.files[name]
	if !ok {
		http.NotFound(w, req)
		return
	}
	fmt.Fprint(w, body)
}

func TestKuberootFromRelease(t *testing.T) {
	lab, _, _ := testLab(t)
	rel := newRelease("1.2.3")
	srv := httptest.NewServer(rel)
	defer srv.Close()
	lab.Src.Kuberoot = srv.URL + "/download/v1.2.3/"

	art, mk, err := lab.kuberootArtifacts(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(lab.L.Images(), "kuberoot", "1.2.3", "amd64"); art != want {
		t.Errorf("artifacts in %s, want %s", art, want)
	}
	for _, f := range kuberoot.Artifacts {
		b, err := os.ReadFile(filepath.Join(art, f))
		if err != nil || string(b) != rel.files["edge-amd64-"+f] {
			t.Errorf("%s: %q %v", f, b, err)
		}
	}
	if b, _ := os.ReadFile(mk); string(b) != "#!mkimage" || filepath.Base(mk) != "mkimage-linux-amd64" {
		t.Errorf("mkimage %s: %q", mk, b)
	}

	// Cached files that still match are not fetched again; one that does
	// not is.
	if err := os.WriteFile(filepath.Join(art, "initrd.cpio"), []byte("broken"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, _, err := lab.kuberootArtifacts(context.Background()); err != nil {
		t.Fatal(err)
	}
	if rel.hits["edge-amd64-vmlinuz.efi"] != 1 || rel.hits["edge-amd64-initrd.cpio"] != 2 {
		t.Errorf("downloads %v", rel.hits)
	}
}

func TestKuberootChecksumMismatch(t *testing.T) {
	lab, _, _ := testLab(t)
	rel := newRelease("1.2.3")
	rel.files["edge-amd64-rootfs.squashfs"] = "tampered"
	srv := httptest.NewServer(rel)
	defer srv.Close()
	lab.Src.Kuberoot = srv.URL + "/"
	_, _, err := lab.kuberootArtifacts(context.Background())
	if err == nil || !strings.Contains(err.Error(), "checksum mismatch") {
		t.Fatal("a file that does not match the manifest:", err)
	}
	if _, err := os.Stat(filepath.Join(lab.L.Images(), "kuberoot", "1.2.3", "amd64", "rootfs.squashfs")); err == nil {
		t.Error("the mismatching file was kept")
	}
}

func TestKuberootReleaseOffline(t *testing.T) {
	lab, _, _ := testLab(t)
	rel := newRelease("1.2.3")
	srv := httptest.NewServer(rel)
	lab.Src.KuberootVersion = "1.2.3"
	// A first download (from the fake server standing in for GitHub), and
	// the manifest kept under the version, as a download of the default
	// source keeps it.
	kept := filepath.Join(lab.L.Images(), "kuberoot", "release-1.2.3.json")
	_ = os.MkdirAll(filepath.Dir(kept), 0o700)
	if err := os.WriteFile(kept, []byte(rel.manifest), 0o600); err != nil {
		t.Fatal(err)
	}
	lab.Src.Kuberoot = srv.URL + "/"
	if _, _, err := lab.kuberootArtifacts(context.Background()); err != nil {
		t.Fatal(err)
	}
	srv.Close()

	// Offline, with the default source: the kept manifest and the cached
	// files are enough.
	lab.Src.Kuberoot = ""
	old := httpClient.Transport
	httpClient.Transport = offline{}
	defer func() { httpClient.Transport = old }()
	art, _, err := lab.kuberootArtifacts(context.Background())
	if err != nil {
		t.Fatal("offline with a kept manifest:", err)
	}
	if filepath.Base(filepath.Dir(art)) != "1.2.3" {
		t.Error("artifacts of", art)
	}

	// Another version, never downloaded, cannot be installed offline.
	lab.Src.KuberootVersion = "9.9.9"
	if _, _, err := lab.kuberootArtifacts(context.Background()); err == nil {
		t.Error("offline without a kept manifest")
	}
}

type offline struct{}

func (offline) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, fmt.Errorf("network is unreachable")
}

func TestKuberootBuildLayout(t *testing.T) {
	lab, _, _ := testLab(t)
	dir := t.TempDir()
	for _, f := range kuberoot.Artifacts {
		p := filepath.Join(dir, "amd64", f)
		_ = os.MkdirAll(filepath.Dir(p), 0o700)
		_ = os.WriteFile(p, []byte(f), 0o600)
	}
	_ = os.MkdirAll(filepath.Join(dir, "bin"), 0o700)
	_ = os.WriteFile(filepath.Join(dir, "bin", "mkimage-linux-amd64"), []byte("mk"), 0o700)
	lab.Src.Kuberoot = dir
	art, mk, err := lab.kuberootArtifacts(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if art != filepath.Join(lab.L.Images(), "kuberoot", "amd64") || filepath.Base(mk) != "mkimage-linux-amd64" {
		t.Error(art, mk)
	}
}

func TestKuberootReleaseDirectory(t *testing.T) {
	// A classroom copy of a release's assets: a flat directory with the
	// manifest, checked like the download.
	lab, _, _ := testLab(t)
	rel := newRelease("2.0.0")
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, kuberoot.ManifestName), []byte(rel.manifest), 0o600)
	for n, b := range rel.files {
		_ = os.WriteFile(filepath.Join(dir, n), []byte(b), 0o600)
	}
	lab.Src.Kuberoot = dir
	art, _, err := lab.kuberootArtifacts(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(filepath.Join(art, "VERSION")); string(b) != "2.0.0\n" {
		t.Errorf("VERSION %q", b)
	}
	_ = os.WriteFile(filepath.Join(dir, "edge-amd64-vmlinuz.efi"), []byte("other"), 0o600)
	_ = os.Remove(filepath.Join(art, "vmlinuz.efi"))
	if _, _, err := lab.kuberootArtifacts(context.Background()); err == nil {
		t.Error("a copied file that does not match the manifest")
	}
}

func TestInstallDisk(t *testing.T) {
	if installDisk("qemu") != "vda" || installDisk("hyperv") != "sda" {
		t.Error(installDisk("qemu"), installDisk("hyperv"))
	}
}
