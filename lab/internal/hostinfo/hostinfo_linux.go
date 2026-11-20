//go:build linux

package hostinfo

import (
	"bufio"
	"os"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

func detect(i *Info, dir string) {
	if f, err := os.Open("/proc/meminfo"); err == nil {
		s := bufio.NewScanner(f)
		for s.Scan() {
			fs := strings.Fields(s.Text())
			if len(fs) < 2 {
				continue
			}
			kb, _ := strconv.Atoi(fs[1])
			switch fs[0] {
			case "MemTotal:":
				i.MemMiB = kb / 1024
			case "MemAvailable:":
				i.MemAvailMiB = kb / 1024
			}
		}
		f.Close()
	}
	var st unix.Statfs_t
	if unix.Statfs(dir, &st) == nil {
		i.DiskFreeMiB = int(st.Bavail * uint64(st.Bsize) / (1 << 20))
	}
	cpuinfo, _ := os.ReadFile("/proc/cpuinfo")
	flags := ""
	for _, line := range strings.Split(string(cpuinfo), "\n") {
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		switch strings.TrimSpace(k) {
		case "model name":
			if i.CPUModel == "" {
				i.CPUModel = strings.TrimSpace(v)
			}
		case "flags":
			if flags == "" {
				flags = " " + v + " "
			}
		}
	}
	i.Virt.Nested = strings.Contains(flags, " hypervisor ")
	if rel, err := os.ReadFile("/etc/os-release"); err == nil {
		for _, l := range strings.Split(string(rel), "\n") {
			if v, ok := strings.CutPrefix(l, "PRETTY_NAME="); ok {
				i.OSVersion = strings.Trim(v, `"`)
			}
		}
	}
	f, err := os.OpenFile("/dev/kvm", os.O_RDWR, 0)
	switch {
	case err == nil:
		f.Close()
		i.Virt.Accel = "kvm"
		i.Virt.Detail = "KVM (/dev/kvm is usable)"
	case os.IsPermission(err):
		i.Virt.Detail = "/dev/kvm exists but this user cannot open it: add yourself to the kvm group (sudo usermod -aG kvm $USER) and log in again"
	case strings.Contains(flags, " vmx ") || strings.Contains(flags, " svm "):
		i.Virt.Detail = "the CPU supports virtualisation but /dev/kvm is missing: load the kvm_intel or kvm_amd module, or turn virtualisation on in the firmware"
	default:
		i.Virt.Detail = "no hardware virtualisation: VMs would be emulated and too slow; turn VT-x/AMD-V on in the firmware (or nested virtualisation in the hypervisor this machine runs in)"
	}
}
