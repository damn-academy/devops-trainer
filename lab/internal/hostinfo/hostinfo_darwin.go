//go:build darwin

package hostinfo

import (
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

func detect(i *Info, dir string) {
	if v, err := unix.SysctlUint64("hw.memsize"); err == nil {
		i.MemMiB = int(v / (1 << 20))
	}
	i.CPUModel, _ = unix.Sysctl("machdep.cpu.brand_string")
	i.OSVersion = "macOS " + run("sw_vers", "-productVersion")
	i.MemAvailMiB = vmStatAvailable(run("vm_stat"))
	if i.MemAvailMiB == 0 {
		i.MemAvailMiB = i.MemMiB / 2
	}
	var st unix.Statfs_t
	if unix.Statfs(dir, &st) == nil {
		i.DiskFreeMiB = int(st.Bavail * uint64(st.Bsize) / (1 << 20))
	}
	hv, err := unix.SysctlUint32("kern.hv_support")
	if err == nil && hv == 1 {
		i.Virt.Accel = "hvf"
		i.Virt.Detail = "Hypervisor.framework"
	} else {
		i.Virt.Detail = "Hypervisor.framework is not available (a Mac inside a VM without nested virtualisation?)"
	}
	if vmm, err := unix.SysctlUint32("kern.hv_vmm_present"); err == nil && vmm == 1 {
		i.Virt.Nested = true
	}
}

// vmStatAvailable reads `vm_stat`: free, inactive, speculative and
// purgeable pages are what the system gives up without swapping.
func vmStatAvailable(out string) int {
	page := 4096
	if j := strings.Index(out, "page size of "); j >= 0 {
		f := strings.Fields(out[j+len("page size of "):])
		if len(f) > 0 {
			page, _ = strconv.Atoi(f[0])
		}
	}
	pages := 0
	for _, l := range strings.Split(out, "\n") {
		k, v, ok := strings.Cut(l, ":")
		if !ok {
			continue
		}
		switch strings.TrimSpace(k) {
		case "Pages free", "Pages inactive", "Pages speculative", "Pages purgeable":
			n, _ := strconv.Atoi(strings.TrimSuffix(strings.TrimSpace(v), "."))
			pages += n
		}
	}
	return pages * page / (1 << 20)
}
