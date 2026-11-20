//go:build windows

package hostinfo

import (
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

func detect(i *Info, dir string) {
	var m memoryStatusEx
	m.Length = uint32(unsafe.Sizeof(m))
	proc := windows.NewLazySystemDLL("kernel32.dll").NewProc("GlobalMemoryStatusEx")
	if r, _, _ := proc.Call(uintptr(unsafe.Pointer(&m))); r != 0 {
		i.MemMiB = int(m.TotalPhys / (1 << 20))
		i.MemAvailMiB = int(m.AvailPhys / (1 << 20))
	}
	var free, total, totalFree uint64
	if p, err := windows.UTF16PtrFromString(dir); err == nil {
		if windows.GetDiskFreeSpaceEx(p, &free, &total, &totalFree) == nil {
			i.DiskFreeMiB = int(free / (1 << 20))
		}
	}
	v := windows.RtlGetVersion()
	i.OSVersion = "Windows " + itoa(int(v.MajorVersion)) + "." + itoa(int(v.MinorVersion)) + " build " + itoa(int(v.BuildNumber))
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\CentralProcessor\0`, registry.QUERY_VALUE); err == nil {
		if name, _, err := k.GetStringValue("ProcessorNameString"); err == nil {
			i.CPUModel = strings.TrimSpace(name)
		}
		k.Close()
	}
	// WHPX: the Windows Hypervisor Platform feature (Home editions too).
	// WinHvPlatform.dll is there with the feature off, and a hypervisor is
	// present whenever Hyper-V, virtualisation-based security or an outer
	// hypervisor runs, so neither tells; WHvGetCapability is what QEMU asks.
	whpx := whpxUsable()
	// Hyper-V: the PowerShell module and a running hypervisor (Pro, Enterprise, Education).
	hv := run("powershell", "-NoProfile", "-NonInteractive", "-Command",
		"if (Get-Command Get-VM -ErrorAction SilentlyContinue) { try { Get-VMHost | Out-Null; 'yes' } catch { 'denied' } } else { 'no' }")
	i.Virt.HyperV = hv == "yes"
	switch {
	case i.Virt.HyperV:
		i.Virt.Detail = "Hyper-V"
	case hv == "denied":
		i.Virt.Detail = "Hyper-V is on, but this user is not in the Hyper-V Administrators group"
	}
	if whpx {
		i.Virt.Accel = "whpx"
		if i.Virt.Detail == "" {
			i.Virt.Detail = "Windows Hypervisor Platform"
		} else {
			i.Virt.Detail += " and the Windows Hypervisor Platform"
		}
	}
	if i.Virt.Detail == "" {
		i.Virt.Detail = "no hypervisor: turn on \"Windows Hypervisor Platform\" (any edition) or Hyper-V (Pro) in Windows Features, and virtualisation in the firmware"
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	p := len(b)
	for n > 0 {
		p--
		b[p] = byte('0' + n%10)
		n /= 10
	}
	return string(b[p:])
}

// whpxUsable asks the Windows Hypervisor Platform whether it can run VMs:
// WHvGetCapability(WHvCapabilityCodeHypervisorPresent), as QEMU does.
func whpxUsable() bool {
	dll := windows.NewLazySystemDLL("WinHvPlatform.dll")
	proc := dll.NewProc("WHvGetCapability")
	if proc.Find() != nil {
		return false
	}
	var present, written uint32
	hr, _, _ := proc.Call(0, uintptr(unsafe.Pointer(&present)), 4, uintptr(unsafe.Pointer(&written)))
	return whpxAnswer(hr, present)
}
