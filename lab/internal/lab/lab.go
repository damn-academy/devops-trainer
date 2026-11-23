// Package lab is what the dtlab commands do: bring the VMs of a profile up,
// report on them, collect facts from them, and take them down.
package lab

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/damn-academy/devops-trainer/lab/internal/backend"
	"github.com/damn-academy/devops-trainer/lab/internal/cloudinit"
	"github.com/damn-academy/devops-trainer/lab/internal/collect"
	"github.com/damn-academy/devops-trainer/lab/internal/hostinfo"
	"github.com/damn-academy/devops-trainer/lab/internal/kuberoot"
	"github.com/damn-academy/devops-trainer/lab/internal/manifest"
	"github.com/damn-academy/devops-trainer/lab/internal/paths"
	"github.com/damn-academy/devops-trainer/lab/internal/profile"
	"github.com/damn-academy/devops-trainer/lab/internal/sshkey"
)

// Ports on the host's loopback.
const (
	AgentPort  = profile.AgentPort
	SwitchPort = 7789
)

// Lab is one lab on this computer.
type Lab struct {
	L    paths.Layout
	M    *manifest.Manifest
	R    backend.Runner
	Src  Sources
	Log  func(format string, a ...any)
	Self string // the dtlab executable, started again as the agent
	GOOS string
	Arch string
	// SSH runs ssh with stdin (replaced in tests).
	SSH func(ctx context.Context, args []string, stdin string) ([]byte, error)
	// Backend builds the backend of a state (replaced in tests).
	Backend func(st *State) (backend.Backend, error)
}

// Open loads the lab at root.
func Open(root string) (*Lab, error) {
	l := paths.New(root)
	m, err := manifest.Load(l.Manifest(), root)
	if err != nil {
		fmt.Fprintf(os.Stderr, "dtlab: the manifest is damaged (%v); continuing with an empty one\n", err)
	}
	self, _ := os.Executable()
	lab := &Lab{L: l, M: m, R: backend.Exec{}, Src: DefaultSources(), Self: self, GOOS: runtime.GOOS, Arch: runtime.GOARCH,
		Log: func(f string, a ...any) { fmt.Printf(f+"\n", a...) }}
	lab.SSH = execSSH
	lab.Backend = lab.realBackend
	return lab, nil
}

func execSSH(ctx context.Context, args []string, stdin string) ([]byte, error) {
	c := exec.CommandContext(ctx, args[0], args[1:]...)
	c.Stdin = strings.NewReader(stdin)
	var out, errb bytes.Buffer
	c.Stdout, c.Stderr = &out, &errb
	err := c.Run()
	if err != nil {
		return out.Bytes(), fmt.Errorf("%v: %s", err, strings.TrimSpace(errb.String()))
	}
	return out.Bytes(), nil
}

func (lab *Lab) qemuBins() (system, img string) {
	system = "qemu-system-x86_64"
	if lab.Arch == "arm64" {
		system = "qemu-system-aarch64"
	}
	img = "qemu-img"
	bundled := filepath.Join(lab.L.Backends(), "qemu")
	ext := ""
	if lab.GOOS == "windows" {
		ext = ".exe"
	}
	for _, d := range []string{bundled, filepath.Join(bundled, "bin")} {
		if _, err := os.Stat(filepath.Join(d, system+ext)); err == nil {
			return filepath.Join(d, system+ext), filepath.Join(d, img+ext)
		}
	}
	// PATH, then where QEMU's own installer puts it (not on PATH on Windows).
	if p, err := hostinfo.LookTool(system); err == nil {
		system = p
		if q, err := hostinfo.LookTool(img); err == nil {
			img = q
		} else if c := filepath.Join(filepath.Dir(p), img+ext); fileExists(c) {
			img = c
		}
	}
	return system, img
}

func fileExists(p string) bool { _, err := os.Stat(p); return err == nil }

