package kuberoot

import (
	"strings"
	"testing"
)

const sum = "1db53db8505adf529b2c58f3cdc6074a8697e10e003229ee34f15aa6b3569cbd"

func manifest(files ...string) []byte {
	return []byte(`{"distro": "edge", "version": "1.2.3", "kubernetes": "v1.37.2", "arches": ["amd64"], "files": [` + strings.Join(files, ",") + `]}`)
}

func entry(name, path, arch, os string) string {
	o := ""
	if os != "" {
		o = `, "os": "` + os + `"`
	}
	return `{"name": "` + name + `", "path": "` + path + `", "arch": "` + arch + `"` + o + `, "size": 17, "sha256": "` + sum + `"}`
}

func full() []byte {
	var e []string
	for _, f := range Artifacts {
		e = append(e, entry("edge-amd64-"+f, "amd64/"+f, "amd64", ""))
	}
	e = append(e, entry("edge-amd64-kernel.args", "amd64/kernel.args", "amd64", ""),
		entry("mkimage-darwin-arm64", "bin/mkimage-darwin-arm64", "arm64", "darwin"),
		entry("mkimage-windows-amd64.exe", "bin/mkimage-windows-amd64.exe", "amd64", "windows"))
	return manifest(e...)
}

func TestReleaseBase(t *testing.T) {
	for v, want := range map[string]string{
		"":       ReleaseRepo + "/latest/download/",
		"latest": ReleaseRepo + "/latest/download/",
		"1.2.3":  ReleaseRepo + "/download/v1.2.3/",
		"v1.2.3": ReleaseRepo + "/download/v1.2.3/",
	} {
		if got := ReleaseBase(v); got != want {
			t.Errorf("ReleaseBase(%q) = %s, want %s", v, got, want)
		}
	}
}

func TestParseRelease(t *testing.T) {
	r, err := ParseRelease(full())
	if err != nil {
		t.Fatal(err)
	}
	if r.Version != "1.2.3" || r.Kubernetes != "v1.37.2" {
		t.Errorf("release %+v", r)
	}
	a, err := r.Artifacts("amd64")
	if err != nil {
		t.Fatal(err)
	}
	if len(a) != len(Artifacts)+1 || a["vmlinuz.efi"].Name != "edge-amd64-vmlinuz.efi" || a["kernel.args"].Name == "" {
		t.Errorf("artifacts %v", a)
	}
	if _, err := r.Artifacts("arm64"); err == nil {
		t.Error("arm64 artifacts from a release without them")
	}
	if m, err := r.Mkimage("windows", "amd64"); err != nil || m.Name != "mkimage-windows-amd64.exe" {
		t.Error("mkimage for windows/amd64:", m, err)
	}
	if _, err := r.Mkimage("linux", "amd64"); err == nil {
		t.Error("mkimage that the release does not have")
	}
}

func TestParseReleaseRefuses(t *testing.T) {
	for name, raw := range map[string][]byte{
		"not json":   []byte("<html>"),
		"no files":   manifest(),
		"dir name":   manifest(entry("../vmlinuz.efi", "amd64/vmlinuz.efi", "amd64", "")),
		"escape":     manifest(entry("x", "../../etc/passwd", "amd64", "")),
		"absolute":   manifest(entry("x", "/etc/passwd", "amd64", "")),
		"short hash": []byte(`{"version": "1", "files": [{"name": "x", "path": "amd64/x", "arch": "amd64", "sha256": "ab"}]}`),
	} {
		if _, err := ParseRelease(raw); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}
