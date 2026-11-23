package backend

import (
	"context"
	"fmt"
	"strings"

	"github.com/damn-academy/devops-trainer/lab/internal/profile"
)

// HyperV runs the VMs as Generation 2 Hyper-V machines on an internal
// switch "dtlab" with NAT, the host at the gateway address. The switch has
// no DHCP of its own: the lab agent answers on it (package labdhcp), and
// Ubuntu VMs also carry their address in network-config on a seed ISO.
// Every VM has one card, as with QEMU; none depends on the Default Switch,
// which Windows Server does not have.
type HyperV struct {
	R Runner
	// VMDir: where the VM's configuration and checkpoints go.
	VMDir func(name string) string
}

// Switch, NAT and firewall rule names, recorded in the manifest when dtlab
// makes them. The rule lets the VMs reach the agent (DHCP, the check
// scripts, kubectl) through Windows' firewall, on the lab switch only.
const (
	HyperVSwitch   = "dtlab"
	HyperVNAT      = "dtlab"
	HyperVFirewall = "dtlab-lab"
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
		fmt.Sprintf("if (-not (Get-NetFirewallRule -Name %s -ErrorAction SilentlyContinue)) { New-NetFirewallRule -Name %s -DisplayName 'dtlab: the lab VMs reach the lab agent' -Direction Inbound -InterfaceAlias %s -Action Allow | Out-Null; 'made:firewall' }", ps(HyperVFirewall), ps(HyperVFirewall), ps("vEthernet ("+HyperVSwitch+")")),
	}, "; ")
}

func (h *HyperV) Prepare(ctx context.Context) error {
	_, err := h.run(ctx, PrepareScript())
	return err
}

// TeardownScript removes the NAT and the switch.
func TeardownScript() string {
	return fmt.Sprintf("Get-NetFirewallRule -Name %s -ErrorAction SilentlyContinue | Remove-NetFirewallRule; Get-NetNat -Name %s -ErrorAction SilentlyContinue | Remove-NetNat -Confirm:$false; Get-VMSwitch -Name %s -ErrorAction SilentlyContinue | Remove-VMSwitch -Force",
		ps(HyperVFirewall), ps(HyperVNAT), ps(HyperVSwitch))
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
// tool needs to be installed. The image comes as a COM IStream, which
// PowerShell cannot read by itself (it has no RemoteRead to call), so a few
// lines of C# copy it; an empty result is an error, never a silent seed.
func SeedISOScript(srcDir, iso string) string {
	return strings.Join([]string{
		"$ErrorActionPreference = 'Stop'",
		"Add-Type -TypeDefinition 'public static class DtlabIso { public static void Write(string path, object image) { var s = (System.Runtime.InteropServices.ComTypes.IStream)image; var buf = new byte[65536]; var n = System.Runtime.InteropServices.Marshal.AllocHGlobal(4); var o = System.IO.File.Create(path); try { while (true) { s.Read(buf, buf.Length, n); int r = System.Runtime.InteropServices.Marshal.ReadInt32(n); if (r <= 0) break; o.Write(buf, 0, r); } } finally { o.Close(); System.Runtime.InteropServices.Marshal.FreeHGlobal(n); } } }'",
		"$fs = New-Object -ComObject IMAPI2FS.MsftFileSystemImage",
		"$fs.FileSystemsToCreate = 3", // ISO9660 + Joliet
		"$fs.VolumeName = 'CIDATA'",
		fmt.Sprintf("$fs.Root.AddTree(%s, $false)", ps(srcDir)),
		fmt.Sprintf("[DtlabIso]::Write(%s, $fs.CreateResultImage().ImageStream)", ps(iso)),
		fmt.Sprintf("if ((Get-Item %s).Length -lt 32768) { throw 'the seed ISO came out empty' }", ps(iso)),
	}, "; ")
}