func (lab *Lab) realBackend(st *State) (backend.Backend, error) {
	switch st.Backend.Name {
	case "qemu":
		bin, _ := lab.qemuBins()
		cands := backend.FirmwareCandidates(lab.GOOS, lab.Arch, filepath.Join(lab.L.Backends(), "qemu"))
		if filepath.IsAbs(bin) {
			// The firmware QEMU ships next to itself (share\ on Windows).
			cands = append(backend.FirmwareCandidates(lab.GOOS, lab.Arch, filepath.Dir(bin))[:1], cands...)
		}
		fw, err := backend.FindFirmware(cands)
		if err != nil {
			return nil, err
		}
		if v := os.Getenv("DTLAB_FIRMWARE_CODE"); v != "" {
			fw = backend.Firmware{Code: v, Vars: os.Getenv("DTLAB_FIRMWARE_VARS")}
		}
		return &backend.QEMU{GOOS: lab.GOOS, Arch: lab.Arch, Accel: st.Backend.Accel, Bin: bin, Firmware: fw,
			SwitchAddr: "127.0.0.1:" + strconv.Itoa(st.SwitchPort),
			SeedURL:    fmt.Sprintf("http://%s:%d/seed/", profile.HostIP, st.AgentPort),
			VMDir:      lab.L.VM, R: lab.R, ShutdownTimeout: 60 * time.Second}, nil
	case "hyperv":
		return &backend.HyperV{R: lab.R, VMDir: lab.L.VM}, nil
	}
	return nil, fmt.Errorf("no backend in the lab state: run `dtlab up`")
}

// State loads the lab's state.
func (lab *Lab) State() (*State, error) { return LoadState(lab.L.State()) }

// UpOptions of `dtlab up`.
type UpOptions struct {
	Profile, With, Backend string
	Kuberoot               string // artifacts URL or directory
	KuberootVersion        string // the release when Kuberoot is empty: a version or "latest"
	Course                 string // web/dist to serve
	Timeout                time.Duration
}

