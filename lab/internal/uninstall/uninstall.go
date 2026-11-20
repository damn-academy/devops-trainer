// Package uninstall removes everything the lab added to the computer: the
// VMs and their disks, images and caches, host networks, the course copy,
// configuration and state, backends dtlab installed, PATH entries and
// completions, and finally the dtlab program itself. It lists what it will
// remove with sizes, asks, removes, and then looks again for anything left.
//
// The manifest names what was made; the lab root is removed whatever the
// manifest says, so a lost or damaged manifest still leaves nothing behind
// under the root.
package uninstall

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/tym83/devops-trainer/lab/internal/manifest"
)

// Entry is one thing to remove.
type Entry struct {
	Item   manifest.Item
	Bytes  int64 // on disk, 0 for objects outside the file system
	Exists bool
	// Ask: the thing was there before dtlab; removed only when confirmed
	// separately (or with --remove-preexisting).
	Ask bool
}

// Plan lists what an uninstall would remove: every manifest item, and the
// root directory even when the manifest does not name it.
func Plan(m *manifest.Manifest, root string, probe Prober) []Entry {
	items := m.Ordered()
	hasRoot := false
	for _, it := range items {
		if it.Kind == manifest.Dir && filepath.Clean(it.Path) == filepath.Clean(root) {
			hasRoot = true
		}
	}
	if !hasRoot {
		items = append(items, manifest.Item{Kind: manifest.Dir, Path: root, Note: "the lab's data directory"})
		sort.SliceStable(items, func(a, b int) bool { return rank(items[a].Kind) < rank(items[b].Kind) })
	}
	var out []Entry
	for _, it := range items {
		e := Entry{Item: it, Ask: it.Preexisting && it.Kind != manifest.Dir}
		switch it.Kind {
		case manifest.Dir, manifest.File, manifest.Binary, manifest.Backend:
			e.Bytes, e.Exists = size(it.Path)
		case manifest.HostVMProc:
			// Its disks are under root/vms and counted there.
			e.Exists = true
		case manifest.PathEntry:
			if strings.HasPrefix(it.Path, "windows:") {
				e.Exists = probe.Exists(it)
			} else {
				e.Exists = lineIn(it.Path, it.Line)
			}
		default:
			e.Exists = probe.Exists(it)
		}
		out = append(out, e)
	}
	return out
}

func rank(k manifest.Kind) int {
	return map[manifest.Kind]int{manifest.HostVMProc: 0, manifest.HyperVVM: 0, manifest.HyperVNAT: 1, manifest.HyperVNet: 2, manifest.Backend: 3, manifest.Dir: 4, manifest.File: 5, manifest.PathEntry: 6, manifest.Binary: 7}[k]
}

// Prober checks and removes objects outside the file system (Hyper-V).
type Prober interface {
	Exists(manifest.Item) bool
	Remove(context.Context, manifest.Item) error
}

// NoObjects is the Prober of hosts without such objects.
type NoObjects struct{}

func (NoObjects) Exists(manifest.Item) bool                   { return false }
func (NoObjects) Remove(context.Context, manifest.Item) error { return nil }

// Total of the bytes of entries.
func Total(es []Entry) int64 {
	var t int64
	for _, e := range es {
		if e.Exists {
			t += e.Bytes
		}
	}
	return t
}

// Report prints the plan.
func Report(es []Entry) string {
	var b strings.Builder
	for _, e := range es {
		if !e.Exists {
			continue
		}
		what := string(e.Item.Kind)
		line := fmt.Sprintf("  %-14s %-60s %10s", what, e.Item.Path, Human(e.Bytes))
		if e.Item.Line != "" {
			line = fmt.Sprintf("  %-14s %s: the line %q", what, e.Item.Path, e.Item.Line)
		}
		if e.Ask {
			line += "  (was there before dtlab: asked separately)"
		}
		b.WriteString(line + "\n")
	}
	fmt.Fprintf(&b, "  total: %s\n", Human(Total(es)))
	return b.String()
}

// Human formats bytes.
func Human(n int64) string {
	switch {
	case n >= 1<<30:
		return fmt.Sprintf("%.1f GiB", float64(n)/(1<<30))
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MiB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.1f KiB", float64(n)/(1<<10))
	case n > 0:
		return fmt.Sprintf("%d B", n)
	}
	return "-"
}

// Options of Run.
type Options struct {
	// RemovePreexisting also removes things that were there before dtlab.
	RemovePreexisting bool
	// KeepBinary leaves the dtlab program (when it runs from a source tree).
	KeepBinary bool
	// StopVMs ends the VMs' processes before their disks go (from the lab).
	StopVMs func(ctx context.Context) error
	Prober  Prober
	Log     func(string, ...any)
}

