//go:build !windows

package uninstall

import (
	"os"
	"syscall"
)

// allocated is what the file takes on disk: sparse disk images count by
// their blocks, not their nominal size.
func allocated(fi os.FileInfo) int64 {
	if st, ok := fi.Sys().(*syscall.Stat_t); ok {
		return int64(st.Blocks) * 512
	}
	return fi.Size()
}

func scheduleDelete(string) error { return nil }
