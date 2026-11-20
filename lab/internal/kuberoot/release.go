package kuberoot

import (
	"encoding/json"
	"fmt"
	"path"
	"strings"
)

// ReleaseRepo is where kuberoot publishes its releases.
const ReleaseRepo = "https://github.com/kuberoot-dev/kuberoot/releases"

// ManifestName is the release asset that describes the others
// (kuberoot's hack/release/lab-assets.sh writes it).
const ManifestName = "kuberoot-edge.json"

// ReleaseBase is the address the assets of a release are downloaded from:
// the latest release for "" or "latest", otherwise the tag of a version
// (1.2.3 and v1.2.3 name the same tag).
func ReleaseBase(version string) string {
	if version == "" || version == "latest" {
		return ReleaseRepo + "/latest/download/"
	}
	return ReleaseRepo + "/download/v" + strings.TrimPrefix(version, "v") + "/"
}

// Release is kuberoot-edge.json: the version, the Kubernetes it runs, and
// every asset with the path it has in a build's output (amd64/vmlinuz.efi,
// bin/mkimage-linux-amd64), its size and sha256.
type Release struct {
	Distro     string        `json:"distro"`
	Version    string        `json:"version"`
	Kubernetes string        `json:"kubernetes"`
	Arches     []string      `json:"arches"`
	Files      []ReleaseFile `json:"files"`
}

// ReleaseFile is one asset of a release.
type ReleaseFile struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Arch   string `json:"arch"`
	OS     string `json:"os,omitempty"` // only mkimage, built for a system
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

// ParseRelease reads a manifest and checks what the lab relies on: every
// file has a plain asset name, a sha256, and a path inside the layout.
func ParseRelease(raw []byte) (Release, error) {
	var r Release
	if err := json.Unmarshal(raw, &r); err != nil {
		return r, fmt.Errorf("%s: %w", ManifestName, err)
	}
	if r.Version == "" || len(r.Files) == 0 {
		return r, fmt.Errorf("%s: no version or no files", ManifestName)
	}
	for _, f := range r.Files {
		if f.Name == "" || strings.ContainsAny(f.Name, `/\`) || len(f.SHA256) != 64 {
			return r, fmt.Errorf("%s: bad entry %q", ManifestName, f.Name)
		}
		if p := path.Clean(f.Path); p != f.Path || strings.HasPrefix(p, "../") || path.IsAbs(p) {
			return r, fmt.Errorf("%s: bad path %q", ManifestName, f.Path)
		}
	}
	return r, nil
}

// Artifacts are the files of a release media is written from, for arch,
// each with the name it has in the artifacts directory mkimage reads.
func (r Release) Artifacts(arch string) (map[string]ReleaseFile, error) {
	out := map[string]ReleaseFile{}
	for _, f := range r.Files {
		if f.OS == "" && f.Arch == arch && path.Dir(f.Path) == arch {
			out[path.Base(f.Path)] = f
		}
	}
	for _, need := range Artifacts {
		if _, ok := out[need]; !ok {
			return nil, fmt.Errorf("kuberoot %s has no %s for %s", r.Version, need, arch)
		}
	}
	return out, nil
}

// Mkimage is the mkimage of the release for a system and architecture.
func (r Release) Mkimage(goos, arch string) (ReleaseFile, error) {
	for _, f := range r.Files {
		if f.OS == goos && f.Arch == arch {
			return f, nil
		}
	}
	return ReleaseFile{}, fmt.Errorf("kuberoot %s has no mkimage for %s/%s", r.Version, goos, arch)
}
