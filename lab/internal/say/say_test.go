package say

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/damn-academy/devops-trainer/lab/internal/backend"
	"github.com/damn-academy/devops-trainer/lab/internal/hostinfo"
	"github.com/damn-academy/devops-trainer/lab/internal/profile"
)

var cyrillic = regexp.MustCompile(`[а-яё]`)

func TestRussianLocale(t *testing.T) {
	cases := []struct {
		env  map[string]string
		want bool
	}{
		{map[string]string{}, false},
		{map[string]string{"LANG": "ru_RU.UTF-8"}, true},
		{map[string]string{"LANG": "en_US.UTF-8"}, false},
		{map[string]string{"LANG": "en_US.UTF-8", "LC_MESSAGES": "ru_RU.UTF-8"}, true},
		{map[string]string{"LANG": "ru_RU.UTF-8", "LC_ALL": "C"}, false},
		{map[string]string{"LC_ALL": "ru_UA.UTF-8", "LANG": "en_GB.UTF-8"}, true},
		{map[string]string{"LANG": "C.UTF-8"}, false},
	}
	for _, c := range cases {
		if got := russian(func(k string) string { return c.env[k] }); got != c.want {
			t.Errorf("%v: got %v", c.env, got)
		}
	}
}

func TestEnglishStaysEnglish(t *testing.T) {
	s := "16 GB computers: the learner VM, kuberoot and two Ubuntu nodes for kubeadm"
	if T(false, s) != s {
		t.Fatal("English output changed")
	}
	if T(true, "something dtlab never says") != "something dtlab never says" {
		t.Fatal("an unknown message must pass through")
	}
}

func TestFormattedMessages(t *testing.T) {
	got := Translate("4.5 GiB free disk at /home/olga/.dtlab is below the light profile's 10 GB: free some space, or set DTLAB_HOME to a folder on a disk with more")
	for _, want := range []string{"4,5 ГиБ", "/home/olga/.dtlab", "10 ГБ", "DTLAB_HOME"} {
		if !strings.Contains(got, want) {
			t.Errorf("%q lacks %q", got, want)
		}
	}
	if got := Translate("no usable hardware virtualisation: KVM (/dev/kvm is usable)"); got != "нет аппаратной виртуализации: KVM (/dev/kvm доступен)" {
		t.Errorf("nested message: %q", got)
	}
	if got := Translate("Hyper-V and the Windows Hypervisor Platform"); got != "Hyper-V и платформа низкоуровневой оболочки Windows" {
		t.Errorf("windows detail: %q", got)
	}
	if got := Translate("darwin arm64 (macOS 26.4), 10 CPUs, Apple M4"); got != "darwin arm64 (macOS 26.4), ядер процессора: 10, Apple M4" {
		t.Errorf("computer line: %q", got)
	}
}

// Every advice `dtlab check` can give has a Russian text.
func TestEveryCheckAdviceIsTranslated(t *testing.T) {
	var said []string
	hosts := []hostinfo.Info{
		{CPUs: 1, MemMiB: 4096, DiskFreeMiB: 2048, DiskPath: "/d", Virt: hostinfo.Virt{Accel: "kvm"}},
		{CPUs: 4, MemMiB: 8192, MemAvailMiB: 1024, DiskFreeMiB: 100 << 10, Virt: hostinfo.Virt{Accel: "hvf", Nested: true}},
		{CPUs: 4, MemMiB: 16384, DiskFreeMiB: 100 << 10, Virt: hostinfo.Virt{Accel: "kvm"}},
		{CPUs: 8, MemMiB: 32768, DiskFreeMiB: 100 << 10, Virt: hostinfo.Virt{Accel: "whpx"}},
		{CPUs: 8, MemMiB: 32768, DiskFreeMiB: 100 << 10, Virt: hostinfo.Virt{Detail: "KVM (/dev/kvm is usable)"}},
	}
	for _, i := range hosts {
		said = append(said, profile.Recommend(i).Reasons...)
	}
	for _, n := range profile.Names() {
		said = append(said, profile.Profiles[n].Note)
	}
	for _, c := range []struct {
		goos, accel string
		hyperV      bool
	}{{"linux", "kvm", false}, {"darwin", "hvf", false}, {"windows", "whpx", false}, {"windows", "", true}} {
		ch, err := backend.Choose(c.goos, c.accel, c.hyperV, "")
		if err != nil {
			t.Fatal(err)
		}
		said = append(said, ch.Reason)
	}
	for _, f := range []string{"qemu", "hyperv"} {
		ch, _ := backend.Choose("windows", "whpx", false, f)
		said = append(said, ch.Reason)
	}
	said = append(said, hostDetails(t)...)
	said = append(said, "none — the course in the browser alone", "light (fits: light)", "winget install SoftwareFreedomConservancy.QEMU, or turn on Hyper-V", "sudo apt install qemu-system-x86 qemu-utils ovmf, or your distribution's packages")
	for _, s := range said {
		if ru := Translate(s); ru == s || !cyrillic.MatchString(ru) {
			t.Errorf("no Russian for %q", s)
		}
	}
}

// hostDetails reads the hypervisor messages of every system from the
// sources of hostinfo, so a new message without a translation fails here
// on any computer, not only on the system that prints it.
func hostDetails(t *testing.T) []string {
	files, _ := filepath.Glob("../hostinfo/hostinfo_*.go")
	re := regexp.MustCompile(`i\.Virt\.Detail = ("(?:[^"\\]|\\.)*")`)
	var out []string
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range re.FindAllStringSubmatch(string(b), -1) {
			s, err := strconv.Unquote(m[1])
			if err != nil {
				t.Fatal(err)
			}
			if s != "Hyper-V" && s != "Hypervisor.framework" { // names, the same in Russian
				out = append(out, s)
			}
		}
	}
	if len(out) < 6 {
		t.Fatalf("found only %d hypervisor messages in %v", len(out), files)
	}
	return out
}

func TestCourseWords(t *testing.T) {
	for _, s := range []string{"available", "installed", "update", "No installed courses. Run: dtlab course install academy", "All installed courses are up to date."} {
		if Translate(s) == s {
			t.Errorf("no Russian for %q", s)
		}
	}
}