// Up brings the lab up and waits until every VM is usable.
func (lab *Lab) Up(ctx context.Context, o UpOptions) error {
	start := time.Now()
	_, rootErr := os.Stat(lab.L.Root)
	if err := lab.L.Ensure(); err != nil {
		return err
	}
	if !lab.M.Has(manifest.Dir, lab.L.Root) {
		if err := lab.M.Add(manifest.Item{Kind: manifest.Dir, Path: lab.L.Root, Preexisting: rootErr == nil && fileCount(lab.L.Root) > 1, Note: "everything of the lab: VMs, images, keys, state"}); err != nil {
			return err
		}
	}
	if lab.Self != "" && !lab.M.Has(manifest.Binary, lab.Self) && !strings.HasPrefix(lab.Self, lab.L.Root) && !isGoRun(lab.Self) {
		_ = lab.M.Add(manifest.Item{Kind: manifest.Binary, Path: lab.Self, Note: "the dtlab program"})
	}
	if o.Kuberoot != "" {
		lab.Src.Kuberoot = o.Kuberoot
	}
	if o.KuberootVersion != "" {
		lab.Src.KuberootVersion = o.KuberootVersion
	}
	st, err := lab.State()
	if err != nil {
		return err
	}
	p, err := profile.Get(o.Profile)
	if err != nil {
		return err
	}
	parts, err := profile.ParseWith(p, o.With)
	if err != nil {
		return err
	}
	vms := profile.Plan(p, parts)
	if len(st.VMs) > 0 && (st.Profile != p.Name || strings.Join(st.Parts, ",") != strings.Join(parts, ",")) {
		return fmt.Errorf("the lab is already %s with %s; `dtlab destroy` first to change it", st.Profile, strings.Join(st.Parts, ","))
	}
	info := hostinfo.Detect(lab.L.Root)
	choice, err := backend.Choose(lab.GOOS, info.Virt.Accel, info.Virt.HyperV, o.Backend)
	if err != nil {
		return err
	}
	_, need, disk := profile.Totals(vms)
	lab.Log("profile %s: %s; %d MiB of memory and up to %d GiB of disk for the VMs", p.Name, names(vms), need, disk)
	lab.Log("backend: %s", choice.Reason)
	if info.MemAvailMiB > 0 && info.MemAvailMiB < need {
		lab.Log("warning: %d MiB of memory are free and the VMs need %d MiB; close programs or use a smaller profile", info.MemAvailMiB, need)
	}
	st.Profile, st.Parts, st.Backend, st.Arch = p.Name, parts, choice, lab.Arch
	st.AgentPort, st.SwitchPort = AgentPort, SwitchPort
	if o.Course != "" {
		abs, _ := filepath.Abs(o.Course)
		st.CourseDir = abs
	}
	for _, v := range vms {
		if st.VM(v.Name) == nil {
			st.VMs = append(st.VMs, VMState{VM: v})
		}
	}
	if err := st.Save(lab.L.State()); err != nil {
		return err
	}
	if _, err := sshkey.Ensure(lab.L.SSHKey()); err != nil {
		return err
	}
	be, err := lab.Backend(st)
	if err != nil {
		return err
	}
	if err := be.Prepare(ctx); err != nil {
		return err
	}
	if choice.Name == "hyperv" {
		_ = lab.M.Add(manifest.Item{Kind: manifest.HyperVNet, Path: backend.HyperVSwitch})
		_ = lab.M.Add(manifest.Item{Kind: manifest.HyperVNAT, Path: backend.HyperVNAT})
		_ = lab.M.Add(manifest.Item{Kind: manifest.HyperVFW, Path: backend.HyperVFirewall})
	}
	lab.fetchKubectl(ctx)
	if err := lab.EnsureAgent(ctx, st); err != nil {
		return err
	}
	for i := range st.VMs {
		v := &st.VMs[i]
		cur, _ := be.Status(ctx, v.VM, v.Status)
		if cur.Running {
			lab.Log("%s is running", v.Name)
			continue
		}
		d, err := lab.prepareDisks(ctx, st, be, v)
		if err != nil {
			return fmt.Errorf("%s: %w", v.Name, err)
		}
		v.Disks = d
		s, err := be.Start(ctx, v.VM, d)
		if err != nil {
			return fmt.Errorf("%s: %w", v.Name, err)
		}
		v.Status = s
		kind := manifest.HostVMProc
		if choice.Name == "hyperv" {
			kind = manifest.HyperVVM
		}
		_ = lab.M.Add(manifest.Item{Kind: kind, Path: v.Name})
		if err := st.Save(lab.L.State()); err != nil {
			return err
		}
		lab.Log("%s started (%d vCPU, %d MiB, %s)", v.Name, v.CPUs, v.MemMiB, v.IP)
	}
	timeout := o.Timeout
	if timeout == 0 {
		timeout = 20 * time.Minute
	}
	wctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	for i := range st.VMs {
		v := &st.VMs[i]
		t := time.Now()
		if err := lab.waitVM(wctx, st, v); err != nil {
			return fmt.Errorf("%s: %w", v.Name, err)
		}
		st.keepStatus(lab.State)
		_ = st.Save(lab.L.State())
		lab.Log("%s ready (%s)", v.Name, time.Since(t).Round(time.Second))
	}
	lab.Log("lab up in %s; the course: http://127.0.0.1:%d/", time.Since(start).Round(time.Second), st.AgentPort)
	return nil
}

func isGoRun(p string) bool { return strings.Contains(p, "go-build") }

func fileCount(dir string) int {
	e, _ := os.ReadDir(dir)
	return len(e)
}

func names(vms []profile.VM) string {
	var n []string
	for _, v := range vms {
		n = append(n, v.Name)
	}
	return strings.Join(n, ", ")
}

