// Package backend starts and stops the lab's VMs with the hypervisor of the
// host: QEMU (with KVM on Linux, Hypervisor.framework on macOS, the Windows
// Hypervisor Platform on Windows) or Hyper-V on Windows.
//
// Every backend only builds commands and hands them to a Runner, so tests
// check the exact commands with a fake Runner and no VM ever starts.
package backend

import (
	"context"
	"fmt"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

// Disks a VM boots from, prepared by the lab before Start.
type Disks struct {
	// System: the VM's own disk (a qcow2 overlay of the Ubuntu image, or
	// kuberoot's empty system disk; VHDX on Hyper-V).
	System string
	// Media: kuberoot's boot media, attached read-only after the system
	// disk in boot order, so the empty disk falls through to it on the first
	// boot and the installed system boots from then on.
	Media string
	// Seed: the NoCloud seed ISO (Hyper-V); QEMU VMs read their seed from
	// the lab agent over HTTP instead.
	Seed string
}

// Status of a VM as the backend sees it.
type Status struct {
	Running bool   `json:"running"`
	PID     int    `json:"pid,omitempty"`
	Detail  string `json:"detail,omitempty"`
}

// Backend is one way to run VMs.
type Backend interface {
	Name() string
	// Prepare makes the host side ready once per lab (Hyper-V: the switch
	// and the NAT; QEMU: nothing, the agent's switch is the network).
	Prepare(ctx context.Context) error
	// Start boots the VM with its disks; QEMU returns at once with the VM
	// running in the background.
	Start(ctx context.Context, vm profile.VM, d Disks) (Status, error)
	// Stop shuts the VM down, first politely, then by force.
	Stop(ctx context.Context, vm profile.VM, st Status) error
	// Status reports whether the VM runs.
	Status(ctx context.Context, vm profile.VM, st Status) (Status, error)
	// Remove deletes what the backend registered for the VM (Hyper-V's VM
	// object); disks are files under the lab root and are removed by the lab.
	Remove(ctx context.Context, vm profile.VM) error
	// Teardown removes the host side made by Prepare.
	Teardown(ctx context.Context) error
	// DiskFormat is the format system disks must have: qcow2 or vhdx.
	DiskFormat() string
}

// Runner runs host commands. The real one execs; tests record.
type Runner interface {
	// Run runs a command to its end and returns its combined output.
	Run(ctx context.Context, name string, args ...string) ([]byte, error)
	// Start starts a long-running command detached from dtlab, its output
	// to logFile, and returns its process id.
	Start(name string, args []string, logFile string) (int, error)
	// Alive reports whether the process runs.
	Alive(pid int) bool
	// Kill ends the process.
	Kill(pid int) error
}

// Choice is the backend picked for a host, with the reason.
type Choice struct {
	Name   string `json:"name"`   // qemu or hyperv
	Accel  string `json:"accel"`  // kvm, hvf, whpx, tcg
	Reason string `json:"reason"` // in plain words
}

// Choose picks the backend for an OS: QEMU everywhere it can be
// accelerated; Hyper-V on Windows when it is on and the Windows Hypervisor
// Platform is not (QEMU with WHPX starts kuberoot's EFI media the same way
// as on the other systems, so it is preferred when both are there).
// force names a backend (--backend) and wins.
func Choose(goos, accel string, hyperV bool, force string) (Choice, error) {
	switch force {
	case "", "auto":
	case "qemu":
		if accel == "" {
			accel = "tcg"
		}
		return Choice{Name: "qemu", Accel: accel, Reason: "asked for with --backend qemu"}, nil
	case "hyperv":
		if goos != "windows" {
			return Choice{}, fmt.Errorf("Hyper-V exists only on Windows")
		}
		return Choice{Name: "hyperv", Reason: "asked for with --backend hyperv"}, nil
	default:
		return Choice{}, fmt.Errorf("unknown backend %q (qemu or hyperv)", force)
	}
	switch {
	case goos == "linux" && accel == "kvm":
		return Choice{"qemu", "kvm", "Linux with KVM: QEMU runs the VMs at native speed"}, nil
	case goos == "darwin" && accel == "hvf":
		return Choice{"qemu", "hvf", "macOS: QEMU on Hypervisor.framework boots both kuberoot's EFI media and Ubuntu cloud images, on Intel and Apple Silicon"}, nil
	case goos == "windows" && accel == "whpx":
		return Choice{"qemu", "whpx", "Windows with the Windows Hypervisor Platform: QEMU, the same VMs and network as on Linux and macOS"}, nil
	case goos == "windows" && hyperV:
		return Choice{"hyperv", "", "Windows with Hyper-V: VHDX disks on an internal switch with NAT"}, nil
	}
	return Choice{}, fmt.Errorf("no usable hypervisor on this computer; run `dtlab check` for what to turn on")
}
