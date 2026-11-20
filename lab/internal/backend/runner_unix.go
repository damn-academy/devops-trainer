//go:build !windows

package backend

import (
	"os/exec"
	"syscall"
)

func detach(c *exec.Cmd) { c.SysProcAttr = &syscall.SysProcAttr{Setsid: true} }

func alive(pid int) bool { return pid > 0 && syscall.Kill(pid, 0) == nil }
