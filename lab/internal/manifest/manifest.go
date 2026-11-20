// Package manifest records everything dtlab creates outside its own
// process: directories and files, VMs, host networks, backends it installed,
// PATH entries and completions, and the dtlab binary itself. `dtlab
// uninstall` removes what the manifest lists and then checks that nothing of
// it is left.
package manifest

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// Kind of a created thing; each kind has its own way to be removed.
type Kind string

const (
	Dir        Kind = "dir"        // a directory dtlab created (removed with its contents)
	File       Kind = "file"       // a single file outside the root (completion, the binary)
	Binary     Kind = "binary"     // the dtlab executable itself, removed last
	Backend    Kind = "backend"    // a hypervisor or tool dtlab installed (QEMU it downloaded)
	PathEntry  Kind = "path-entry" // a line dtlab appended to a shell profile, or a user PATH entry on Windows
	HyperVVM   Kind = "hyperv-vm"  // a Hyper-V virtual machine
	HyperVNet  Kind = "hyperv-switch"
	HyperVNAT  Kind = "hyperv-netnat"
	HostVMProc Kind = "qemu-vm" // a QEMU VM: its directory under vms/ and its process
)

// Item is one created thing.
type Item struct {
	Kind Kind   `json:"kind"`
	Path string `json:"path,omitempty"` // file system path, or the object's name
	// Line is the exact text dtlab added (PathEntry), so only that is taken out.
	Line string `json:"line,omitempty"`
	// Preexisting: the thing was there before dtlab (a QEMU from the package
	// manager, Hyper-V turned on by the learner). Never removed without asking.
	Preexisting bool      `json:"preexisting,omitempty"`
	Note        string    `json:"note,omitempty"`
	Created     time.Time `json:"created"`
}

func (i Item) key() string { return string(i.Kind) + "\x00" + i.Path + "\x00" + i.Line }

// Manifest is the list, kept as JSON at <root>/manifest.json and mirrored
// into the state of the uninstaller's re-scan.
type Manifest struct {
	Version int    `json:"version"`
	Root    string `json:"root"`
	Items   []Item `json:"items"`
	path    string
}

// Load reads the manifest; a missing file is an empty manifest.
func Load(path, root string) (*Manifest, error) {
	m := &Manifest{Version: 1, Root: root, path: path}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return m, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, m); err != nil {
		// A damaged manifest must not stop an uninstall: the root alone is
		// enough to remove the lab's data.
		return &Manifest{Version: 1, Root: root, path: path}, err
	}
	m.path = path
	if m.Root == "" {
		m.Root = root
	}
	return m, nil
}

// Add records an item once; it is saved at once, so a crash halfway through
// `up` still leaves a manifest that names what was made.
func (m *Manifest) Add(it Item) error {
	if it.Created.IsZero() {
		it.Created = time.Now().UTC()
	}
	for _, o := range m.Items {
		if o.key() == it.key() {
			return nil
		}
	}
	m.Items = append(m.Items, it)
	return m.Save()
}

// Forget drops an item once it is removed.
func (m *Manifest) Forget(it Item) error {
	out := m.Items[:0]
	for _, o := range m.Items {
		if o.key() != it.key() {
			out = append(out, o)
		}
	}
	m.Items = out
	return m.Save()
}

// Has reports whether an item of the kind and path is recorded.
func (m *Manifest) Has(k Kind, path string) bool {
	for _, o := range m.Items {
		if o.Kind == k && o.Path == path {
			return true
		}
	}
	return false
}

// Ordered lists the items in removal order: VMs before their networks,
// networks before backends, data, PATH entries, and the binary last.
func (m *Manifest) Ordered() []Item {
	rank := map[Kind]int{HostVMProc: 0, HyperVVM: 0, HyperVNAT: 1, HyperVNet: 2, Backend: 3, Dir: 4, File: 5, PathEntry: 6, Binary: 7}
	out := append([]Item(nil), m.Items...)
	sort.SliceStable(out, func(a, b int) bool { return rank[out[a].Kind] < rank[out[b].Kind] })
	return out
}

func (m *Manifest) Save() error {
	if m.path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(m.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	tmp := m.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, m.path)
}
