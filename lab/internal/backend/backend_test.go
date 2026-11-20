package backend

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

type fakeRunner struct {
	runs   [][]string
	starts [][]string
	alive  map[int]bool
	out    []byte
}

func (f *fakeRunner) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	f.runs = append(f.runs, append([]string{name}, args...))
	return f.out, nil
}
func (f *fakeRunner) Start(name string, args []string, log string) (int, error) {
	f.starts = append(f.starts, append([]string{name}, args...))
	return 4242, nil
}
func (f *fakeRunner) Alive(pid int) bool { return f.alive[pid] }
func (f *fakeRunner) Kill(pid int) error { f.alive[pid] = false; return nil }

func vms() map[string]profile.VM {
	p := profile.Profiles["standard"]
	m := map[string]profile.VM{}
	for _, v := range profile.Plan(p, p.Default) {
		m[v.Name] = v
	}
	return m
}

func joined(a []string) string { return strings.Join(a, " ") }

func TestQEMUArgsLinuxUbuntu(t *testing.T) {
	q := &QEMU{GOOS: "linux", Arch: "amd64", Accel: "kvm", Bin: "qemu-system-x86_64", Firmware: Firmware{"/fw/code.fd", "/fw/vars.fd"},
		SwitchAddr: "127.0.0.1:7789", SeedURL: "http://10.10.1.254:7788/seed/", VMDir: func(n string) string { return "/lab/vms/" + n }}
	a := joined(q.Args(vms()["cp-1"], Disks{System: "/lab/vms/cp-1/disk.qcow2"}))
	for _, want := range []string{
		"-machine q35 -accel kvm -cpu host", "-smp 2 -m 2048",
		"if=pflash,format=raw,readonly=on,file=/fw/code.fd", "file=/lab/vms/cp-1/efivars.fd",
		"file=/lab/vms/cp-1/disk.qcow2,format=qcow2", "bootindex=0",
		"-netdev socket,id=lab,connect=127.0.0.1:7789", "mac=52:54:00:d7:01:0b",
		"type=1,serial=ds=nocloud;s=http://10.10.1.254:7788/seed/cp-1/",
		"-qmp tcp:127.0.0.1:7911,server=on,wait=off", "-display none",
	} {
		if !strings.Contains(a, want) {
			t.Errorf("args lack %q:\n%s", want, a)
		}
	}
	if strings.Contains(a, "media") {
		t.Error("ubuntu VM got a media disk")
	}
}

func TestQEMUArgsMacArmKuberoot(t *testing.T) {
	q := &QEMU{GOOS: "darwin", Arch: "arm64", Accel: "hvf", Firmware: Firmware{"c", "v"}, SwitchAddr: "127.0.0.1:7789", SeedURL: "http://x/seed/", VMDir: func(n string) string { return "/l/" + n }}
	a := joined(q.Args(vms()["kr-1"], Disks{System: "/l/kr-1/disk.qcow2", Media: "/l/kr-1/media.img"}))
	for _, want := range []string{"-machine virt,highmem=on -accel hvf -cpu host", "file=/l/kr-1/media.img,format=raw,if=none,id=media,snapshot=on", "drive=media,bootindex=1", "drive=sys,bootindex=0"} {
		if !strings.Contains(a, want) {
			t.Errorf("args lack %q:\n%s", want, a)
		}
	}
	if strings.Contains(a, "smbios") {
		t.Error("kuberoot takes no cloud-init seed")
	}
}

func TestQEMUArgsWindowsWHPX(t *testing.T) {
	q := &QEMU{GOOS: "windows", Arch: "amd64", Accel: "whpx", Firmware: Firmware{"c", "v"}, VMDir: func(n string) string { return n }}
	if a := joined(q.Args(vms()["learner"], Disks{System: "d"})); !strings.Contains(a, "-accel whpx,kernel-irqchip=off -cpu max") {
		t.Error(a)
	}
}

