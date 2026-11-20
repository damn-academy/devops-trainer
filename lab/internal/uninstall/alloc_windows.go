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
	c := exec.Command("cmd")
	// cmd does not read the \" escaping Go gives quotes in arguments, so
	// the command line is written whole.
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000008, // DETACHED_PROCESS
		CmdLine: deleteLaterCmdLine(p)}
	return c.Start()
}
