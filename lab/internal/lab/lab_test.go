package lab

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tym83/devops-trainer/lab/internal/backend"
	"github.com/tym83/devops-trainer/lab/internal/collect"
	"github.com/tym83/devops-trainer/lab/internal/manifest"
	"github.com/tym83/devops-trainer/lab/internal/paths"
	"github.com/tym83/devops-trainer/lab/internal/profile"
	"github.com/tym83/devops-trainer/lab/internal/sshkey"
)

type fakeBackend struct {
	stopped, removed []string
	torn             bool
}

func (f *fakeBackend) Name() string                   { return "fake" }
func (f *fakeBackend) DiskFormat() string             { return "qcow2" }
func (f *fakeBackend) Prepare(context.Context) error  { return nil }
func (f *fakeBackend) Teardown(context.Context) error { f.torn = true; return nil }
func (f *fakeBackend) Remove(_ context.Context, v profile.VM) error {
	f.removed = append(f.removed, v.Name)
	return nil
}
func (f *fakeBackend) Start(context.Context, profile.VM, backend.Disks) (backend.Status, error) {
	return backend.Status{Running: true, PID: 1}, nil
}
func (f *fakeBackend) Stop(_ context.Context, v profile.VM, _ backend.Status) error {
	f.stopped = append(f.stopped, v.Name)
	return nil
}
func (f *fakeBackend) Status(context.Context, profile.VM, backend.Status) (backend.Status, error) {
	return backend.Status{}, nil
}

type nopRunner struct{ runs [][]string }

func (n *nopRunner) Run(_ context.Context, name string, a ...string) ([]byte, error) {
	n.runs = append(n.runs, append([]string{name}, a...))
	return nil, nil
}
func (*nopRunner) Start(string, []string, string) (int, error) { return 1, nil }
func (*nopRunner) Alive(int) bool                              { return false }
func (*nopRunner) Kill(int) error                              { return nil }

type sshCall struct {
	args  []string
	stdin string
}

func testLab(t *testing.T) (*Lab, *fakeBackend, *[]sshCall) {
	root := t.TempDir()
	l := paths.New(root)
	_ = l.Ensure()
	m, _ := manifest.Load(l.Manifest(), root)
	fb := &fakeBackend{}
	var calls []sshCall
	lab := &Lab{L: l, M: m, R: &nopRunner{}, Log: t.Logf, GOOS: "linux", Arch: "amd64",
		SSH: func(_ context.Context, a []string, stdin string) ([]byte, error) {
			calls = append(calls, sshCall{a, stdin})
			return []byte("x\n-----BEGIN TRAINER FACTS-----\nAAAA\n-----END TRAINER FACTS-----\n"), nil
		},
		Backend: func(*State) (backend.Backend, error) { return fb, nil }}
	if _, err := sshkey.Ensure(l.SSHKey()); err != nil {
		t.Fatal(err)
	}
	p := profile.Profiles["standard"]
	st := &State{Profile: "standard", Parts: p.Default, Backend: backend.Choice{Name: "qemu"}, Arch: "amd64", AgentPort: AgentPort}
	for _, v := range profile.Plan(p, p.Default) {
		st.VMs = append(st.VMs, VMState{VM: v})
	}
	if err := st.Save(l.State()); err != nil {
		t.Fatal(err)
	}
	return lab, fb, &calls
}

