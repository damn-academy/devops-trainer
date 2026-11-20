// Package hostinfo finds out what the learner's computer is: the OS, the
// CPU, memory, free disk and which hardware virtualisation it can use.
package hostinfo

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// Info is what `dtlab check` reports.
type Info struct {
	OS        string `json:"os"`   // linux, darwin, windows
	Arch      string `json:"arch"` // amd64, arm64
	OSVersion string `json:"osVersion,omitempty"`
	CPUModel  string `json:"cpuModel,omitempty"`
	CPUs      int    `json:"cpus"`
	MemMiB    int    `json:"memMiB"`
	// MemAvailMiB: free plus reclaimable now; what VMs can take without the
	// host starting to swap.
	MemAvailMiB int    `json:"memAvailMiB"`
	DiskFreeMiB int    `json:"diskFreeMiB"`
	DiskPath    string `json:"diskPath"`
	Virt        Virt   `json:"virt"`
	// Tools found on PATH (qemu-system-*, qemu-img, ssh, powershell).
	Tools map[string]string `json:"tools"`
}

// Virt is the hardware virtualisation the host offers.
type Virt struct {
	// Accel is the QEMU accelerator: kvm, hvf, whpx, or "" when none works.
	Accel string `json:"accel"`
	// HyperV: Windows with the Hyper-V module available to this user.
	HyperV bool `json:"hyperV"`
	// Nested: the host is itself a VM (we can still run, but slower).
	Nested bool   `json:"nested,omitempty"`
	Detail string `json:"detail"`
}

// Detect fills Info for this computer; dir is where the lab keeps its data,
// whose file system is the one that needs free space.
func Detect(dir string) Info {
	i := Info{OS: runtime.GOOS, Arch: runtime.GOARCH, CPUs: runtime.NumCPU(), DiskPath: dir, Tools: map[string]string{}}
	for _, t := range toolNames() {
		if p, err := exec.LookPath(t); err == nil {
			i.Tools[t] = p
		}
	}
	probe := dir
	for probe != "" {
		if _, err := os.Stat(probe); err == nil {
			break
		}
		next := parent(probe)
		if next == probe {
			break
		}
		probe = next
	}
	detect(&i, probe)
	return i
}

func parent(p string) string {
	p = strings.TrimRight(p, `/\`)
	if j := strings.LastIndexAny(p, `/\`); j > 0 {
		return p[:j]
	}
	return p
}

func toolNames() []string {
	names := []string{"qemu-img", "ssh", "ssh-keygen", "git"}
	switch runtime.GOARCH {
	case "arm64":
		names = append(names, "qemu-system-aarch64")
	default:
		names = append(names, "qemu-system-x86_64")
	}
	if runtime.GOOS == "windows" {
		names = append(names, "powershell")
	}
	return names
}

// Summary is a short human description.
func (i Info) Summary() string {
	return fmt.Sprintf("%s/%s, %d CPUs, %d MiB memory (%d MiB available), %d MiB free disk at %s, virtualisation: %s",
		i.OS, i.Arch, i.CPUs, i.MemMiB, i.MemAvailMiB, i.DiskFreeMiB, i.DiskPath, i.Virt.Detail)
}

func run(name string, args ...string) string {
	out, err := exec.Command(name, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
