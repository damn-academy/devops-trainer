package uninstall

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tym83/devops-trainer/lab/internal/manifest"
)

func TestUninstallRemovesEverything(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, ".dtlab")
	_ = os.MkdirAll(filepath.Join(root, "vms", "cp-1"), 0o700)
	_ = os.WriteFile(filepath.Join(root, "vms", "cp-1", "disk.qcow2"), make([]byte, 1<<20), 0o600)
	_ = os.MkdirAll(filepath.Join(root, "cache", "images"), 0o700)
	_ = os.WriteFile(filepath.Join(root, "cache", "images", "ubuntu.img"), make([]byte, 2<<20), 0o600)
	rc := filepath.Join(base, ".bashrc")
	pathLine := `export PATH="` + root + `/bin:$PATH" # dtlab`
	_ = os.WriteFile(rc, []byte("alias ll='ls -l'\n"+pathLine+"\nexport EDITOR=vi\n"), 0o644)
	bin := filepath.Join(base, "dtlab")
	_ = os.WriteFile(bin, []byte("binary"), 0o755)
	qemu := filepath.Join(base, "qemu")
	_ = os.MkdirAll(qemu, 0o755)

	m, _ := manifest.Load(filepath.Join(root, "manifest.json"), root)
	// The root is not recorded: a damaged manifest must not leave it behind.
	_ = m.Add(manifest.Item{Kind: manifest.PathEntry, Path: rc, Line: pathLine})
	_ = m.Add(manifest.Item{Kind: manifest.Binary, Path: bin})
	_ = m.Add(manifest.Item{Kind: manifest.Backend, Path: qemu, Preexisting: true})
	_ = m.Add(manifest.Item{Kind: manifest.HostVMProc, Path: "cp-1"})

	plan := Plan(m, root, NoObjects{})
	if plan[0].Item.Kind != manifest.HostVMProc || plan[len(plan)-1].Item.Kind != manifest.Binary {
		t.Errorf("order: %+v", plan)
	}
	if Total(plan) < 3<<20 {
		t.Errorf("total %d", Total(plan))
	}
	rep := Report(plan)
	if !strings.Contains(rep, root) || !strings.Contains(rep, "asked separately") {
		t.Error(rep)
	}
	stopped := false
	res := Run(context.Background(), plan, Options{Prober: NoObjects{}, Log: t.Logf, StopVMs: func(context.Context) error { stopped = true; return nil }})
	if !stopped {
		t.Error("VMs not stopped first")
	}
	if len(res.Leftovers) != 0 {
		t.Errorf("leftovers: %+v", res.Leftovers)
	}
	for _, p := range []string{root, bin} {
		if _, err := os.Stat(p); err == nil {
			t.Errorf("%s still there", p)
		}
	}
	if _, err := os.Stat(qemu); err != nil {
		t.Error("a backend that was there before dtlab was removed without asking")
	}
	raw, _ := os.ReadFile(rc)
	if string(raw) != "alias ll='ls -l'\nexport EDITOR=vi\n" {
		t.Errorf("rc file: %q", raw)
	}
	if res.Freed < 3<<20 {
		t.Errorf("freed %d", res.Freed)
	}
	if len(res.Skipped) != 1 {
		t.Errorf("skipped %+v", res.Skipped)
	}
}

func TestDamagedManifest(t *testing.T) {
	root := t.TempDir()
	_ = os.WriteFile(filepath.Join(root, "manifest.json"), []byte("{broken"), 0o600)
	m, err := manifest.Load(filepath.Join(root, "manifest.json"), root)
	if err == nil {
		t.Fatal("damage not reported")
	}
	plan := Plan(m, root, NoObjects{})
	if len(plan) != 1 || plan[0].Item.Path != root {
		t.Fatalf("plan %+v", plan)
	}
	if res := Run(context.Background(), plan, Options{Prober: NoObjects{}, Log: t.Logf}); len(res.Leftovers) != 0 {
		t.Fatal(res.Leftovers)
	}
	if _, err := os.Stat(root); err == nil {
		t.Fatal("root left")
	}
}

func TestHuman(t *testing.T) {
	if Human(3<<30) != "3.0 GiB" || Human(0) != "-" {
		t.Error(Human(3 << 30))
	}
}

func TestDeleteLaterCmdLine(t *testing.T) {
	got := deleteLaterCmdLine(`C:\Users\A B\Downloads\dtlab.exe`)
	want := `cmd /S /C "for /L %i in (1,1,60) do @(ping -n 2 127.0.0.1 >NUL & del /F /Q "C:\Users\A B\Downloads\dtlab.exe" 2>NUL & if not exist "C:\Users\A B\Downloads\dtlab.exe" exit)"`
	if got != want || strings.Contains(got, `\"`) {
		t.Errorf("%s", got)
	}
}

// fakeObjects stands for Hyper-V: the objects that exist, and what was removed.
type fakeObjects struct {
	there   map[string]bool
	removed []string
}

func (f *fakeObjects) Exists(it manifest.Item) bool { return f.there[it.Path] }
func (f *fakeObjects) Remove(_ context.Context, it manifest.Item) error {
	if !f.there[it.Path] {
		return fmt.Errorf("%s not found", it.Path)
	}
	delete(f.there, it.Path)
	f.removed = append(f.removed, it.Path)
	return nil
}

// dtlab destroy (StopVMs) removes the VMs and the network before the
// manifest's items come up: those are not removed twice, and what destroy
// left is still removed.
func TestObjectsGoneAfterStopAreSkipped(t *testing.T) {
	root := t.TempDir()
	m, _ := manifest.Load(filepath.Join(root, "manifest.json"), root)
	for _, it := range []manifest.Item{{Kind: manifest.HyperVVM, Path: "kr-1"}, {Kind: manifest.HyperVNet, Path: "dtlab"}, {Kind: manifest.HyperVFW, Path: "dtlab-lab"}} {
		_ = m.Add(it)
	}
	objs := &fakeObjects{there: map[string]bool{"kr-1": true, "dtlab": true, "dtlab-lab": true}}
	plan := Plan(m, root, objs)
	var logged []string
	res := Run(context.Background(), plan, Options{Prober: objs,
		Log:     func(f string, a ...any) { logged = append(logged, fmt.Sprintf(f, a...)) },
		StopVMs: func(context.Context) error { delete(objs.there, "kr-1"); delete(objs.there, "dtlab"); return nil }})
	if len(logged) != 0 || len(res.Leftovers) != 0 || len(objs.removed) != 1 || objs.removed[0] != "dtlab-lab" {
		t.Errorf("logged %q, leftovers %v, removed %v", logged, res.Leftovers, objs.removed)
	}
}
