package lab

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/tym83/devops-trainer/lab/internal/kuberoot"
)

// kuberootRelease reads the manifest of the kuberoot to install: of the
// release named by version (the latest by default), or of the URL or
// directory given with --kuberoot. A source given by hand that has no
// manifest is a build's own layout, and nil is returned for it. Offline,
// the manifest kept from the last download of the same release is used.
func (lab *Lab) kuberootRelease(ctx context.Context) (string, *kuberoot.Release, error) {
	base, explicit := lab.Src.Kuberoot, lab.Src.Kuberoot != ""
	if !explicit {
		base = kuberoot.ReleaseBase(lab.Src.KuberootVersion)
	}
	version := lab.Src.KuberootVersion
	if version == "" {
		version = "latest"
	}
	kept := filepath.Join(lab.L.Images(), "kuberoot", "release-"+filepath.Base(version)+".json")
	raw, err := readSmall(ctx, joinURL(base, kuberoot.ManifestName))
	switch {
	case err == nil:
	case explicit && errors.Is(err, errNotFound):
		return base, nil, nil
	case !explicit:
		var kerr error
		if raw, kerr = os.ReadFile(kept); kerr != nil {
			if errors.Is(err, errNotFound) {
				return "", nil, fmt.Errorf("kuberoot release %s is not published (%v); pass --kuberoot-version or --kuberoot <url or directory>", version, err)
			}
			return "", nil, fmt.Errorf("kuberoot release %s: %w (pass --kuberoot <url or directory>)", version, err)
		}
		lab.Log("kuberoot release %s: %v; using the copy from the last download", version, err)
	default:
		return "", nil, fmt.Errorf("kuberoot: %w", err)
	}
	r, err := kuberoot.ParseRelease(raw)
	if err != nil {
		return "", nil, err
	}
	if !explicit {
		_ = os.MkdirAll(filepath.Dir(kept), 0o700)
		_ = os.WriteFile(kept, raw, 0o600)
	}
	return base, &r, nil
}

// kuberootArtifacts fetches what the node's media is written from and the
// mkimage that writes it, and returns where they are. Files of a release
// are checked against its manifest and kept by version, so a newer release
// never mixes with an older one in the cache.
func (lab *Lab) kuberootArtifacts(ctx context.Context) (art, mkPath string, err error) {
	base, rel, err := lab.kuberootRelease(ctx)
	if err != nil {
		return "", "", err
	}
	mk := "mkimage-" + lab.GOOS + "-" + lab.Arch
	if lab.GOOS == "windows" {
		mk += ".exe"
	}
	if rel == nil {
		art = filepath.Join(lab.L.Images(), "kuberoot", lab.Arch)
		for _, f := range kuberoot.Artifacts {
			if err := fetch(ctx, joinURL(base, lab.Arch+"/"+f), filepath.Join(art, f), "", lab.Log); err != nil {
				return "", "", fmt.Errorf("kuberoot artifacts: %w (pass --kuberoot <url or directory>)", err)
			}
		}
		mkPath = filepath.Join(lab.L.Files(), mk)
		if err := fetch(ctx, joinURL(base, "bin/"+mk), mkPath, "", lab.Log); err != nil {
			return "", "", fmt.Errorf("kuberoot mkimage: %w", err)
		}
		return art, mkPath, os.Chmod(mkPath, 0o755)
	}
	lab.Log("kuberoot %s (Kubernetes %s)", rel.Version, rel.Kubernetes)
	files, err := rel.Artifacts(lab.Arch)
	if err != nil {
		return "", "", err
	}
	art = filepath.Join(lab.L.Images(), "kuberoot", filepath.Base(rel.Version), lab.Arch)
	names := make([]string, 0, len(files))
	for n := range files {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		f := files[n]
		if err := fetch(ctx, joinURL(base, f.Name), filepath.Join(art, n), f.SHA256, lab.Log); err != nil {
			return "", "", fmt.Errorf("kuberoot %s: %w", rel.Version, err)
		}
	}
	m, err := rel.Mkimage(lab.GOOS, lab.Arch)
	if err != nil {
		return "", "", err
	}
	mkPath = filepath.Join(lab.L.Files(), "kuberoot-"+filepath.Base(rel.Version), mk)
	if err := fetch(ctx, joinURL(base, m.Name), mkPath, m.SHA256, lab.Log); err != nil {
		return "", "", fmt.Errorf("kuberoot mkimage: %w", err)
	}
	return art, mkPath, os.Chmod(mkPath, 0o755)
}

// installDisk is the system disk as the node sees it: the first virtio
// disk under QEMU, the first SCSI disk (storvsc) under Hyper-V, where the
// system disk is attached before the media.
func installDisk(backend string) string {
	if backend == "hyperv" {
		return "sda"
	}
	return "vda"
}
