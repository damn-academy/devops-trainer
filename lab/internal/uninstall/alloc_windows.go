//go:build windows

package uninstall

import (
	"os"
	"os/exec"
	"syscall"
)

func allocated(fi os.FileInfo) int64 { return fi.Size() }

// scheduleDelete: cmd waits for this process to end, then deletes the file.
func scheduleDelete(p string) error {
	c := exec.Command("cmd", "/C", "ping -n 3 127.0.0.1 >NUL & del /F /Q \""+p+"\"")
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000008} // DETACHED_PROCESS
	return c.Start()
}