// fetchKubectl caches kubectl for the learner VM, so the learner VM gets it
// from the agent and the lab comes up again offline.
func (lab *Lab) fetchKubectl(ctx context.Context) {
	dst := filepath.Join(lab.L.Files(), "kubectl-linux-"+lab.Arch)
	if _, err := os.Stat(dst); err == nil {
		return
	}
	c, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	ver, err := httpGet(c, lab.Src.Kubectl+"stable.txt")
	if err != nil {
		lab.Log("kubectl not cached (%v); the learner VM will download it itself", err)
		return
	}
	url := lab.Src.Kubectl + strings.TrimSpace(ver) + "/bin/linux/" + lab.Arch + "/kubectl"
	sum, _ := httpGet(c, url+".sha256")
	if err := fetch(c, url, dst, strings.TrimSpace(sum), lab.Log); err != nil {
		lab.Log("kubectl not cached: %v", err)
		return
	}
	_ = os.Chmod(dst, 0o755)
}

func (lab *Lab) prepareDisks(ctx context.Context, st *State, be backend.Backend, v *VMState) (backend.Disks, error) {
	dir := lab.L.VM(v.Name)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return backend.Disks{}, err
	}
	_, qemuImg := lab.qemuBins()
	ext := be.DiskFormat()
	sys := filepath.Join(dir, "disk."+ext)
	d := backend.Disks{System: sys}
	switch v.Kind {
	case profile.Kuberoot:
		media, err := lab.kuberootMedia(ctx, st, v)
		if err != nil {
			return d, err
		}
		d.Media = media
		if _, err := os.Stat(sys); os.IsNotExist(err) {
			if out, err := lab.R.Run(ctx, qemuImg, imgCreateArgs(sys, "", v.DiskGiB, ext)...); err != nil {
				return d, fmt.Errorf("system disk: %v: %s", err, out)
			}
			if err := unsparse(sys, ext); err != nil {
				return d, err
			}
		}
	default:
		hv := st.Backend.Name == "hyperv"
		name := UbuntuImage(lab.Arch, hv)
		base := filepath.Join(lab.L.Images(), name)
		if _, err := os.Stat(base); os.IsNotExist(err) {
			src := lab.Src.ubuntuBase(hv)
			sum, err := sumFor(ctx, joinURL(src, "SHA256SUMS"), name)
			if err != nil && strings.Contains(src, "://") {
				return d, fmt.Errorf("Ubuntu image checksum: %w", err)
			}
			if err := fetch(ctx, joinURL(src, name), base, sum, lab.Log); err != nil {
				return d, err
			}
		}
		if _, err := os.Stat(sys); os.IsNotExist(err) {
			if out, err := lab.R.Run(ctx, qemuImg, imgCreateArgs(sys, base, v.DiskGiB, ext)...); err != nil {
				return d, fmt.Errorf("system disk: %v: %s", err, out)
			}
			if err := unsparse(sys, ext); err != nil {
				return d, err
			}
		}
		if hv {
			iso, err := lab.seedISO(ctx, st, v.VM)
			if err != nil {
				return d, err
			}
			d.Seed = iso
		}
	}
	return d, nil
}

// unsparse: Hyper-V attaches no sparse VHDX, and qemu-img writes them
// sparse on Windows.
func unsparse(disk, format string) error {
	if format != "vhdx" {
		return nil
	}
	if err := backend.Unsparse(disk); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("%s: clearing the sparse attribute Hyper-V refuses: %w", disk, err)
	}
	return nil
}

// imgCreateArgs: an overlay on the cached image (QEMU), or a full copy
// (Hyper-V cannot read qcow2 backing files).
func imgCreateArgs(disk, base string, sizeGiB int, format string) []string {
	if format == "vhdx" {
		if base == "" {
			return []string{"create", "-q", "-f", "vhdx", disk, strconv.Itoa(sizeGiB) + "G"}
		}
		return []string{"convert", "-q", "-O", "vhdx", base, disk}
	}
	return backend.ImgCreate("qemu-img", disk, base, sizeGiB)[1:]
}

