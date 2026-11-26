package uninstall

import (
	"os"
	"path/filepath"
	"strings"
)

// PackageHint protects native installer locations from self-deletion.
func PackageHint(goos, exe string) string {
	switch goos {
	case "linux":
		if filepath.Clean(exe) == "/usr/bin/dtlab" {
			if _, err := os.Stat("/etc/debian_version"); err == nil {
				return "sudo apt remove dtlab"
			}
			return "sudo dnf remove dtlab"
		}
	case "darwin":
		if filepath.Clean(exe) == "/usr/local/bin/dtlab" {
			return "sudo rm /usr/local/bin/dtlab && sudo pkgutil --forget academy.damn.dtlab"
		}
	case "windows":
		p := strings.ToLower(strings.ReplaceAll(exe, `\`, "/"))
		if strings.HasSuffix(p, "/dtlab/dtlab.exe") && strings.Contains(p, "/program files/") {
			return `msiexec /x "{0DD00383-AB75-4AB1-9F7B-E77BA5EA70DA}"`
		}
	}
	return ""
}
