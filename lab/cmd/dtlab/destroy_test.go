package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/damn-academy/devops-trainer/lab/internal/lab"
	"github.com/damn-academy/devops-trainer/lab/internal/profile"
	"github.com/damn-academy/devops-trainer/lab/internal/say"
)

// testLab is a lab with two VMs in its state and a disk on the host; it
// has no backend, so destroy only removes the files.
func testLab(t *testing.T) (*lab.Lab, string, *bytes.Buffer) {
	t.Helper()
	t.Setenv("LC_ALL", "C")
	l, err := lab.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	var log bytes.Buffer
	l.Log = func(f string, a ...any) { fmt.Fprintf(&log, f+"\n", a...) }
	st := &lab.State{Profile: "light", VMs: []lab.VMState{{VM: profile.VM{Name: "learner"}}, {VM: profile.VM{Name: "cp-1"}}}}
	if err := os.MkdirAll(l.L.Root, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := st.Save(l.L.State()); err != nil {
		t.Fatal(err)
	}
	disk := filepath.Join(l.L.VM("cp-1"), "disk.qcow2")
	if err := os.MkdirAll(filepath.Dir(disk), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(disk, []byte("d"), 0o600); err != nil {
		t.Fatal(err)
	}
	return l, disk, &log
}

func exists(p string) bool { _, err := os.Stat(p); return err == nil }

func TestDestroyHelpRemovesNothing(t *testing.T) {
	for _, h := range []string{"-h", "--help", "-help"} {
		l, disk, _ := testLab(t)
		var out bytes.Buffer
		if err := destroyCmd(context.Background(), l, []string{h}, strings.NewReader("y\n"), &out); err != nil {
			t.Fatal(h, err)
		}
		if !exists(disk) {
			t.Errorf("dtlab destroy %s removed the disk", h)
		}
		if !strings.Contains(out.String(), "usage: dtlab destroy [--yes]") || !strings.Contains(out.String(), "-yes") {
			t.Errorf("dtlab destroy %s printed no help:\n%s", h, out.String())
		}
	}
}

func TestDestroyRefusesUnknownArguments(t *testing.T) {
	for _, a := range [][]string{{"--force"}, {"cp-1"}} {
		l, disk, _ := testLab(t)
		var out bytes.Buffer
		if err := destroyCmd(context.Background(), l, a, strings.NewReader("y\n"), &out); err == nil {
			t.Errorf("dtlab destroy %v ran", a)
		}
		if !exists(disk) {
			t.Errorf("dtlab destroy %v removed the disk", a)
		}
	}
}

func TestDestroyAsks(t *testing.T) {
	for _, answer := range []string{"", "n\n", "no\n"} {
		l, disk, log := testLab(t)
		var out bytes.Buffer
		if err := destroyCmd(context.Background(), l, nil, strings.NewReader(answer), &out); err != nil {
			t.Fatal(err)
		}
		if !exists(disk) || strings.Contains(log.String(), "removed") {
			t.Errorf("answer %q removed the VMs", answer)
		}
		if !strings.Contains(out.String(), "learner, cp-1") || !strings.Contains(out.String(), "[y/N]") || !strings.Contains(out.String(), "nothing removed") {
			t.Errorf("answer %q:\n%s", answer, out.String())
		}
	}
	for _, c := range []struct {
		args   []string
		answer string
	}{{nil, "y\n"}, {nil, "да\n"}, {[]string{"--yes"}, ""}} {
		l, disk, log := testLab(t)
		var out bytes.Buffer
		if err := destroyCmd(context.Background(), l, c.args, strings.NewReader(c.answer), &out); err != nil {
			t.Fatal(err)
		}
		if exists(disk) {
			t.Errorf("%v %q kept the disk", c.args, c.answer)
		}
		// The exams' cleanup (DTLAB_CLEANUP in web/src/app/real/facts.ts) accepts this line.
		if !strings.Contains(log.String(), "VMs, their disks and the kuberoot credentials removed") {
			t.Errorf("%v %q: %s", c.args, c.answer, log.String())
		}
		if len(c.args) > 0 && strings.Contains(out.String(), "[y/N]") {
			t.Error("--yes asked")
		}
	}
}

func TestDownHelpAndArguments(t *testing.T) {
	l, _, log := testLab(t)
	var out bytes.Buffer
	if err := downCmd(context.Background(), l, []string{"--help"}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "usage: dtlab down") {
		t.Errorf("no help: %s", out.String())
	}
	if err := downCmd(context.Background(), l, []string{"now"}, &out); err == nil {
		t.Error("dtlab down now ran")
	}
	if strings.Contains(log.String(), "stopped") {
		t.Errorf("help or a wrong argument stopped the VMs: %s", log.String())
	}
}

func TestRussianDestroyPrompt(t *testing.T) {
	l, disk, _ := testLab(t)
	t.Setenv("LC_ALL", "ru_RU.UTF-8")
	var out bytes.Buffer
	if err := destroyCmd(context.Background(), l, nil, strings.NewReader("\n"), &out); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"dtlab destroy удалит эти машины", "learner, cp-1", "Удалить их? [y/N]", "ничего не удалено"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("lacks %q:\n%s", want, out.String())
		}
	}
	if !exists(disk) {
		t.Error("disk removed")
	}
	out.Reset()
	_ = destroyCmd(context.Background(), l, []string{"--help"}, nil, &out)
	if !strings.Contains(out.String(), "как вызывать: dtlab destroy [--yes]") || !strings.Contains(out.String(), "не спрашивать подтверждения") {
		t.Errorf("Russian help:\n%s", out.String())
	}
}

