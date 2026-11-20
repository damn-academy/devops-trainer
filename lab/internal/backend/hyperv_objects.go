package backend

import (
	"context"
	"fmt"
	"strings"

	"github.com/tym83/devops-trainer/lab/internal/manifest"
)

// HyperVObjects checks and removes the Hyper-V objects the manifest names,
// for `dtlab uninstall`.
type HyperVObjects struct{ R Runner }

func objectQuery(it manifest.Item) (get, remove string) {
	switch it.Kind {
	case manifest.HyperVVM:
		n := ps("dtlab-" + it.Path)
		return "Get-VM -Name " + n, "Get-VM -Name " + n + " | Stop-VM -TurnOff -Force; Get-VM -Name " + n + " | Remove-VM -Force"
	case manifest.HyperVNet:
		return "Get-VMSwitch -Name " + ps(it.Path), "Remove-VMSwitch -Name " + ps(it.Path) + " -Force"
	case manifest.PathEntry: // windows:user-path, Line = the directory dtlab added
		get = "([Environment]::GetEnvironmentVariable('Path','User') -split ';') -contains " + ps(it.Line)
		return "(" + get + ")", "$p = ([Environment]::GetEnvironmentVariable('Path','User') -split ';' | Where-Object { $_ -ne " + ps(it.Line) + " }) -join ';'; [Environment]::SetEnvironmentVariable('Path', $p, 'User')"
	case manifest.HyperVFW:
		return "Get-NetFirewallRule -Name " + ps(it.Path), "Remove-NetFirewallRule -Name " + ps(it.Path)
	case manifest.HyperVNAT:
		return "Get-NetNat -Name " + ps(it.Path), "Remove-NetNat -Name " + ps(it.Path) + " -Confirm:$false"
	}
	return "", ""
}

func (h HyperVObjects) Exists(it manifest.Item) bool {
	get, _ := objectQuery(it)
	if get == "" || h.R == nil {
		return false
	}
	q := "if (" + get + " -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }"
	if it.Kind == manifest.PathEntry {
		q = "if " + get + " { 'yes' } else { 'no' }"
	}
	out, err := h.R.Run(context.Background(), "powershell", "-NoProfile", "-NonInteractive", "-Command", q)
	return err == nil && strings.TrimSpace(string(out)) == "yes"
}

func (h HyperVObjects) Remove(ctx context.Context, it manifest.Item) error {
	_, rm := objectQuery(it)
	if rm == "" {
		return fmt.Errorf("unknown object %s", it.Kind)
	}
	out, err := h.R.Run(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", rm)
	if err != nil {
		return fmt.Errorf("%v: %s", err, out)
	}
	return nil
}
