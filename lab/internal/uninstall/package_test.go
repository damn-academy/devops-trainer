package uninstall

import (
	"strings"
	"testing"
)

func TestPackageHint(t *testing.T) {
	for _, tc := range []struct{ os, path, want string }{
		{"linux", "/usr/bin/dtlab", "remove dtlab"},
		{"darwin", "/usr/local/bin/dtlab", "pkgutil --forget academy.damn.dtlab"},
		{"windows", `C:\Program Files\dtlab\dtlab.exe`, "msiexec /x"},
		{"linux", "/home/student/.dtlab/bin/dtlab", ""},
		{"linux", "/usr/local/bin/dtlab", ""},
	} {
		got := PackageHint(tc.os, tc.path)
		if tc.want == "" && got != "" || tc.want != "" && !strings.Contains(got, tc.want) {
			t.Errorf("%s: %q", tc.path, got)
		}
	}
}
