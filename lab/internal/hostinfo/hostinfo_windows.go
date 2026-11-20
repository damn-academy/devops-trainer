//go:build windows

package hostinfo

import (
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
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
	sys := os.Getenv("SystemRoot")
	if sys == "" {
		sys = `C:\Windows`
	}
	// WHPX: the Windows Hypervisor Platform feature (Home editions too).
	_, whpxErr := os.Stat(filepath.Join(sys, "System32", "WinHvPlatform.dll"))
	// Hyper-V: the PowerShell module and a running hypervisor (Pro, Enterprise, Education).
	hv := run("powershell", "-NoProfile", "-NonInteractive", "-Command",
		"if (Get-Command Get-VM -ErrorAction SilentlyContinue) { try { Get-VMHost | Out-Null; 'yes' } catch { 'denied' } } else { 'no' }")
	i.Virt.HyperV = hv == "yes"
	present := strings.EqualFold(run("powershell", "-NoProfile", "-NonInteractive", "-Command", "(Get-CimInstance Win32_ComputerSystem).HypervisorPresent"), "True")
	switch {
	case i.Virt.HyperV:
		i.Virt.Detail = "Hyper-V"
	case hv == "denied":
		i.Virt.Detail = "Hyper-V is on, but this user is not in the Hyper-V Administrators group"
	}
	if whpxErr == nil && present {
		i.Virt.Accel = "whpx"
		if i.Virt.Detail == "" {
			i.Virt.Detail = "Windows Hypervisor Platform"
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