// kuberootMedia writes the node's boot media with the lab's own trust
// directory, so only this lab's credentials reach the node API.
func (lab *Lab) kuberootMedia(ctx context.Context, st *State, v *VMState) (string, error) {
	media := filepath.Join(lab.L.VM(v.Name), "media.img")
	if _, err := os.Stat(media); err == nil {
		return media, nil
	}
	art, mkPath, err := lab.kuberootArtifacts(ctx)
	if err != nil {
		return "", err
	}
	version, _ := os.ReadFile(filepath.Join(art, "VERSION"))
	// No kernel arguments: on both backends the lab's DHCP gives the node
	// its address, the router and resolvers.
	args := ""
	raw := filepath.Join(lab.L.VM(v.Name), "media.raw.img")
	cmd := kuberoot.MkimageArgs(mkPath, lab.Arch, art, strings.TrimSpace(string(version)), lab.L.Trust(), raw, args)
	if out, err := lab.R.Run(ctx, cmd[0], cmd[1:]...); err != nil {
		return "", fmt.Errorf("mkimage: %v: %s", err, out)
	}
	if st.Backend.Name == "hyperv" {
		vhdx := filepath.Join(lab.L.VM(v.Name), "media.vhdx")
		_, qemuImg := lab.qemuBins()
		if out, err := lab.R.Run(ctx, qemuImg, "convert", "-q", "-O", "vhdx", raw, vhdx); err != nil {
			return "", fmt.Errorf("media to VHDX: %v: %s", err, out)
		}
		if err := unsparse(vhdx, "vhdx"); err != nil {
			return "", err
		}
		_ = os.Remove(raw)
		return vhdx, nil
	}
	return media, os.Rename(raw, media)
}

func (lab *Lab) seedISO(ctx context.Context, st *State, vm profile.VM) (string, error) {
	seed, err := lab.Seed(st, vm, true)
	if err != nil {
		return "", err
	}
	dir := filepath.Join(lab.L.VM(vm.Name), "seed")
	_ = os.MkdirAll(dir, 0o700)
	for name, body := range map[string]string{"meta-data": seed.MetaData, "user-data": seed.UserData, "network-config": seed.NetworkConfig} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600); err != nil {
			return "", err
		}
	}
	iso := filepath.Join(lab.L.VM(vm.Name), "seed.iso")
	_, err = lab.R.Run(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", backend.SeedISOScript(dir, iso))
	return iso, err
}

// Seed builds a VM's cloud-init seed.
func (lab *Lab) Seed(st *State, vm profile.VM, static bool) (cloudinit.Seed, error) {
	pub, err := os.ReadFile(lab.L.SSHKey() + ".pub")
	if err != nil {
		return cloudinit.Seed{}, err
	}
	o := cloudinit.Options{SSHPublicKey: string(pub), Static: static, Peers: st.Plain(), Arch: st.Arch,
		AgentURL: fmt.Sprintf("http://%s:%d", profile.HostIP, st.AgentPort)}
	if static {
		o.DNS = []string{"1.1.1.1", "8.8.8.8"}
	}
	return cloudinit.For(vm, o)
}

func (lab *Lab) waitVM(ctx context.Context, st *State, v *VMState) error {
	if v.Kind == profile.Kuberoot {
		return lab.waitKuberoot(ctx, st, v)
	}
	return poll(ctx, 5*time.Second, func() error {
		_, err := lab.Exec(ctx, v.Name, false, "cloud-init status --wait >/dev/null 2>&1; test -f /var/lib/cloud/instance/boot-finished && echo ok")
		return err
	})
}

func (lab *Lab) nodeClient(st *State, v *VMState) (*kuberoot.Client, error) {
	a, err := kuberoot.LoadAdmin(lab.L.Trust())
	if err != nil {
		return nil, err
	}
	host, port := reach(st, v.VM, 50000)
	return kuberoot.NewClient("https://"+net.JoinHostPort(host, strconv.Itoa(port)), a)
}

// reach is where the host finds a VM's port: the port the lab switch
// publishes on loopback with QEMU, the VM's own address on Hyper-V, whose
// internal switch gives the host an address on the lab network.
func reach(st *State, v profile.VM, guest int) (string, int) {
	if st.Backend.Name == "hyperv" {
		return v.IP, guest
	}
	switch guest {
	case 22:
		return "127.0.0.1", v.SSHPort
	case 50000:
		return "127.0.0.1", nodeAPIPort(v)
	case 6443:
		return "127.0.0.1", apiPort(v)
	}
	return "127.0.0.1", guest
}

