package hostinfo

import "testing"

func TestDetectRuns(t *testing.T) {
	i := Detect(t.TempDir())
	if i.CPUs < 1 || i.MemMiB <= 0 || i.DiskFreeMiB <= 0 || i.Virt.Detail == "" {
		t.Errorf("%+v", i)
	}
}