func TestFactsByKind(t *testing.T) {
	lab, _, calls := testLab(t)
	ctx := context.Background()
	b, err := lab.Facts(ctx, "cp-1", collect.Request{Nonce: "abc123"})
	if err != nil || !strings.HasPrefix(b, "-----BEGIN") {
		t.Fatal(b, err)
	}
	c := (*calls)[0]
	cmd := c.args[len(c.args)-1]
	if cmd != "sudo env KUBECONFIG=/etc/kubernetes/admin.conf bash -s -- --nonce abc123 --machine cp-1 --track k8s-2" {
		t.Error(cmd)
	}
	if !strings.Contains(strings.Join(c.args, " "), "-p 2211 ") || !strings.Contains(c.stdin, "trainer-check.sh") {
		t.Error("ssh to cp-1's port with the cluster check on stdin")
	}
	_, _ = lab.Facts(ctx, "kr-1", collect.Request{Nonce: "abc123"})
	c = (*calls)[1]
	if !strings.Contains(strings.Join(c.args, " "), "-p 2210 ") || !strings.HasSuffix(c.args[len(c.args)-1], "--nonce abc123 --track r1") {
		t.Error("kuberoot facts from the learner VM:", c.args)
	}
	_, _ = lab.Facts(ctx, "learner", collect.Request{Nonce: "abc123", Machine: "app-01", Track: "linux-disk", Args: []string{"--scope mounts"}})
	c = (*calls)[2]
	if got := c.args[len(c.args)-1]; got != "sudo bash -s -- --nonce abc123 --machine app-01 --track linux-disk --scope mounts" || !strings.Contains(c.stdin, "trainer-check-host.sh") {
		t.Error(got)
	}
	if _, err := lab.Facts(ctx, "nope", collect.Request{}); err == nil {
		t.Error("unknown VM")
	}
	if _, err := lab.SSHArgs("kr-1", nil); err == nil {
		t.Error("kuberoot has no shell")
	}
}