// sshArgs is the ssh command to a VM wherever the backend puts it.
func (lab *Lab) sshArgs(st *State, v profile.VM, tty bool, command ...string) ([]string, error) {
	if v.SSHPort <= 0 {
		return sshkey.Args("", "", "", "", 0, false)
	}
	host, port := reach(st, v, 22)
	return sshkey.Args(lab.L.SSHKey(), lab.L.KnownHosts(), cloudinit.User, host, port, tty, command...)
}

func nodeAPIPort(v profile.VM) int {
	for _, f := range v.Forwards {
		if f.Guest == 50000 {
			return f.Host
		}
	}
	return 50000
}

func apiPort(v profile.VM) int {
	for _, f := range v.Forwards {
		if f.Guest == 6443 {
			return f.Host
		}
	}
	return 6443
}

// waitKuberoot: the live media's node API, then the installation onto the
// system disk, the installed slot Good, and the cluster's kubeconfig.
func (lab *Lab) waitKuberoot(ctx context.Context, st *State, v *VMState) error {
	c, err := lab.nodeClient(st, v)
	if err != nil {
		return err
	}
	if err := poll(ctx, 5*time.Second, func() error { return c.Ready(ctx) }); err != nil {
		return fmt.Errorf("node API: %w", err)
	}
	entries, err := c.BootEntries(ctx)
	if err != nil {
		return err
	}
	if !kuberoot.Installed(entries) {
		lab.Log("%s: installing kuberoot onto its system disk", v.Name)
		if err := c.Install(ctx, installDisk(st.Backend.Name)); err != nil {
			return err
		}
		if err := poll(ctx, 5*time.Second, func() error {
			e, err := c.BootEntries(ctx)
			if err != nil {
				return err
			}
			if !kuberoot.Installed(e) {
				return errors.New("not installed yet")
			}
			return nil
		}); err != nil {
			return fmt.Errorf("installation: %w", err)
		}
	}
	v.Installed = true
	var kc string
	if err := poll(ctx, 5*time.Second, func() error {
		var err error
		kc, err = c.Kubeconfig(ctx)
		return err
	}); err != nil {
		return err
	}
	apiHost, apiP := reach(st, v.VM, 6443)
	tlsName := v.IP
	if apiHost == v.IP {
		tlsName = ""
	}
	host := kuberoot.RewriteServer(kc, "https://"+net.JoinHostPort(apiHost, strconv.Itoa(apiP)), tlsName)
	if err := os.WriteFile(lab.L.Kubeconfig(), []byte(host), 0o600); err != nil {
		return err
	}
	lab.Log("%s: cluster kubeconfig at %s", v.Name, lab.L.Kubeconfig())
	if l := st.VM("learner"); l != nil {
		in := kuberoot.RewriteServer(kc, "https://"+v.IP+":6443", "")
		if _, err := lab.ExecStdin(ctx, "learner", "mkdir -p ~/.kube && umask 077 && cat > ~/.kube/config", in); err != nil {
			lab.Log("could not give the learner VM the kubeconfig: %v", err)
		}
	}
	return nil
}

func poll(ctx context.Context, every time.Duration, f func() error) error {
	var last error
	for {
		if last = f(); last == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("%w (last: %v)", ctx.Err(), last)
		case <-time.After(every):
		}
	}
}

// Exec runs a command in a VM over SSH.
func (lab *Lab) Exec(ctx context.Context, vm string, tty bool, command string) ([]byte, error) {
	return lab.ExecStdin(ctx, vm, command, "")
}

// ExecStdin runs a command in a VM with stdin.
func (lab *Lab) ExecStdin(ctx context.Context, vm, command, stdin string) ([]byte, error) {
	st, err := lab.State()
	if err != nil {
		return nil, err
	}
	v := st.VM(vm)
	if v == nil {
		return nil, fmt.Errorf("no VM %q in the lab", vm)
	}
	args, err := lab.sshArgs(st, v.VM, false, command)
	if err != nil {
		return nil, err
	}
	return lab.SSH(ctx, args, stdin)
}

