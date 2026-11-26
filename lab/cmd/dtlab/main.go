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
	"errors"
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
	"github.com/damn-academy/devops-trainer/lab/internal/say"
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
  dtlab destroy [--yes]           delete the VMs and their disks (asks first); downloads stay
  dtlab uninstall [--yes]         remove everything the lab ever added, dtlab included
  dtlab install                   put dtlab on your PATH, with completion

Everything lives in %s.
`

const usageRU = `dtlab — лаборатория курса DevOps на вашем компьютере

  dtlab courses                   курсы, которые можно поставить, и их обновления
  dtlab course install <id>...     поставить курсы и нужные им пакеты
  dtlab course update              обновить поставленные курсы и пакеты
  dtlab course remove <id>         удалить курс или пакет
  dtlab check                     что потянет этот компьютер и какой профиль выбрать
  dtlab up [--profile light|standard|full] [--with learner,kuberoot,kubeadm-nodes]
           [--kuberoot-version 1.2.3|latest] [--kuberoot <url|папка>]
                                  создать и запустить машины лаборатории (повторно: запустить)
  dtlab status                    машины, их адреса и работают ли они
  dtlab ssh <машина> [команда]    терминал на машине (learner, cp-1, worker-1…)
  dtlab facts <машина> [флаги]    выполнить на машине проверку экзамена и напечатать блок
  dtlab serve [--course web/dist] курс и API лаборатории на http://127.0.0.1:7788/
  dtlab down                      остановить машины; диски и ваша работа остаются
  dtlab destroy [--yes]           удалить машины и их диски (сначала спросит); скачанное остаётся
  dtlab uninstall [--yes]         удалить всё, что лаборатория добавила, вместе с самой dtlab
  dtlab install                   добавить dtlab в PATH с автодополнением команд

