package profile

import (
	"strings"
	"testing"

	"github.com/tym83/devops-trainer/lab/internal/hostinfo"
)

func TestPlanStandard(t *testing.T) {
	p := Profiles["standard"]
	vms := Plan(p, p.Default)
	want := map[string]string{"learner": "10.10.1.10", "cp-1": "10.10.1.11", "worker-1": "10.10.1.21", "kr-1": "10.10.1.30"}
	if len(vms) != len(want) {
		t.Fatalf("got %d VMs: %+v", len(vms), vms)
	}
	macs := map[string]bool{}
	for _, v := range vms {
		if want[v.Name] != v.IP {
			t.Errorf("%s: ip %s, want %s", v.Name, v.IP, want[v.Name])
		}
		if !strings.HasPrefix(v.MAC, "52:54:00:d7:01:") || macs[v.MAC] {
			t.Errorf("%s: bad or repeated MAC %s", v.Name, v.MAC)
		}
		macs[v.MAC] = true
		if v.Kind == Kuberoot && v.SSHPort != 0 {
			t.Errorf("kuberoot has no SSH")
		}
	}
	_, mem, _ := Totals(vms)
	if mem > 8*1024 {
		t.Errorf("standard takes %d MiB, more than half of a 16 GB host", mem)
	}
}

func TestPlanFullHasThreeKubeadmNodes(t *testing.T) {
	p := Profiles["full"]
	n := 0
	for _, v := range Plan(p, p.Default) {
		if v.Kind == Kubeadm {
			n++
		}
	}
	if n != 3 {
		t.Fatalf("full: %d kubeadm nodes, want 3 (cp-1, worker-1, worker-2)", n)
	}
}

func TestLightKubeadmFitsEightGB(t *testing.T) {
	p := Profiles["light"]
	parts, err := ParseWith(p, "kubeadm")
	if err != nil {
		t.Fatal(err)
	}
	vms := Plan(p, parts)
	_, mem, _ := Totals(vms)
	if len(vms) != 2 || mem > 4*1024 {
		t.Fatalf("light kubeadm: %d VMs, %d MiB", len(vms), mem)
	}
	if _, err := ParseWith(p, "k3s"); err == nil {
		t.Fatal("unknown part accepted")
	}
}

func TestRecommend(t *testing.T) {
	base := hostinfo.Info{CPUs: 8, DiskFreeMiB: 100 * 1024, Virt: hostinfo.Virt{Accel: "kvm"}}
	cases := []struct {
		mem  int
		want string
	}{{4096, ""}, {8 * 1024, "light"}, {16*1024 - 300, "standard"}, {32 * 1024, "full"}}
	for _, c := range cases {
		i := base
		i.MemMiB = c.mem
		if got := Recommend(i).Profile; got != c.want {
			t.Errorf("%d MiB: %q, want %q", c.mem, got, c.want)
		}
	}
	i := base
	i.MemMiB = 32 * 1024
	i.Virt = hostinfo.Virt{Detail: "none"}
	if r := Recommend(i); r.Profile != "" || len(r.Reasons) == 0 {
		t.Errorf("no virtualisation: %+v", r)
	}
}

func TestRecommendNamesOnlyWhatIsShort(t *testing.T) {
	i := hostinfo.Info{CPUs: 10, MemMiB: 16384, DiskFreeMiB: 7756, DiskPath: "/home/x/.dtlab", Virt: hostinfo.Virt{Accel: "hvf", Detail: "Hypervisor.framework"}}
	r := Recommend(i)
	if r.Profile != "" || len(r.Reasons) != 2 {
		t.Fatalf("%+v", r)
	}
	if !strings.Contains(r.Reasons[0], "7.6 GiB free disk at /home/x/.dtlab") || strings.Contains(r.Reasons[0], "memory") || strings.Contains(r.Reasons[0], "CPUs") {
		t.Errorf("%q", r.Reasons[0])
	}
}
