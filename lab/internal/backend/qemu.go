package backend

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

// QEMU runs every VM as a qemu-system process of the learner's user.
type QEMU struct {
	GOOS, Arch string // host
	Accel      string // kvm, hvf, whpx, tcg
	Bin        string // qemu-system-x86_64 or qemu-system-aarch64
	Firmware   Firmware
	// SwitchAddr: the agent's lab switch (127.0.0.1:port).
	SwitchAddr string
	// SeedURL: base URL of the seeds as VMs see it (http://10.10.1.254:7788/seed/).
	SeedURL string
	// VMDir returns the VM's directory (console log, firmware variables).
	VMDir func(name string) string
	R     Runner
	// Wait between a polite shutdown and the kill.
	ShutdownTimeout time.Duration
}

// Firmware is the UEFI code and the template of its variables.
type Firmware struct{ Code, Vars string }

func (q *QEMU) Name() string                      { return "qemu" }
func (q *QEMU) DiskFormat() string                { return "qcow2" }
func (q *QEMU) Prepare(ctx context.Context) error { return nil }
func (q *QEMU) Teardown(ctx context.Context) error {
	return nil // the network lives in the agent process: nothing on the host to undo
}
func (q *QEMU) Remove(ctx context.Context, vm profile.VM) error { return nil }

// QMPPort is the VM's QEMU monitor on loopback, by its address.
func QMPPort(vm profile.VM) int {
	ip := net.ParseIP(vm.IP).To4()
	if ip == nil {
		return 7900
	}
	return 7900 + int(ip[3])
}

// Args builds the qemu-system command line of a VM.
func (q *QEMU) Args(vm profile.VM, d Disks) []string {
	dir := q.VMDir(vm.Name)
	a := []string{"-name", "dtlab-" + vm.Name}
	arm := q.Arch == "arm64"
	switch {
	case arm && q.Accel == "kvm":
		a = append(a, "-machine", "virt,gic-version=host", "-accel", "kvm", "-cpu", "host")
	case arm && q.Accel == "hvf":
		a = append(a, "-machine", "virt,highmem=on", "-accel", "hvf", "-cpu", "host")
	case arm:
		a = append(a, "-machine", "virt", "-accel", "tcg", "-cpu", "max")
	case q.Accel == "kvm" || q.Accel == "hvf":
		a = append(a, "-machine", "q35", "-accel", q.Accel, "-cpu", "host")
	case q.Accel == "whpx":
		// The in-kernel irqchip of WHPX does not run every guest; QEMU's own does.
		a = append(a, "-machine", "q35", "-accel", "whpx,kernel-irqchip=off", "-cpu", "max")
	default:
		a = append(a, "-machine", "q35", "-accel", "tcg", "-cpu", "max")
	}
	a = append(a, "-smp", strconv.Itoa(vm.CPUs), "-m", strconv.Itoa(vm.MemMiB))
	a = append(a,
		"-drive", "if=pflash,format=raw,readonly=on,file="+q.Firmware.Code,
		"-drive", "if=pflash,format=raw,file="+filepath.Join(dir, "efivars.fd"))
	a = append(a, "-drive", "file="+d.System+",format=qcow2,if=none,id=sys,discard=unmap",
		"-device", "virtio-blk-pci,drive=sys,bootindex=0")
	if d.Media != "" {
		// snapshot=on: the media stays as built; the installer only reads it.
		a = append(a, "-drive", "file="+d.Media+",format=raw,if=none,id=media,snapshot=on",
			"-device", "virtio-blk-pci,drive=media,bootindex=1")
	}
	a = append(a, "-netdev", "socket,id=lab,connect="+q.SwitchAddr,
		"-device", "virtio-net-pci,netdev=lab,mac="+vm.MAC)
	if vm.Kind != profile.Kuberoot && q.SeedURL != "" {
		// NoCloud over HTTP, named in the SMBIOS serial: no seed disk to make.
		a = append(a, "-smbios", "type=1,serial=ds=nocloud;s="+q.SeedURL+vm.Name+"/")
	}
	a = append(a, "-device", "virtio-rng-pci",
		"-chardev", "file,id=console,path="+filepath.Join(dir, "console.log"),
		"-serial", "chardev:console",
		"-qmp", "tcp:127.0.0.1:"+strconv.Itoa(QMPPort(vm))+",server=on,wait=off",
		"-display", "none")
	return a
}

// Start copies the firmware variables on first boot and starts QEMU.
func (q *QEMU) Start(ctx context.Context, vm profile.VM, d Disks) (Status, error) {
	dir := q.VMDir(vm.Name)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return Status{}, err
	}
	vars := filepath.Join(dir, "efivars.fd")
	if _, err := os.Stat(vars); os.IsNotExist(err) {
		if err := copyFile(q.Firmware.Vars, vars); err != nil {
			return Status{}, fmt.Errorf("UEFI variables: %w", err)
		}
	}
	pid, err := q.R.Start(q.Bin, q.Args(vm, d), filepath.Join(dir, "qemu.log"))
	if err != nil {
		return Status{}, err
	}
	return Status{Running: true, PID: pid}, nil
}

