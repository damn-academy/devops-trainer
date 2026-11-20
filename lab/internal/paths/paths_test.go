package paths

import (
	"path/filepath"
	"testing"
)

func TestDefaultRoot(t *testing.T) {
	if got := DefaultRoot("windows", `C:\Users\a\AppData\Local`, `C:\Users\a`); got != filepath.Join(`C:\Users\a\AppData\Local`, "dtlab") {
		t.Error(got)
	}
	if got := DefaultRoot("darwin", "", "/Users/a"); got != "/Users/a/.dtlab" {
		t.Error(got)
	}
}