func TestDestroyKeepsImages(t *testing.T) {
	lab, fb, _ := testLab(t)
	img := filepath.Join(lab.L.Images(), "ubuntu.img")
	_ = os.WriteFile(img, []byte("img"), 0o600)
	_ = os.MkdirAll(lab.L.VM("cp-1"), 0o700)
	_ = os.WriteFile(filepath.Join(lab.L.VM("cp-1"), "disk.qcow2"), []byte("d"), 0o600)
	_ = lab.M.Add(manifest.Item{Kind: manifest.HostVMProc, Path: "cp-1"})
	if err := lab.Destroy(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(fb.stopped) != 4 || len(fb.removed) != 4 || !fb.torn {
		t.Errorf("stopped %v removed %v torn %v", fb.stopped, fb.removed, fb.torn)
	}
	if _, err := os.Stat(lab.L.VMs()); err == nil {
		t.Error("VM disks left")
	}
	if _, err := os.Stat(img); err != nil {
		t.Error("destroy removed the image cache")
	}
	if lab.M.Has(manifest.HostVMProc, "cp-1") {
		t.Error("manifest still lists the VM")
	}
	st, _ := lab.State()
	if len(st.VMs) != 0 {
		t.Error("state keeps VMs")
	}
}

func TestInstallRecordsChanges(t *testing.T) {
	lab, _, _ := testLab(t)
	home := t.TempDir()
	self := filepath.Join(t.TempDir(), "dtlab")
	_ = os.WriteFile(self, []byte("bin"), 0o755)
	lab.Self = self
	if err := lab.Install(context.Background(), home, "/bin/zsh"); err != nil {
		t.Fatal(err)
	}
	rc, _ := os.ReadFile(filepath.Join(home, ".zshrc"))
	if !strings.Contains(string(rc), lab.L.Root+"/bin:$PATH") || !strings.Contains(string(rc), "completion.zsh") {
		t.Error(string(rc))
	}
	n := 0
	for _, it := range lab.M.Items {
		if it.Kind == manifest.PathEntry {
			n++
		}
	}
	if n != 2 {
		t.Errorf("%d PATH entries recorded", n)
	}
	if _, err := os.Stat(filepath.Join(lab.L.Root, "bin", "dtlab")); err != nil {
		t.Error(err)
	}
}

func TestParseSums(t *testing.T) {
	s, err := ParseSums(strings.NewReader("aa *a.img\nbb *ubuntu-24.04-minimal-cloudimg-amd64.img\n"), UbuntuImage("amd64", false))
	if err != nil || s != "bb" {
		t.Error(s, err)
	}
}

func TestImgCreateArgs(t *testing.T) {
	if got := strings.Join(imgCreateArgs("d.vhdx", "b.img", 10, "vhdx"), " "); got != "convert -q -O vhdx b.img d.vhdx" {
		t.Error(got)
	}
	if got := strings.Join(imgCreateArgs("d.qcow2", "", 10, "qcow2"), " "); got != "create -q -f qcow2 d.qcow2 10G" {
		t.Error(got)
	}
}

func TestUbuntuImageForHyperV(t *testing.T) {
	src := DefaultSources()
	if UbuntuImage("amd64", true) != "ubuntu-24.04-server-cloudimg-amd64.img" || src.ubuntuBase(true) != "https://cloud-images.ubuntu.com/releases/noble/release/" {
		t.Error("Hyper-V needs the server image, whose kernel has the Hyper-V drivers:", UbuntuImage("amd64", true), src.ubuntuBase(true))
	}
	if UbuntuImage("amd64", false) != "ubuntu-24.04-minimal-cloudimg-amd64.img" || !strings.Contains(src.ubuntuBase(false), "/minimal/") {
		t.Error("QEMU keeps the minimal image")
	}
}

// Hyper-V has no lab switch publishing ports on loopback: the host reaches
// the VMs at their own addresses on the internal switch.
func TestReachByBackend(t *testing.T) {
	p := profile.Profiles["light"]
	vms := profile.Plan(p, p.Default)
	var learner, kr profile.VM
	for _, v := range vms {
		switch v.Kind {
		case profile.Learner:
			learner = v
		case profile.Kuberoot:
			kr = v
		}
	}
	q := &State{Backend: backend.Choice{Name: "qemu"}}
	if h, port := reach(q, learner, 22); h != "127.0.0.1" || port != learner.SSHPort {
		t.Error("qemu ssh:", h, port)
	}
	if h, port := reach(q, kr, 50000); h != "127.0.0.1" || port != nodeAPIPort(kr) {
		t.Error("qemu node API:", h, port)
	}
	hv := &State{Backend: backend.Choice{Name: "hyperv"}}
	if h, port := reach(hv, learner, 22); h != learner.IP || port != 22 {
		t.Error("hyperv ssh:", h, port)
	}
	if h, port := reach(hv, kr, 6443); h != kr.IP || port != 6443 {
		t.Error("hyperv API:", h, port)
	}
	l := &Lab{L: paths.New(t.TempDir())}
	a, err := l.sshArgs(hv, learner, false, "true")
	if err != nil || !strings.Contains(strings.Join(a, " "), "learner@"+learner.IP) || !strings.Contains(strings.Join(a, " "), "HostKeyAlias=dtlab-"+learner.IP) {
		t.Error(a, err)
	}
}

func TestKeepStatusFromDisk(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	disk := &State{VMs: []VMState{{VM: profile.VM{Name: "kr-1"}, Status: backend.Status{Running: true, PID: 42}}}}
	if err := disk.Save(path); err != nil {
		t.Fatal(err)
	}
	mem := &State{VMs: []VMState{{VM: profile.VM{Name: "kr-1"}, Status: backend.Status{Running: true, PID: 7}, Installed: true}}}
	mem.keepStatus(func() (*State, error) { return LoadState(path) })
	if mem.VMs[0].Status.PID != 42 || !mem.VMs[0].Installed {
		t.Errorf("%+v", mem.VMs[0])
	}
	if err := mem.Save(path); err != nil {
		t.Fatal(err)
	}
	if left, _ := filepath.Glob(path + ".*.tmp"); len(left) != 0 {
		t.Error("temporary files left:", left)
	}
}

func TestRetryBind(t *testing.T) {
	n := 0
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	retryBind(ctx, func(string, ...any) {}, "test", func() error {
		n++
		if n < 2 {
			return errors.New("tentative")
		}
		return nil
	})
	if n != 2 {
		t.Error(n)
	}
}