// Result of an uninstall.
type Result struct {
	Freed     int64
	Leftovers []Entry
	Skipped   []Entry
	// Scheduled: the binary is removed after dtlab exits (Windows cannot
	// delete a running program).
	Scheduled string
}

// Run removes the entries and then re-scans for leftovers.
func Run(ctx context.Context, es []Entry, o Options) Result {
	var r Result
	if o.StopVMs != nil {
		if err := o.StopVMs(ctx); err != nil {
			o.Log("stopping VMs: %v", err)
		}
	}
	before := Total(es)
	for _, e := range es {
		if !e.Exists {
			continue
		}
		if e.Ask && !o.RemovePreexisting {
			r.Skipped = append(r.Skipped, e)
			continue
		}
		var err error
		switch e.Item.Kind {
		case manifest.Dir, manifest.File, manifest.Backend:
			err = os.RemoveAll(e.Item.Path)
		case manifest.HostVMProc:
			// Ended by StopVMs; the disks go with the root.
		case manifest.PathEntry:
			if strings.HasPrefix(e.Item.Path, "windows:") {
				err = o.Prober.Remove(ctx, e.Item)
			} else {
				err = removeLine(e.Item.Path, e.Item.Line)
			}
		case manifest.Binary:
			if o.KeepBinary {
				r.Skipped = append(r.Skipped, e)
				continue
			}
			r.Scheduled, err = removeSelf(e.Item.Path)
		default:
			err = o.Prober.Remove(ctx, e.Item)
		}
		if err != nil {
			o.Log("%s %s: %v", e.Item.Kind, e.Item.Path, err)
		}
	}
	// Re-scan the same list: whatever still exists is a leftover.
	var after int64
	for _, e := range es {
		if !e.Exists || containsEntry(r.Skipped, e) {
			continue
		}
		left := false
		var n int64
		switch e.Item.Kind {
		case manifest.Dir, manifest.File, manifest.Backend:
			n, left = size(e.Item.Path)
		case manifest.Binary:
			if r.Scheduled == "" {
				n, left = size(e.Item.Path)
			}
		case manifest.PathEntry:
			if strings.HasPrefix(e.Item.Path, "windows:") {
				left = o.Prober.Exists(e.Item)
			} else {
				left = lineIn(e.Item.Path, e.Item.Line)
			}
		case manifest.HostVMProc:
		default:
			left = o.Prober.Exists(e.Item)
		}
		if left {
			after += n
			r.Leftovers = append(r.Leftovers, e)
		}
	}
	var skipped int64
	for _, e := range r.Skipped {
		skipped += e.Bytes
	}
	r.Freed = before - after - skipped
	return r
}

func containsEntry(es []Entry, e Entry) bool {
	for _, o := range es {
		if o.Item == e.Item {
			return true
		}
	}
	return false
}

// size of a path; the second result is whether it exists.
func size(p string) (int64, bool) {
	st, err := os.Lstat(p)
	if err != nil {
		return 0, false
	}
	if !st.IsDir() {
		return allocated(st), true
	}
	var t int64
	_ = filepath.WalkDir(p, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if info, err := d.Info(); err == nil && !d.IsDir() {
			t += allocated(info)
		}
		return nil
	})
	return t, true
}

func lineIn(file, line string) bool {
	raw, err := os.ReadFile(file)
	if err != nil {
		return false
	}
	for _, l := range strings.Split(string(raw), "\n") {
		if strings.TrimRight(l, "\r") == line {
			return true
		}
	}
	return false
}

// removeLine takes out exactly the line dtlab added, and nothing else.
func removeLine(file, line string) error {
	raw, err := os.ReadFile(file)
	if err != nil {
		return nil
	}
	var out []string
	for _, l := range strings.Split(string(raw), "\n") {
		if strings.TrimRight(l, "\r") != line {
			out = append(out, l)
		}
	}
	st, _ := os.Stat(file)
	mode := os.FileMode(0o644)
	if st != nil {
		mode = st.Mode().Perm()
	}
	return os.WriteFile(file, []byte(strings.Join(out, "\n")), mode)
}

// removeSelf deletes the program; on Windows a running .exe cannot be
// deleted, so a detached cmd deletes it a moment after dtlab exits.
func removeSelf(p string) (string, error) {
	if runtime.GOOS != "windows" {
		return "", os.Remove(p)
	}
	return p, scheduleDelete(p)
}
