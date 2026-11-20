// Package paths keeps every file the lab owns under one root directory, so
// that removing the lab is removing that directory even when the manifest
// of what was created is lost.
package paths

import (
	"os"
	"path/filepath"
	"runtime"
)

// Root is the lab's only data directory:
//
//	Linux, macOS  ~/.dtlab
//	Windows       %LOCALAPPDATA%\dtlab
//
// DTLAB_HOME overrides it (tests, a second lab beside the first).
func Root() string {
	if v := os.Getenv("DTLAB_HOME"); v != "" {
		return v
	}
	return DefaultRoot(runtime.GOOS, os.Getenv("LOCALAPPDATA"), home())
}

// DefaultRoot is Root without the environment, for tests.
func DefaultRoot(goos, localAppData, homeDir string) string {
	if goos == "windows" {
		if localAppData == "" {
			localAppData = filepath.Join(homeDir, "AppData", "Local")
		}
		return filepath.Join(localAppData, "dtlab")
	}
	return filepath.Join(homeDir, ".dtlab")
}

func home() string {
	h, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return h
}

// Layout names the parts of the root.
type Layout struct{ Root string }

func New(root string) Layout { return Layout{Root: root} }

func (l Layout) Manifest() string      { return filepath.Join(l.Root, "manifest.json") }
func (l Layout) State() string         { return filepath.Join(l.Root, "state.json") }
func (l Layout) Config() string        { return filepath.Join(l.Root, "config") }
func (l Layout) SSHKey() string        { return filepath.Join(l.Root, "config", "id_ed25519") }
func (l Layout) KnownHosts() string    { return filepath.Join(l.Root, "config", "known_hosts") }
func (l Layout) Trust() string         { return filepath.Join(l.Root, "config", "kuberoot-trust") }
func (l Layout) Kubeconfig() string    { return filepath.Join(l.Root, "config", "kuberoot.kubeconfig") }
func (l Layout) Images() string        { return filepath.Join(l.Root, "cache", "images") }
func (l Layout) Files() string         { return filepath.Join(l.Root, "cache", "files") }
func (l Layout) VMs() string           { return filepath.Join(l.Root, "vms") }
func (l Layout) VM(name string) string { return filepath.Join(l.Root, "vms", name) }
func (l Layout) Course() string        { return filepath.Join(l.Root, "course") }
func (l Layout) Backends() string      { return filepath.Join(l.Root, "backends") }
func (l Layout) Logs() string          { return filepath.Join(l.Root, "logs") }
func (l Layout) AgentPID() string      { return filepath.Join(l.Root, "agent.pid") }

// Ensure creates the root and its directories, owner-only.
func (l Layout) Ensure() error {
	for _, d := range []string{l.Root, l.Config(), l.Images(), l.Files(), l.VMs(), l.Logs()} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			return err
		}
	}
	return nil
}
