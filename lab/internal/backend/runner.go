package backend

import (
	"context"
	"os"
	"os/exec"
)

// Exec is the Runner that runs real commands.
type Exec struct{}

func (Exec) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

// Start runs the command in its own session, so it outlives dtlab and a
// Ctrl-C in the terminal does not reach it.
func (Exec) Start(name string, args []string, logFile string) (int, error) {
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	c := exec.Command(name, args...)
	c.Stdout, c.Stderr = f, f
	detach(c)
	if err := c.Start(); err != nil {
		return 0, err
	}
	pid := c.Process.Pid
	_ = c.Process.Release()
	return pid, nil
}

func (Exec) Alive(pid int) bool { return alive(pid) }

func (Exec) Kill(pid int) error {
	p, err := os.FindProcess(pid)
	if err != nil {
		return nil
	}
	return p.Kill()
}