func TestUnknownFlagPrintsNoPackageLine(t *testing.T) {
	l, disk, _ := testLab(t)
	var out bytes.Buffer
	err := destroyCmd(context.Background(), l, []string{"--bogus"}, strings.NewReader("y\n"), &out)
	if err == nil || !strings.Contains(err.Error(), "flag provided but not defined: --bogus") {
		t.Fatalf("dtlab destroy --bogus: %v", err)
	}
	if strings.Contains(out.String(), "flag provided") {
		t.Errorf("the flag package's own line was printed as well:\n%s", out.String())
	}
	if !exists(disk) {
		t.Error("dtlab destroy --bogus removed the disk")
	}
}

func TestRussianHelpOfUpFactsUninstall(t *testing.T) {
	t.Setenv("LC_ALL", "ru_RU.UTF-8")
	for _, name := range []string{"up", "facts", "uninstall"} {
		out := captureStdout(t, func() {
			l, _, _ := testLab(t)
			t.Setenv("LC_ALL", "ru_RU.UTF-8")
			var err error
			switch name {
			case "up":
				err = up(context.Background(), l, []string{"--help"})
			case "facts":
				err = facts(context.Background(), l, []string{"--help"})
			case "uninstall":
				err = uninstallCmd(context.Background(), l, []string{"--help"})
			}
			if err != nil {
				t.Error(name, err)
			}
		})
		if !strings.HasPrefix(out, "как вызывать: dtlab "+name) || strings.Contains(out, "(default") {
			t.Errorf("dtlab %s --help is not Russian:\n%s", name, out)
		}
		if strings.Contains(out, "dtlab check light") || strings.Contains(out, "-profile dtlab") {
			t.Errorf("dtlab %s --help names a value after a quoted word:\n%s", name, out)
		}
	}
}

func captureStdout(t *testing.T, f func()) string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	old := os.Stdout
	os.Stdout = w
	f()
	os.Stdout = old
	w.Close()
	var b bytes.Buffer
	_, _ = b.ReadFrom(r)
	return b.String()
}

func TestFlagMistakesPointToHelp(t *testing.T) {
	l, _, _ := testLab(t)
	t.Setenv("LC_ALL", "ru_RU.UTF-8")
	var err error
	out := captureStdout(t, func() { err = up(context.Background(), l, []string{"--timeout", "abc"}) })
	if out != "" {
		t.Errorf("a wrong value printed the help:\n%s", out)
	}
	var ue usageError
	if !errors.As(err, &ue) || ue.cmd != "up" {
		t.Fatalf("dtlab up --timeout abc: %v", err)
	}
	if got := say.Translate(err.Error()); got != `dtlab up: неверное значение "abc" у флага --timeout: ожидается длительность, например 30m` {
		t.Errorf("translated: %s", got)
	}
	help := captureStdout(t, func() { _ = up(context.Background(), l, []string{"--help"}) })
	if !strings.Contains(help, "  --timeout\n") || !strings.Contains(help, "(по умолчанию 25 мин)") || strings.Contains(help, "duration") || strings.Contains(help, "\n  -profile") {
		t.Errorf("help of dtlab up:\n%s", help)
	}
}

func TestRussianValueErrors(t *testing.T) {
	_, err := profile.Get("huge")
	if got := say.Translate(err.Error()); got != `профиля "huge" нет: выберите light, standard или full` {
		t.Errorf("profile: %s", got)
	}
	if got := say.Translate("Help: dtlab up --help"); got != "Справка: dtlab up --help" {
		t.Errorf("help line: %s", got)
	}
}
