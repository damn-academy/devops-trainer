package backend

import (
	"context"
	"fmt"
	"strings"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

// HyperV runs the VMs as Generation 2 Hyper-V machines on an internal
// switch "dtlab" with NAT, the host at the gateway address. Ubuntu VMs get
// their address from network-config on a seed ISO; kuberoot gets a second
// card on the Default Switch for the internet and its lab address as a
// kernel argument, because Hyper-V's internal switch has no DHCP.
type HyperV struct {
	R Runner
	// VMDir: where the VM's configuration and checkpoints go.
	VMDir func(name string) string
}

// Switch and NAT names, recorded in the manifest when dtlab makes them.
const (
	HyperVSwitch = "dtlab"
	HyperVNAT    = "dtlab"
)

func (h *HyperV) Name() string       { return "hyperv" }
func (h *HyperV) DiskFormat() string { return "vhdx" }

func vmName(vm profile.VM) string { return "dtlab-" + vm.Name }

// ps quotes a string for PowerShell (single quotes, doubled inside).
func ps(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

func (h *HyperV) run(ctx context.Context, script string) ([]byte, error) {
	out, err := h.R.Run(ctx, "powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "$ErrorActionPreference='Stop'; "+script)
	if err != nil {
		return out, fmt.Errorf("hyper-v: %v: %s", err, strings.TrimSpace(string(out)))
	}
	return out, nil
}

// PrepareScript makes the switch, the host's addresses on it and the NAT,
// each only if missing, and prints which ones it made (for the manifest).
func PrepareScript() string {
	return strings.Join([]string{
		fmt.Sprintf("if (-not (Get-VMSwitch -Name %s -ErrorAction SilentlyContinue)) { New-VMSwitch -Name %s -SwitchType Internal | Out-Null; 'made:switch' }", ps(HyperVSwitch), ps(HyperVSwitch)),
		fmt.Sprintf("$if = Get-NetAdapter -Name %s", ps("vEthernet ("+HyperVSwitch+")")),
		fmt.Sprintf("foreach ($a in @(%s, %s)) { if (-not (Get-NetIPAddress -InterfaceIndex $if.ifIndex -IPAddress $a -ErrorAction SilentlyContinue)) { New-NetIPAddress -InterfaceIndex $if.ifIndex -IPAddress $a -PrefixLength %d | Out-Null } }", ps(profile.Gateway), ps(profile.HostIP), profile.Prefix),
		fmt.Sprintf("if (-not (Get-NetNat -Name %s -ErrorAction SilentlyContinue)) { New-NetNat -Name %s -InternalIPInterfaceAddressPrefix %s | Out-Null; 'made:nat' }", ps(HyperVNAT), ps(HyperVNAT), ps(profile.Subnet)),
	}, "; ")
}

func (h *HyperV) Prepare(ctx context.Context) error {
	_, err := h.run(ctx, PrepareScript())
	return err
}

// TeardownScript removes the NAT and the switch.
func TeardownScript() string {
	return fmt.Sprintf("Get-NetNat -Name %s -ErrorAction SilentlyContinue | Remove-NetNat -Confirm:$false; Get-VMSwitch -Name %s -ErrorAction SilentlyContinue | Remove-VMSwitch -Force",
		ps(HyperVNAT), ps(HyperVSwitch))
}

func (h *HyperV) Teardown(ctx context.Context) error {
	_, err := h.run(ctx, TeardownScript())
	return err
}

// CreateScript defines and starts the VM. Disks must be VHDX.
func CreateScript(vm profile.VM, d Disks, dir string) string {
	n := ps(vmName(vm))
	s := []string{
		fmt.Sprintf("if (-not (Get-VM -Name %s -ErrorAction SilentlyContinue)) {", n),
		fmt.Sprintf("New-VM -Name %s -Generation 2 -MemoryStartupBytes %dMB -VHDPath %s -SwitchName %s -Path %s | Out-Null", n, vm.MemMiB, ps(d.System), ps(HyperVSwitch), ps(dir)),
		fmt.Sprintf("Set-VMProcessor -VMName %s -Count %d", n, vm.CPUs),
		fmt.Sprintf("Set-VMMemory -VMName %s -DynamicMemoryEnabled $false", n),
		// Neither kuberoot's systemd-boot nor the Ubuntu image is signed for
		// Hyper-V's Microsoft-only Secure Boot template.
		fmt.Sprintf("Set-VMFirmware -VMName %s -EnableSecureBoot Off", n),
		fmt.Sprintf("Get-VMNetworkAdapter -VMName %s | Set-VMNetworkAdapter -StaticMacAddress %s", n, ps(strings.ReplaceAll(vm.MAC, ":", ""))),
		fmt.Sprintf("Set-VM -Name %s -AutomaticCheckpointsEnabled $false -AutomaticStartAction Nothing -AutomaticStopAction ShutDown", n),
	}
	if d.Seed != "" {
		s = append(s, fmt.Sprintf("Add-VMDvdDrive -VMName %s -Path %s", n, ps(d.Seed)))
	}
	if d.Media != "" {
		s = append(s,
			fmt.Sprintf("Add-VMHardDiskDrive -VMName %s -Path %s", n, ps(d.Media)),
			// The internet for kuberoot: a second card on the Default Switch (eth1 is the lab card).
			fmt.Sprintf("Add-VMNetworkAdapter -VMName %s -SwitchName 'Default Switch'", n),
			// System disk first: empty on the first boot, so the media boots.
			fmt.Sprintf("$d = Get-VMHardDiskDrive -VMName %s; Set-VMFirmware -VMName %s -BootOrder $d", n, n),
		)
	}
	s = append(s, "}", fmt.Sprintf("Start-VM -Name %s", n))
	return strings.Join(s, "; ")
}

func (h *HyperV) Start(ctx context.Context, vm profile.VM, d Disks) (Status, error) {
	if _, err := h.run(ctx, CreateScript(vm, d, h.VMDir(vm.Name))); err != nil {
		return Status{}, err
	}
	return Status{Running: true}, nil
}

func (h *HyperV) Stop(ctx context.Context, vm profile.VM, st Status) error {
	_, err := h.run(ctx, fmt.Sprintf("Get-VM -Name %s -ErrorAction SilentlyContinue | Where-Object State -ne 'Off' | Stop-VM -Force", ps(vmName(vm))))
	return err
}

func (h *HyperV) Status(ctx context.Context, vm profile.VM, st Status) (Status, error) {
	out, err := h.run(ctx, fmt.Sprintf("$v = Get-VM -Name %s -ErrorAction SilentlyContinue; if ($v) { $v.State } else { 'Missing' }", ps(vmName(vm))))
	if err != nil {
		return Status{}, err
	}
	state := strings.TrimSpace(string(out))
	return Status{Running: state == "Running", Detail: state}, nil
}

func (h *HyperV) Remove(ctx context.Context, vm profile.VM) error {
	_, err := h.run(ctx, fmt.Sprintf("Get-VM -Name %s -ErrorAction SilentlyContinue | Remove-VM -Force", ps(vmName(vm))))
	return err
}

// SeedISOScript writes a NoCloud seed ISO (volume label CIDATA, Joliet
// names) from a directory with Windows' own image mastering API, so no ISO
// tool needs to be installed.
func SeedISOScript(srcDir, iso string) string {
	return strings.Join([]string{
		"$fs = New-Object -ComObject IMAPI2FS.MsftFileSystemImage",
		"$fs.FileSystemsToCreate = 3", // ISO9660 + Joliet
		"$fs.VolumeName = 'CIDATA'",
		fmt.Sprintf("$fs.Root.AddTree(%s, $false)", ps(srcDir)),
		"$img = $fs.CreateResultImage()",
		fmt.Sprintf("$out = [System.IO.File]::Create(%s)", ps(iso)),
		"$st = $img.ImageStream; $buf = New-Object byte[] 2048; $n = 0",
		"while ($true) { $r = 0; $st.RemoteRead($buf, 2048, [ref]$r); if ($r -le 0) { break }; $out.Write($buf, 0, $r) }",
		"$out.Close()",
	}, "; ")
}