// SSHArgs is the interactive ssh command of `dtlab ssh`.
func (lab *Lab) SSHArgs(vm string, command []string) ([]string, error) {
	st, err := lab.State()
	if err != nil {
		return nil, err
	}
	v := st.VM(vm)
	if v == nil {
		return nil, fmt.Errorf("no VM %q in the lab (dtlab status)", vm)
	}
	if v.Kind == profile.Kuberoot {
		return nil, fmt.Errorf("%s is kuberoot: it has no shell; use kubectl --kubeconfig %s", vm, lab.L.Kubeconfig())
	}
	return lab.sshArgs(st, v.VM, len(command) == 0, command...)
}

// Facts runs a check script for a VM and returns the block. Defaults by
// kind: the learner VM gets the host check; a kubeadm node the cluster
// check with --machine as root with kubeadm's admin.conf; kuberoot the
// cluster check, run from the learner VM with its kubeconfig.
func (lab *Lab) Facts(ctx context.Context, vm string, r collect.Request) (string, error) {
	st, err := lab.State()
	if err != nil {
		return "", err
	}
	v := st.VM(vm)
	if v == nil {
		return "", fmt.Errorf("no VM %q in the lab", vm)
	}
	on := vm
	switch v.Kind {
	case profile.Learner:
		if r.Script == "" {
			r.Script = collect.Host
		}
		r.Sudo = true
	case profile.Kubeadm:
		if r.Script == "" {
			r.Script = collect.K8s
		}
		r.Sudo = true
		if r.Script == collect.K8s || r.Script == "k8s" {
			r.Kubeconfig = "/etc/kubernetes/admin.conf"
			if r.Track == "" {
				r.Track = "k8s-2"
			}
		}
	case profile.Kuberoot:
		if st.VM("learner") == nil {
			return "", errors.New("facts of kuberoot are collected from the learner VM, which is not in this lab")
		}
		on = "learner"
		r.Script = collect.K8s
		r.Machine = ""
		r.Kubeconfig = "/home/" + cloudinit.User + "/.kube/config"
		if r.Track == "" {
			r.Track = "r1"
		}
	}
	if r.Machine == "" && v.Kind != profile.Kuberoot {
		r.Machine = vm
	}
	if r.Nonce == "" {
		r.Nonce = "local"
	}
	if err := r.Validate(); err != nil {
		return "", err
	}
	text, _ := collect.ScriptText(r.Script)
	out, err := lab.ExecStdin(ctx, on, r.RemoteCommand(), text)
	if err != nil {
		return "", err
	}
	return collect.Block(string(out))
}

// VMView is one row of `dtlab status`.
type VMView struct {
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	IP      string `json:"ip"`
	Running bool   `json:"running"`
	SSH     string `json:"ssh,omitempty"`
	MemMiB  int    `json:"memMiB"`
	CPUs    int    `json:"cpus"`
}

// StatusView is `dtlab status` and GET /api/v1/status.
type StatusView struct {
	Profile    string   `json:"profile"`
	Backend    string   `json:"backend"`
	Agent      bool     `json:"agent"`
	Course     string   `json:"course,omitempty"`
	Kubeconfig string   `json:"kubeconfig,omitempty"`
	VMs        []VMView `json:"vms"`
}

// Status reports the lab.
func (lab *Lab) Status(ctx context.Context) (StatusView, error) {
	st, err := lab.State()
	if err != nil {
		return StatusView{}, err
	}
	sv := StatusView{Profile: st.Profile, Backend: st.Backend.Name, Agent: portOpen(st.AgentPort)}
	if sv.Agent {
		sv.Course = fmt.Sprintf("http://127.0.0.1:%d/", st.AgentPort)
	}
	if _, err := os.Stat(lab.L.Kubeconfig()); err == nil {
		sv.Kubeconfig = lab.L.Kubeconfig()
	}
	var be backend.Backend
	if st.Backend.Name != "" {
		be, _ = lab.Backend(st)
	}
	for _, v := range st.VMs {
		view := VMView{Name: v.Name, Kind: string(v.Kind), IP: v.IP, MemMiB: v.MemMiB, CPUs: v.CPUs}
		if be != nil {
			s, _ := be.Status(ctx, v.VM, v.Status)
			view.Running = s.Running
		}
		if v.SSHPort > 0 {
			view.SSH = "dtlab ssh " + v.Name
		}
		sv.VMs = append(sv.VMs, view)
	}
	return sv, nil
}

