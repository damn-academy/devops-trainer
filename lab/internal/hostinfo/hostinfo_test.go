package hostinfo

import "testing"

func TestDetectRuns(t *testing.T) {
	i := Detect(t.TempDir())
	if i.CPUs < 1 || i.MemMiB <= 0 || i.DiskFreeMiB <= 0 || i.Virt.Detail == "" {
		t.Errorf("%+v", i)
	}
}

func TestToolDirs(t *testing.T) {
	env := map[string]string{"ProgramFiles": `C:\Program Files\`, "ProgramW6432": `c:\program files`}
	got := ToolDirs("windows", func(k string) string { return env[k] })
	if len(got) != 1 || got[0] != `C:\Program Files\qemu` {
		t.Errorf("windows: %q", got)
	}
	if got := ToolDirs("windows", func(string) string { return "" }); len(got) != 1 || got[0] != `C:\Program Files\qemu` {
		t.Errorf("windows, no environment: %q", got)
	}
	if got := ToolDirs("linux", func(string) string { return "/x" }); got != nil {
		t.Errorf("linux: %q", got)
	}
}

func TestWHPXAnswer(t *testing.T) {
	for _, c := range []struct {
		hr      uintptr
		present uint32
		want    bool
	}{{0, 1, true}, {0, 0, false}, {0x80070057, 1, false}} {
		if got := whpxAnswer(c.hr, c.present); got != c.want {
			t.Errorf("%#x %d: %v", c.hr, c.present, got)
		}
	}
}