// Stop asks the guest to power off through QMP, then kills QEMU.
func (q *QEMU) Stop(ctx context.Context, vm profile.VM, st Status) error {
	if st.PID == 0 || !q.R.Alive(st.PID) {
		return nil
	}
	if err := qmp(QMPPort(vm), "system_powerdown"); err == nil {
		deadline := time.Now().Add(q.ShutdownTimeout)
		for time.Now().Before(deadline) {
			if !q.R.Alive(st.PID) {
				return nil
			}
			time.Sleep(time.Second)
		}
	}
	return q.R.Kill(st.PID)
}

func (q *QEMU) Status(ctx context.Context, vm profile.VM, st Status) (Status, error) {
	if st.PID != 0 && q.R.Alive(st.PID) {
		return Status{Running: true, PID: st.PID}, nil
	}
	return Status{}, nil
}

// qmp sends one command to a QEMU monitor.
func qmp(port int, command string) error {
	c, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)), 3*time.Second)
	if err != nil {
		return err
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(5 * time.Second))
	r := bufio.NewReader(c)
	if _, err := r.ReadBytes('\n'); err != nil { // greeting
		return err
	}
	enc := json.NewEncoder(c)
	for _, cmd := range []string{"qmp_capabilities", command} {
		if err := enc.Encode(map[string]string{"execute": cmd}); err != nil {
			return err
		}
		if _, err := r.ReadBytes('\n'); err != nil {
			return err
		}
	}
	return nil
}

// ImgCreate is the qemu-img command for a VM's system disk: an overlay on
// the cached image (only the VM's changes take space), or an empty disk.
func ImgCreate(qemuImg, disk, base string, sizeGiB int) []string {
	args := []string{qemuImg, "create", "-q", "-f", "qcow2"}
	if base != "" {
		args = append(args, "-F", "qcow2", "-b", base)
	}
	return append(args, disk, strconv.Itoa(sizeGiB)+"G")
}

// FirmwareCandidates are the places QEMU's UEFI images are installed by
// the systems' packages, the QEMU dtlab bundles first.
func FirmwareCandidates(goos, arch, bundled string) []Firmware {
	var f []Firmware
	if arch == "arm64" {
		if bundled != "" {
			f = append(f, Firmware{filepath.Join(bundled, "share", "edk2-aarch64-code.fd"), filepath.Join(bundled, "share", "edk2-arm-vars.fd")})
		}
		f = append(f,
			Firmware{"/opt/homebrew/share/qemu/edk2-aarch64-code.fd", "/opt/homebrew/share/qemu/edk2-arm-vars.fd"},
			Firmware{"/usr/share/AAVMF/AAVMF_CODE.fd", "/usr/share/AAVMF/AAVMF_VARS.fd"},
			Firmware{"/usr/share/qemu-efi-aarch64/QEMU_EFI.fd", "/usr/share/AAVMF/AAVMF_VARS.fd"},
			Firmware{"/usr/share/edk2/aarch64/QEMU_EFI-pflash.raw", "/usr/share/edk2/aarch64/vars-template-pflash.raw"},
		)
		return f
	}
	if bundled != "" {
		f = append(f, Firmware{filepath.Join(bundled, "share", "edk2-x86_64-code.fd"), filepath.Join(bundled, "share", "edk2-i386-vars.fd")})
	}
	switch goos {
	case "windows":
		f = append(f, Firmware{`C:\Program Files\qemu\share\edk2-x86_64-code.fd`, `C:\Program Files\qemu\share\edk2-i386-vars.fd`})
	case "darwin":
		f = append(f,
			Firmware{"/opt/homebrew/share/qemu/edk2-x86_64-code.fd", "/opt/homebrew/share/qemu/edk2-i386-vars.fd"},
			Firmware{"/usr/local/share/qemu/edk2-x86_64-code.fd", "/usr/local/share/qemu/edk2-i386-vars.fd"})
	default:
		f = append(f,
			Firmware{"/usr/share/OVMF/OVMF_CODE_4M.fd", "/usr/share/OVMF/OVMF_VARS_4M.fd"},
			Firmware{"/usr/share/OVMF/OVMF_CODE.fd", "/usr/share/OVMF/OVMF_VARS.fd"},
			Firmware{"/usr/share/edk2/ovmf/OVMF_CODE.fd", "/usr/share/edk2/ovmf/OVMF_VARS.fd"},
			Firmware{"/usr/share/qemu/edk2-x86_64-code.fd", "/usr/share/qemu/edk2-i386-vars.fd"})
	}
	return f
}

// FindFirmware returns the first candidate whose files exist.
func FindFirmware(c []Firmware) (Firmware, error) {
	for _, f := range c {
		if exists(f.Code) && exists(f.Vars) {
			return f, nil
		}
	}
	return Firmware{}, fmt.Errorf("no UEFI firmware for QEMU found (install the ovmf/qemu-efi package, or let dtlab fetch its QEMU)")
}

func exists(p string) bool { _, err := os.Stat(p); return err == nil }

func copyFile(src, dst string) error {
	raw, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, raw, 0o600)
}