func TestQEMUStartStop(t *testing.T) {
	dir := t.TempDir()
	vars := filepath.Join(dir, "vars.fd")
	_ = os.WriteFile(vars, []byte("vars"), 0o600)
	r := &fakeRunner{alive: map[int]bool{4242: true}}
	q := &QEMU{Arch: "amd64", Accel: "kvm", Bin: "qemu-system-x86_64", Firmware: Firmware{"c", vars}, VMDir: func(n string) string { return filepath.Join(dir, n) }, R: r}
	st, err := q.Start(context.Background(), vms()["learner"], Disks{System: "d"})
	if err != nil || st.PID != 4242 || len(r.starts) != 1 || r.starts[0][0] != "qemu-system-x86_64" {
		t.Fatalf("start: %v %+v %v", err, st, r.starts)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "learner", "efivars.fd")); string(b) != "vars" {
		t.Error("UEFI variables not copied")
	}
	// No QMP listener: Stop falls back to killing the process.
	if err := q.Stop(context.Background(), vms()["learner"], st); err != nil || r.alive[4242] {
		t.Fatalf("stop: %v", err)
	}
}

func TestImgCreate(t *testing.T) {
	if got := joined(ImgCreate("qemu-img", "d.qcow2", "/c/u.img", 10)); got != "qemu-img create -q -f qcow2 -F qcow2 -b /c/u.img d.qcow2 10G" {
		t.Error(got)
	}
	if got := joined(ImgCreate("qemu-img", "s.qcow2", "", 8)); got != "qemu-img create -q -f qcow2 s.qcow2 8G" {
		t.Error(got)
	}
}

func TestChoose(t *testing.T) {
	cases := []struct {
		goos, accel string
		hv          bool
		want        string
	}{
		{"linux", "kvm", false, "qemu"}, {"darwin", "hvf", false, "qemu"},
		{"windows", "whpx", true, "qemu"}, {"windows", "", true, "hyperv"},
	}
	for _, c := range cases {
		ch, err := Choose(c.goos, c.accel, c.hv, "")
		if err != nil || ch.Name != c.want {
			t.Errorf("%+v: %+v %v", c, ch, err)
		}
	}
	if _, err := Choose("linux", "", false, ""); err == nil {
		t.Error("no hypervisor must be an error")
	}
	if _, err := Choose("darwin", "hvf", false, "hyperv"); err == nil {
		t.Error("hyper-v on macOS")
	}
}

func TestHyperVScripts(t *testing.T) {
	s := CreateScript(vms()["kr-1"], Disks{System: `C:\l\kr-1\disk.vhdx`, Media: `C:\l\kr-1\media.vhdx`}, `C:\l\kr-1`)
	for _, want := range []string{"-Generation 2", "-MemoryStartupBytes 2048MB", "-EnableSecureBoot Off", "-StaticMacAddress '525400d7011e'", "'Default Switch'", "-BootOrder $d", "Start-VM -Name 'dtlab-kr-1'"} {
		if !strings.Contains(s, want) {
			t.Errorf("create script lacks %q:\n%s", want, s)
		}
	}
	p := PrepareScript()
	for _, want := range []string{"New-VMSwitch -Name 'dtlab' -SwitchType Internal", "New-NetNat -Name 'dtlab' -InternalIPInterfaceAddressPrefix '10.10.1.0/24'", "'10.10.1.1'"} {
		if !strings.Contains(p, want) {
			t.Errorf("prepare lacks %q", want)
		}
	}
	if !strings.Contains(TeardownScript(), "Remove-VMSwitch") || !strings.Contains(SeedISOScript(`C:\s`, `C:\s.iso`), "CIDATA") {
		t.Error("teardown or seed script")
	}
	if ps("it's") != "'it''s'" {
		t.Error("quoting")
	}
}

func TestFirmwareCandidates(t *testing.T) {
	if c := FirmwareCandidates("darwin", "arm64", ""); !strings.Contains(c[0].Code, "edk2-aarch64") {
		t.Error(c)
	}
	if c := FirmwareCandidates("linux", "amd64", "/b"); c[0].Code != filepath.Join("/b", "share", "edk2-x86_64-code.fd") {
		t.Error(c)
	}
	if _, err := FindFirmware([]Firmware{{"/nope", "/nope"}}); err == nil {
		t.Error("missing firmware found")
	}
}