Всё хранится в %s.
`

// printUsage prints the command list in the learner's language.
func printUsage(w io.Writer) {
	if say.Russian() {
		fmt.Fprintf(w, usageRU, paths.Root())
		return
	}
	fmt.Fprintf(w, usage, paths.Root())
}

func main() {
	if len(os.Args) < 2 {
		printUsage(os.Stdout)
		os.Exit(2)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	l, err := lab.Open(paths.Root())
	if err != nil {
		fatal(err)
	}
	ru := say.Russian()
	l.Log = func(f string, a ...any) { fmt.Println(say.T(ru, fmt.Sprintf(f, a...))) }
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
		err = downCmd(ctx, l, args, os.Stdout)
	case "destroy":
		err = destroyCmd(ctx, l, args, os.Stdin, os.Stdout)
	case "uninstall":
		err = uninstallCmd(ctx, l, args)
	case "install":
		home, _ := os.UserHomeDir()
		err = l.Install(ctx, home, os.Getenv("SHELL"))
	case "version", "--version":
		fmt.Println("dtlab", version)
	case "help", "-h", "--help":
		printUsage(os.Stdout)
	default:
		if ru {
			fmt.Fprintf(os.Stderr, "dtlab: команды %q нет\n\n", cmd)
		} else {
			fmt.Fprintf(os.Stderr, "dtlab: unknown command %q\n\n", cmd)
		}
		printUsage(os.Stdout)
		os.Exit(2)
	}
	if err != nil {
		fatal(err)
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "dtlab:", say.T(say.Russian(), err.Error()))
	os.Exit(1)
}

// commandFlags makes the flag set of a command whose -h and --help print
// help and do nothing else.
// The flag package's own English error lines are not printed: parseCommand
// returns them as an error, which dtlab prints once in the learner's language.
func commandFlags(name, help string, out io.Writer) *flag.FlagSet {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.Usage = func() {
		fmt.Fprintln(out, help)
		printFlags(fs, out, say.Russian())
	}
	return fs
}

// printFlags lists the flags as flag.PrintDefaults does, with the defaults
// named in the learner's language.
func printFlags(fs *flag.FlagSet, out io.Writer, ru bool) {
	fs.VisitAll(func(f *flag.Flag) {
		kind, usage := flag.UnquoteUsage(f)
		line := "  -" + f.Name
		if kind != "" {
			line += " " + kind
		}
		line += "\n    \t" + strings.ReplaceAll(usage, "\n", "\n    \t")
		if def := f.DefValue; def != "" && def != "false" && def != "0" {
			if ru {
				line += fmt.Sprintf(" (по умолчанию %s)", def)
			} else {
				line += fmt.Sprintf(" (default %q)", def)
			}
		}
		fmt.Fprintln(out, line)
	})
}

// parseFlags parses args and leaves the arguments after the flags in fs.Args().
func parseFlags(fs *flag.FlagSet, args []string) (help bool, err error) {
	switch err := fs.Parse(args); {
	case errors.Is(err, flag.ErrHelp):
		return true, nil
	case err != nil:
		return false, fmt.Errorf("dtlab %s: %v", fs.Name(), err)
	}
	return false, nil
}

// parseCommand parses args; help is true when -h or --help asked for help.
// Arguments that are not flags are refused: nothing runs on a typo.
func parseCommand(fs *flag.FlagSet, args []string) (help bool, err error) {
	if help, err := parseFlags(fs, args); help || err != nil {
		return help, err
	}
	if fs.NArg() > 0 {
		fs.Usage()
		return false, fmt.Errorf("dtlab %s: unexpected argument %q", fs.Name(), fs.Arg(0))
	}
	return false, nil
}

func downCmd(ctx context.Context, l *lab.Lab, args []string, out io.Writer) error {
	ru := say.Russian()
	fs := commandFlags("down", say.T(ru, "usage: dtlab down\n\nStops the VMs and the lab agent. Their disks and your work on them stay: dtlab up carries on where you left off."), out)
	if help, err := parseCommand(fs, args); help || err != nil {
		return err
	}
	return l.Down(ctx)
}

func destroyCmd(ctx context.Context, l *lab.Lab, args []string, in io.Reader, out io.Writer) error {
	ru := say.Russian()
	fs := commandFlags("destroy", say.T(ru, "usage: dtlab destroy [--yes]\n\nDeletes the VMs, their disks and everything on them. Downloaded images stay, so the next dtlab up makes clean VMs without downloading again. Asks first; --yes does not ask."), out)
	yes := fs.Bool("yes", false, say.T(ru, "do not ask"))
	if help, err := parseCommand(fs, args); help || err != nil {
		return err
	}
	st, err := l.State()
	if err != nil {
		return err
	}
	if len(st.VMs) > 0 && !*yes {
		var names []string
		for _, v := range st.VMs {
			names = append(names, v.Name)
		}
		fmt.Fprintln(out, say.T(ru, fmt.Sprintf("dtlab destroy will delete these VMs with their disks and everything on them: %s", strings.Join(names, ", "))))
		fmt.Fprint(out, say.T(ru, "Delete them?")+" [y/N] ")
		answer, _ := bufio.NewReader(in).ReadString('\n')
		if !agreed(answer) {
			fmt.Fprintln(out, say.T(ru, "nothing removed"))
			return nil
		}
	}
	return l.Destroy(ctx)
}

// translated is every message of msgs in the learner's language.
func translated(ru bool, msgs []string) []string {
	out := make([]string, len(msgs))
	for i, m := range msgs {
		out[i] = say.T(ru, m)
	}
	return out
}

// agreed is a yes to a [y/N] question, in English or Russian.
func agreed(answer string) bool {
	switch strings.ToLower(strings.TrimSpace(answer)) {
	case "y", "yes", "д", "да":
		return true
	}
	return false
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
	ru := say.Russian()
	line := func(label, value string) {
		fmt.Printf("%-*s %s\n", labelWidth(ru), checkLabel(ru, label)+":", say.T(ru, value))
	}
	line("computer", fmt.Sprintf("%s %s (%s), %d CPUs, %s", i.OS, i.Arch, i.OSVersion, i.CPUs, i.CPUModel))
	line("memory", fmt.Sprintf("%d MiB, %d MiB free now", i.MemMiB, i.MemAvailMiB))
	line("disk", fmt.Sprintf("%.1f GiB free at %s", float64(i.DiskFreeMiB)/1024, i.DiskPath))
	line("hypervisor", i.Virt.Detail)
	if chErr == nil {
		line("backend", ch.Name+" — "+say.T(ru, ch.Reason))
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
		line("missing", strings.Join(missing, ", ")+" ("+say.T(ru, installHint(i.OS))+")")
	}
	if r.Profile == "" {
		line("profile", "none — the course in the browser alone")
	} else {
		line("profile", fmt.Sprintf("%s (fits: %s)", r.Profile, strings.Join(r.Fits, ", ")))
	}
	for _, why := range r.Reasons {
		fmt.Println(strings.Repeat(" ", labelWidth(ru)+1) + say.T(ru, why))
	}
	if r.Profile != "" {
		fmt.Println()
		line("next", "dtlab up --profile "+r.Profile)
	}
	return nil
}

// checkLabels are the Russian names of the lines of `dtlab check`.
var checkLabels = map[string]string{
	"computer": "компьютер", "memory": "память", "disk": "диск", "hypervisor": "гипервизор",
	"backend": "запуск машин", "missing": "не хватает", "profile": "профиль", "next": "дальше",
}

func checkLabel(ru bool, en string) string {
	if ru {
		return checkLabels[en]
	}
	return en
}

// labelWidth keeps the values of `dtlab check` in one column.
func labelWidth(ru bool) int {
	if ru {
		return 13
	}
	return 11
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
	ru := say.Russian()
	fs := commandFlags("up", say.T(ru, "usage: dtlab up [--profile light|standard|full] [--with parts] [flags]\n\nCreates the lab's VMs and starts them, or starts the VMs of the lab that exists, and waits until they are ready."), os.Stdout)
	prof := fs.String("profile", "", say.T(ru, "light, standard or full (default: the lab's own, or the one dtlab check recommends)"))
	with := fs.String("with", "", say.T(ru, "the parts: learner, kuberoot, kubeadm-nodes (comma list; default: the profile's)"))
	be := fs.String("backend", "auto", say.T(ru, "how to run the VMs: qemu, hyperv or auto (dtlab picks)"))
	kr := fs.String("kuberoot", "", say.T(ru, "kuberoot artifacts: URL or directory, instead of the GitHub release"))
	krv := fs.String("kuberoot-version", "latest", say.T(ru, "kuberoot release to install: a version (1.2.3) or latest"))
	course := fs.String("course", "", say.T(ru, "the built course (web/dist) to serve"))
	timeout := fs.Duration("timeout", 25*time.Minute, say.T(ru, "how long to wait for the VMs"))
	if help, err := parseCommand(fs, args); help || err != nil {
		return err
	}
	if *prof == "" {
		// A plain `dtlab up` starts the lab that exists, with its parts:
		// the profile's defaults would differ after --with and be refused.
		st, _ := l.State()
		*prof = st.Profile
		if *with == "" && len(st.VMs) > 0 {
			*with = strings.Join(st.Parts, ",")
		}
	}
	if *prof == "" {
		r := profile.Recommend(hostinfo.Detect(paths.Root()))
		if r.Profile == "" {
			return fmt.Errorf("this computer cannot run the lab: %s", strings.Join(translated(say.Russian(), r.Reasons), "; "))
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
	ru := say.Russian()
	if sv.Profile == "" {
		fmt.Println(say.T(ru, "no lab yet: dtlab check, then dtlab up"))
		return nil
	}
	words := statusWords(ru)
	fmt.Println(say.T(ru, fmt.Sprintf("profile %s, backend %s, agent %s", sv.Profile, sv.Backend, words.agent[sv.Agent])))
	w := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, words.header)
	for _, v := range sv.VMs {
		access := v.SSH
		if v.Kind == string(profile.Kuberoot) {
			access = "kubectl --kubeconfig " + l.L.Kubeconfig()
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\t%d %s\t%s\t%s\n", v.Name, v.Kind, v.IP, v.CPUs, v.MemMiB, words.mib, words.vm[v.Running], access)
	}
	w.Flush()
	if sv.Course != "" {
		fmt.Println(words.course, sv.Course)
	}
	return nil
}

type statusText struct {
	header, mib, course string
	agent, vm           map[bool]string
}

// statusWords are the words of the `dtlab status` table.
func statusWords(ru bool) statusText {
	if ru {
		return statusText{"МАШИНА\tВИД\tАДРЕС\tЯДЕР\tПАМЯТЬ\tСОСТОЯНИЕ\tВХОД", "МиБ", "курс:",
			map[bool]string{true: "работает", false: "остановлен"}, map[bool]string{true: "работает", false: "остановлена"}}
	}
	return statusText{"VM\tKIND\tADDRESS\tCPU\tMEMORY\tSTATE\tACCESS", "MiB", "course:",
		map[bool]string{true: "running", false: "stopped"}, map[bool]string{true: "running", false: "stopped"}}
}

func sshCmd(l *lab.Lab, args []string) error {
	if len(args) == 0 || args[0] == "-h" || args[0] == "--help" {
		fmt.Println(say.T(say.Russian(), "usage: dtlab ssh <vm> [command]"))
		if len(args) == 0 {
			os.Exit(2)
		}
		return nil
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
	ru := say.Russian()
	fs := commandFlags("facts", say.T(ru, "usage: dtlab facts <vm> [flags]\n\nRuns the exam's read-only check in a VM and prints the block of facts to paste on the exam page. The exam page shows the whole command with its flags."), os.Stdout)
	nonce := fs.String("nonce", "", say.T(ru, "the exam attempt's one-time code (shown on the exam page)"))
	machine := fs.String("machine", "", say.T(ru, "the exam's machine id (default: the VM's name)"))
	track := fs.String("track", "", say.T(ru, "the exam's track"))
	script := fs.String("script", "", say.T(ru, "trainer-check-host.sh or trainer-check.sh (default by VM kind)"))
	var extra multi
	fs.Var(&extra, "arg", say.T(ru, "a collector argument, as on the exam page (repeat)"))
	if len(args) == 0 || strings.HasPrefix(args[0], "-") {
		fs.Usage()
		if len(args) > 0 && (args[0] == "-h" || args[0] == "--help" || args[0] == "-help") {
			return nil
		}
		return errors.New("dtlab facts: name the VM first, for example dtlab facts learner")
	}
	vm := args[0]
	if help, err := parseFlags(fs, args[1:]); help || err != nil {
		return err
	}
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
	ru := say.Russian()
	fs := commandFlags("uninstall", say.T(ru, "usage: dtlab uninstall [--yes]\n\nRemoves everything the lab ever added to this computer: the VMs, their disks, the downloads, the settings and dtlab itself. Shows the list and asks first; --yes does not ask."), os.Stdout)
	yes := fs.Bool("yes", false, say.T(ru, "do not ask"))
	pre := fs.Bool("remove-preexisting", false, say.T(ru, "also remove things that were there before dtlab (asked otherwise)"))
	keepBin := fs.Bool("keep-binary", false, say.T(ru, "leave the dtlab program"))
	if help, err := parseCommand(fs, args); help || err != nil {
		return err
	}
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
		return agreed(s)
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
