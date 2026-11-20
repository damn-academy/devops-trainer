package lab

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/tym83/devops-trainer/lab/internal/manifest"
)

// Commands, for completion.
var Commands = []string{"check", "up", "status", "ssh", "facts", "serve", "down", "destroy", "uninstall", "install", "version"}

// Install copies dtlab into <root>/bin, puts that directory on the PATH and
// adds completion, recording each change in the manifest.
func (lab *Lab) Install(ctx context.Context, home, shell string) error {
	if err := lab.L.Ensure(); err != nil {
		return err
	}
	if !lab.M.Has(manifest.Dir, lab.L.Root) {
		_ = lab.M.Add(manifest.Item{Kind: manifest.Dir, Path: lab.L.Root, Note: "everything of the lab"})
	}
	bin := filepath.Join(lab.L.Root, "bin")
	if err := os.MkdirAll(bin, 0o755); err != nil {
		return err
	}
	name := "dtlab"
	if lab.GOOS == "windows" {
		name += ".exe"
	}
	dst := filepath.Join(bin, name)
	if lab.Self != dst {
		if err := copyExe(lab.Self, dst); err != nil {
			return err
		}
	}
	lab.Log("dtlab copied to %s", dst)
	if lab.GOOS == "windows" {
		script := fmt.Sprintf("$p = [Environment]::GetEnvironmentVariable('Path','User'); if (-not (($p -split ';') -contains '%s')) { [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';%s'), 'User') }", bin, bin)
		if out, err := lab.R.Run(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", script); err != nil {
			return fmt.Errorf("PATH: %v: %s", err, out)
		}
		lab.Log("%s added to your user PATH (open a new terminal)", bin)
		return lab.M.Add(manifest.Item{Kind: manifest.PathEntry, Path: "windows:user-path", Line: bin})
	}
	rc, comp, compLine := rcFor(home, shell, lab.L.Root)
	if err := os.WriteFile(comp, []byte(Completion(filepath.Base(comp))), 0o644); err != nil {
		return err
	}
	for _, line := range []string{fmt.Sprintf(`export PATH="%s:$PATH" # dtlab`, bin), compLine} {
		if err := appendLine(rc, line); err != nil {
			return err
		}
		if err := lab.M.Add(manifest.Item{Kind: manifest.PathEntry, Path: rc, Line: line}); err != nil {
			return err
		}
	}
	lab.Log("PATH and completion added to %s (open a new terminal)", rc)
	return nil
}

// rcFor picks the shell's startup file and the completion file.
func rcFor(home, shell, root string) (rc, comp, line string) {
	if strings.HasSuffix(shell, "zsh") {
		comp = filepath.Join(root, "completion.zsh")
		return filepath.Join(home, ".zshrc"), comp, fmt.Sprintf(`[ -f "%s" ] && . "%s" # dtlab`, comp, comp)
	}
	comp = filepath.Join(root, "completion.bash")
	return filepath.Join(home, ".bashrc"), comp, fmt.Sprintf(`[ -f "%s" ] && . "%s" # dtlab`, comp, comp)
}

// Completion is a small completion script for bash or zsh.
func Completion(file string) string {
	words := strings.Join(Commands, " ")
	if strings.HasSuffix(file, ".zsh") {
		return "# dtlab completion (zsh)\ncompctl -k \"(" + words + ")\" dtlab\n"
	}
	return "# dtlab completion (bash)\ncomplete -W \"" + words + "\" dtlab\n"
}

func appendLine(file, line string) error {
	raw, _ := os.ReadFile(file)
	for _, l := range strings.Split(string(raw), "\n") {
		if l == line {
			return nil
		}
	}
	f, err := os.OpenFile(file, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	prefix := ""
	if len(raw) > 0 && !strings.HasSuffix(string(raw), "\n") {
		prefix = "\n"
	}
	_, err = io.WriteString(f, prefix+line+"\n")
	return err
}

func copyExe(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst+".new", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Rename(dst+".new", dst)
}
