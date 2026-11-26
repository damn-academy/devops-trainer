// dtlab: the DevOps Trainer's local lab. It runs the course's VMs on the
// learner's own computer (a Linux machine for the Linux and Networks exams,
// Ubuntu nodes for building Kubernetes with kubeadm, and a ready kuberoot
// cluster for deploys, GitOps and monitoring), serves the course offline,
// collects exam facts from the VMs, and removes all of it with one command.
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/damn-academy/devops-trainer/lab/internal/backend"
	"github.com/damn-academy/devops-trainer/lab/internal/collect"
	"github.com/damn-academy/devops-trainer/lab/internal/courses"
	"github.com/damn-academy/devops-trainer/lab/internal/hostinfo"
	"github.com/damn-academy/devops-trainer/lab/internal/lab"
	"github.com/damn-academy/devops-trainer/lab/internal/manifest"
	"github.com/damn-academy/devops-trainer/lab/internal/paths"
	"github.com/damn-academy/devops-trainer/lab/internal/profile"
	"github.com/damn-academy/devops-trainer/lab/internal/uninstall"
)

var version = "0.1.0-dev"

const usage = `dtlab — the DevOps Trainer's local lab

  dtlab courses                   list available courses and updates
  dtlab course install <id>...     install courses and their required packs
  dtlab course update              update installed courses and packs
  dtlab course remove <id>         remove a course or pack
  dtlab check                     what this computer can run, and the profile to use
  dtlab up [--profile light|standard|full] [--with learner,kuberoot,kubeadm-nodes]
           [--kuberoot-version 1.2.3|latest] [--kuberoot <url|dir>]
                                  create and start the lab's VMs (again: start them)
  dtlab status                    the VMs, their addresses and whether they run
  dtlab ssh <vm> [command]        a shell in a VM (learner, cp-1, worker-1, ...)
  dtlab facts <vm> [flags]        run the course's read-only check in a VM, print the block
  dtlab serve [--course web/dist] the course and the lab API on http://127.0.0.1:7788/
  dtlab down                      stop the VMs; their disks and your work stay
  dtlab destroy                   delete the VMs and their disks; downloads stay
  dtlab uninstall [--yes]         remove everything the lab ever added, dtlab included
  dtlab install                   put dtlab on your PATH, with completion

Everything lives in %s.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Printf(usage, paths.Root())
		os.Exit(2)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	l, err := lab.Open(paths.Root())
	if err != nil {
		fatal(err)
	}
	cmd, args := os.Args[1], os.Args[2:]
	switch cmd {
	case "courses":
		if len(args) != 0 {
			err = fmt.Errorf("usage: dtlab courses")
		} else {
			err = courseCmd(ctx, []string{"list"})
		}
	case "course":
		err = courseCmd(ctx, args)
	case "check":
		err = check(args)
	case "up":
		err = up(ctx, l, args)
	case "status":
		err = status(ctx, l, args)
	case "ssh":
		err = sshCmd(l, args)
	case "facts":
		err = facts(ctx, l, args)
	case "serve":
		err = serve(ctx, l, args)
	case "agent":
		err = l.RunAgent(ctx, "", nil)
	case "down":
		err = l.Down(ctx)
	case "destroy":
		err = l.Destroy(ctx)
	case "uninstall":
		err = uninstallCmd(ctx, l, args)
	case "install":
		home, _ := os.UserHomeDir()
		err = l.Install(ctx, home, os.Getenv("SHELL"))
	case "version", "--version":
		fmt.Println("dtlab", version)
	case "help", "-h", "--help":
		fmt.Printf(usage, paths.Root())
	default:
		fmt.Fprintf(os.Stderr, "dtlab: unknown command %q\n\n", cmd)
		fmt.Printf(usage, paths.Root())
		os.Exit(2)
	}
	if err != nil {
		fatal(err)
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "dtlab:", err)
	os.Exit(1)
}

func check(args []string) error {
	fs := flag.NewFlagSet("check", flag.ExitOnError)
	asJSON := fs.Bool("json", false, "print JSON")
	_ = fs.Parse(args)
	i := hostinfo.Detect(paths.Root())
	r := profile.Recommend(i)
	ch, chErr := backend.Choose(i.OS, i.Virt.Accel, i.Virt.HyperV, "")
	if *asJSON {
		return json.NewEncoder(os.Stdout).Encode(map[string]any{"host": i, "recommendation": r, "backend": ch})
	}
	fmt.Printf("computer:   %s %s (%s), %d CPUs, %s\n", i.OS, i.Arch, i.OSVersion, i.CPUs, i.CPUModel)
	fmt.Printf("memory:     %d MiB, %d MiB free now\n", i.MemMiB, i.MemAvailMiB)
	fmt.Printf("disk:       %d MiB free at %s\n", i.DiskFreeMiB, i.DiskPath)
	fmt.Printf("hypervisor: %s\n", i.Virt.Detail)
	if chErr == nil {
		fmt.Printf("backend:    %s — %s\n", ch.Name, ch.Reason)
	}
	var missing []string
	if ch.Name == "qemu" {
		for _, t := range []string{qemuName(i.Arch), "qemu-img"} {
			if _, ok := i.Tools[t]; !ok {
				missing = append(missing, t)
			}
		}
	}
	if _, ok := i.Tools["ssh"]; !ok {
		missing = append(missing, "ssh")
	}
	if len(missing) > 0 {
		fmt.Printf("missing:    %s (%s)\n", strings.Join(missing, ", "), installHint(i.OS))
	}
	if r.Profile == "" {
		fmt.Println("profile:    none — the course in the browser alone")
	} else {
		fmt.Printf("profile:    %s (fits: %s)\n", r.Profile, strings.Join(r.Fits, ", "))
	}
	for _, why := range r.Reasons {
		fmt.Println("            " + why)
	}
	if r.Profile != "" {
		fmt.Printf("\nnext:       dtlab up --profile %s\n", r.Profile)
	}
	return nil
}

func qemuName(arch string) string {
	if arch == "arm64" {
		return "qemu-system-aarch64"
	}
	return "qemu-system-x86_64"
}

func installHint(goos string) string {
	switch goos {
	case "darwin":
		return "brew install qemu"
	case "windows":
		return "winget install SoftwareFreedomConservancy.QEMU, or turn on Hyper-V"
	}
	return "sudo apt install qemu-system-x86 qemu-utils ovmf, or your distribution's packages"
}

func up(ctx context.Context, l *lab.Lab, args []string) error {
	fs := flag.NewFlagSet("up", flag.ExitOnError)
	prof := fs.String("profile", "", "light, standard or full (default: what `dtlab check` recommends)")
	with := fs.String("with", "", "the parts: learner, kuberoot, kubeadm-nodes (comma list; default: the profile's)")
	be := fs.String("backend", "auto", "qemu or hyperv")
	kr := fs.String("kuberoot", "", "kuberoot artifacts: URL or directory, instead of the GitHub release")
	krv := fs.String("kuberoot-version", "latest", "kuberoot release to install: a version (1.2.3) or latest")
	course := fs.String("course", "", "the built course (web/dist) to serve")
	timeout := fs.Duration("timeout", 25*time.Minute, "how long to wait for the VMs")
	_ = fs.Parse(args)
	if *prof == "" {
		st, _ := l.State()
		*prof = st.Profile
	}
	if *prof == "" {
		r := profile.Recommend(hostinfo.Detect(paths.Root()))
		if r.Profile == "" {
			return fmt.Errorf("this computer cannot run the lab: %s", strings.Join(r.Reasons, "; "))
		}
		*prof = r.Profile
	}
	if *course != "" {
		if err := copyCourse(l, *course); err != nil {
			return err
		}
		*course = l.L.Course()
	}
	if *course == "" {
		var err error
		*course, err = courses.New(l.L.Root).Active()
		if err != nil {
			return err
		}
	}
	return l.Up(ctx, lab.UpOptions{Profile: *prof, With: *with, Backend: *be, Kuberoot: *kr, KuberootVersion: *krv, Course: *course, Timeout: *timeout})
}

// copyCourse keeps a copy of the built course in the lab root, so the lab
// serves it without the source tree and uninstall removes it with the rest.
func copyCourse(l *lab.Lab, src string) error {
	if _, err := os.Stat(filepath.Join(src, "index.html")); err != nil {
		return fmt.Errorf("%s has no index.html: build the course first (cd web && npm run build)", src)
	}
	dst := l.L.Course()
	if err := os.RemoveAll(dst + ".new"); err != nil {
		return err
	}
	err := filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		t := filepath.Join(dst+".new", rel)
		if d.IsDir() {
			return os.MkdirAll(t, 0o755)
		}
		in, err := os.Open(p)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.Create(t)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, in); err != nil {
			out.Close()
			return err
		}
		return out.Close()
	})
	if err != nil {
		return err
	}
	if err := os.RemoveAll(dst); err != nil {
		return err
	}
	return os.Rename(dst+".new", dst)
}

func status(ctx context.Context, l *lab.Lab, args []string) error {
	fs := flag.NewFlagSet("status", flag.ExitOnError)
	asJSON := fs.Bool("json", false, "print JSON")
	_ = fs.Parse(args)
	sv, err := l.Status(ctx)
	if err != nil {
		return err
	}
	if *asJSON {
		return json.NewEncoder(os.Stdout).Encode(sv)
	}
	if sv.Profile == "" {
		fmt.Println("no lab yet: dtlab check, then dtlab up")
		return nil
	}
	fmt.Printf("profile %s, backend %s, agent %s\n", sv.Profile, sv.Backend, map[bool]string{true: "running", false: "stopped"}[sv.Agent])
	w := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, "VM\tKIND\tADDRESS\tCPU\tMEMORY\tSTATE\tACCESS")
	for _, v := range sv.VMs {
		access := v.SSH
		if v.Kind == string(profile.Kuberoot) {
			access = "kubectl --kubeconfig " + l.L.Kubeconfig()
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\t%d MiB\t%s\t%s\n", v.Name, v.Kind, v.IP, v.CPUs, v.MemMiB, map[bool]string{true: "running", false: "stopped"}[v.Running], access)
	}
	w.Flush()
	if sv.Course != "" {
		fmt.Println("course:", sv.Course)
	}
	return nil
}

func sshCmd(l *lab.Lab, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: dtlab ssh <vm> [command]")
	}
	a, err := l.SSHArgs(args[0], args[1:])
	if err != nil {
		return err
	}
	c := exec.Command(a[0], a[1:]...)
	c.Stdin, c.Stdout, c.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := c.Run(); err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			os.Exit(ee.ExitCode())
		}
		return err
	}
	return nil
}

type multi []string

func (m *multi) String() string     { return strings.Join(*m, " ") }
func (m *multi) Set(v string) error { *m = append(*m, v); return nil }

func facts(ctx context.Context, l *lab.Lab, args []string) error {
	if len(args) == 0 || strings.HasPrefix(args[0], "-") {
		return fmt.Errorf("usage: dtlab facts <vm> [--nonce CODE] [--machine ID] [--track T] [--script trainer-check.sh] [--arg '--scope net'] ...")
	}
	vm := args[0]
	fs := flag.NewFlagSet("facts", flag.ExitOnError)
	nonce := fs.String("nonce", "", "the exam attempt's one-time code (shown on the exam page)")
	machine := fs.String("machine", "", "the exam's machine id (default: the VM's name)")
	track := fs.String("track", "", "the exam's track")
	script := fs.String("script", "", "trainer-check-host.sh or trainer-check.sh (default by VM kind)")
	var extra multi
	fs.Var(&extra, "arg", "a collector argument, as on the exam page (repeat)")
	_ = fs.Parse(args[1:])
	r := collect.Request{Script: *script, Nonce: *nonce, Machine: *machine, Track: *track, Args: append(extra, fs.Args()...)}
	block, err := l.Facts(ctx, vm, r)
	if err != nil {
		return err
	}
	fmt.Println(block)
	return nil
}

func serve(ctx context.Context, l *lab.Lab, args []string) error {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	course := fs.String("course", "", "the built course (web/dist); copied into the lab")
	var allow multi
	fs.Var(&allow, "allow-origin", "a hosted copy of the course allowed to call the lab API (repeat)")
	_ = fs.Parse(args)
	st, _ := l.State()
	if *course == "" {
		active, err := courses.New(l.L.Root).Active()
		if err != nil {
			return err
		}
		if active != "" {
			st.CourseDir = active
		}
	}
	if *course != "" {
		if err := copyCourse(l, *course); err != nil {
			return err
		}
		st.CourseDir = l.L.Course()
		_ = st.Save(l.L.State())
		if err := l.L.Ensure(); err != nil {
			return err
		}
		if !l.M.Has(manifest.Dir, l.L.Root) {
			_ = l.M.Add(manifest.Item{Kind: manifest.Dir, Path: l.L.Root, Note: "everything of the lab"})
		}
	}
	if st.AgentPort != 0 && st.AgentPID != 0 && l.R.Alive(st.AgentPID) {
		fmt.Printf("the lab agent already serves http://127.0.0.1:%d/ (restart it with dtlab down && dtlab up to pick up a new course)\n", st.AgentPort)
		return nil
	}
	return l.RunAgent(ctx, st.CourseDir, allow)
}

func uninstallCmd(ctx context.Context, l *lab.Lab, args []string) error {
	fs := flag.NewFlagSet("uninstall", flag.ExitOnError)
	yes := fs.Bool("yes", false, "do not ask")
	pre := fs.Bool("remove-preexisting", false, "also remove things that were there before dtlab (asked otherwise)")
	keepBin := fs.Bool("keep-binary", false, "leave the dtlab program")
	_ = fs.Parse(args)
	var probe uninstall.Prober = uninstall.NoObjects{}
	if l.GOOS == "windows" {
		probe = backend.HyperVObjects{R: l.R}
	}
	exe, _ := os.Executable()
	packageHint := uninstall.PackageHint(l.GOOS, exe)
	if packageHint != "" {
		*keepBin = true
	}
	if packageHint == "" {
		home, _ := os.UserHomeDir()
		if exe == filepath.Join(home, ".local", "bin", "dtlab") || (l.GOOS == "linux" && exe == "/usr/local/bin/dtlab") {
			if !l.M.Has(manifest.Binary, exe) {
				if err := l.M.Add(manifest.Item{Kind: manifest.Binary, Path: exe, Note: "shell installer binary"}); err != nil {
					return err
				}
			}
		}
	}
	plan := uninstall.Plan(l.M, l.L.Root, probe)
	fmt.Println("dtlab uninstall will remove:")
	fmt.Print(uninstall.Report(plan))
	in := bufio.NewReader(os.Stdin)
	ask := func(q string) bool {
		if *yes {
			return true
		}
		fmt.Print(q + " [y/N] ")
		s, _ := in.ReadString('\n')
		s = strings.ToLower(strings.TrimSpace(s))
		return s == "y" || s == "yes"
	}
	if !ask("Remove all of this?") {
		fmt.Println("nothing removed")
		return nil
	}
	removePre := *pre
	for _, e := range plan {
		if e.Ask && e.Exists && !removePre && !*yes {
			removePre = ask(fmt.Sprintf("%s %s was there before dtlab. Remove it too?", e.Item.Kind, e.Item.Path))
		}
	}
	res := uninstall.Run(ctx, plan, uninstall.Options{
		RemovePreexisting: removePre, KeepBinary: *keepBin, Prober: probe,
		StopVMs: func(ctx context.Context) error {
			st, err := l.State()
			if err != nil || st.Backend.Name == "" {
				return err
			}
			return l.DestroyForUninstall(ctx)
		},
		Log: func(f string, a ...any) { fmt.Fprintf(os.Stderr, f+"\n", a...) },
	})
	fmt.Printf("freed %s\n", uninstall.Human(res.Freed))
	if packageHint != "" {
		fmt.Println("Data removed. To remove the installed package:", packageHint)
	}
	for _, e := range res.Skipped {
		fmt.Printf("kept (was there before dtlab, or --keep-binary): %s %s\n", e.Item.Kind, e.Item.Path)
	}
	if res.Scheduled != "" {
		fmt.Printf("%s is removed a few seconds after this window closes\n", res.Scheduled)
	}
	if len(res.Leftovers) == 0 {
		fmt.Println("checked again: nothing of the lab is left")
		return nil
	}
	fmt.Println("checked again: these are still there:")
	for _, e := range res.Leftovers {
		fmt.Printf("  %s %s\n", e.Item.Kind, e.Item.Path)
	}
	return fmt.Errorf("%d leftovers", len(res.Leftovers))
}