func portOpen(port int) bool {
	if port == 0 {
		return false
	}
	c, err := net.DialTimeout("tcp", "127.0.0.1:"+strconv.Itoa(port), 500*time.Millisecond)
	if err != nil {
		return false
	}
	c.Close()
	return true
}

// EnsureAgent starts `dtlab agent` in the background unless it runs.
func (lab *Lab) EnsureAgent(ctx context.Context, st *State) error {
	if portOpen(st.AgentPort) {
		return nil
	}
	pid, err := lab.R.Start(lab.Self, []string{"agent"}, filepath.Join(lab.L.Logs(), "agent.log"))
	if err != nil {
		return fmt.Errorf("agent: %w", err)
	}
	st.AgentPID = pid
	_ = os.WriteFile(lab.L.AgentPID(), []byte(strconv.Itoa(pid)), 0o600)
	if err := st.Save(lab.L.State()); err != nil {
		return err
	}
	c, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	return poll(c, 300*time.Millisecond, func() error {
		if !portOpen(st.AgentPort) {
			return errors.New("agent not listening")
		}
		return nil
	})
}

// Down stops every VM and the agent; disks stay.
func (lab *Lab) Down(ctx context.Context) error {
	st, err := lab.State()
	if err != nil {
		return err
	}
	if st.Backend.Name != "" {
		be, err := lab.Backend(st)
		if err != nil {
			return err
		}
		for i := range st.VMs {
			v := &st.VMs[i]
			if err := be.Stop(ctx, v.VM, v.Status); err != nil {
				lab.Log("%s: %v", v.Name, err)
			}
			v.Status = backend.Status{}
			lab.Log("%s stopped", v.Name)
		}
	}
	if st.AgentPID != 0 && lab.R.Alive(st.AgentPID) {
		_ = lab.R.Kill(st.AgentPID)
		lab.Log("agent stopped")
	}
	st.AgentPID = 0
	_ = os.Remove(lab.L.AgentPID())
	return st.Save(lab.L.State())
}

// Destroy stops and deletes the VMs and their disks, the lab's kuberoot
// credentials and its host network; downloaded images stay for next time.
func (lab *Lab) Destroy(ctx context.Context) error {
	if err := lab.Down(ctx); err != nil {
		return err
	}
	st, err := lab.State()
	if err != nil {
		return err
	}
	if st.Backend.Name != "" {
		be, err := lab.Backend(st)
		if err != nil {
			return err
		}
		for _, v := range st.VMs {
			if err := be.Remove(ctx, v.VM); err != nil {
				lab.Log("%s: %v", v.Name, err)
			}
			_ = lab.M.Forget(manifest.Item{Kind: manifest.HostVMProc, Path: v.Name})
			_ = lab.M.Forget(manifest.Item{Kind: manifest.HyperVVM, Path: v.Name})
		}
		if err := be.Teardown(ctx); err != nil {
			lab.Log("network: %v", err)
		}
		_ = lab.M.Forget(manifest.Item{Kind: manifest.HyperVNAT, Path: backend.HyperVNAT})
		_ = lab.M.Forget(manifest.Item{Kind: manifest.HyperVNet, Path: backend.HyperVSwitch})
	}
	for _, p := range []string{lab.L.VMs(), lab.L.Trust(), lab.L.Kubeconfig(), lab.L.KnownHosts()} {
		if err := os.RemoveAll(p); err != nil {
			return err
		}
	}
	lab.Log("VMs, their disks and the kuberoot credentials removed; images stay in %s", lab.L.Images())
	return (&State{}).Save(lab.L.State())
}
