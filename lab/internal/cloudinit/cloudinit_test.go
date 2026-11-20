package cloudinit

import (
	"strings"
	"testing"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

const key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample dtlab"

func plan() []profile.VM { p := profile.Profiles["standard"]; return profile.Plan(p, p.Default) }

func find(name string) profile.VM {
	for _, v := range plan() {
		if v.Name == name {
			return v
		}
	}
	panic(name)
}

func TestKubeadmNodeIsBare(t *testing.T) {
	s, err := For(find("cp-1"), Options{SSHPublicKey: key, Peers: plan(), AgentURL: "http://10.10.1.254:7788", Arch: "amd64"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(s.UserData, "#cloud-config\n") {
		t.Fatal("not cloud-config")
	}
	for _, banned := range []string{"kubeadm", "kubelet", "containerd", "packages:", "apt:", "kubectl"} {
		if strings.Contains(s.UserData, banned) {
			t.Errorf("kubeadm node user-data installs %q: the learner does that in stage 2", banned)
		}
	}
	for _, want := range []string{"hostname: cp-1", key, "10.10.1.21 worker-1.lab worker-1", "10.10.1.254 host.lab dtlab", "name: learner"} {
		if !strings.Contains(s.UserData, want) {
			t.Errorf("user-data lacks %q:\n%s", want, s.UserData)
		}
	}
	if s.NetworkConfig != "" {
		t.Error("DHCP backends get no network-config")
	}
	if !strings.Contains(s.MetaData, "local-hostname: cp-1") {
		t.Error(s.MetaData)
	}
}

func TestLearnerGetsKubectl(t *testing.T) {
	s, _ := For(find("learner"), Options{SSHPublicKey: key, Peers: plan(), AgentURL: "http://10.10.1.254:7788", Arch: "arm64"})
	if !strings.Contains(s.UserData, "/files/kubectl-linux-arm64") {
		t.Error("learner VM should fetch kubectl from the agent cache")
	}
}

func TestStaticNetwork(t *testing.T) {
	s, _ := For(find("worker-1"), Options{SSHPublicKey: key, Static: true, DNS: []string{"1.1.1.1"}})
	for _, want := range []string{"addresses: [10.10.1.21/24]", "via: 10.10.1.1", "macaddress: \"52:54:00:d7:01:15\"", "addresses: [1.1.1.1]"} {
		if !strings.Contains(s.NetworkConfig, want) {
			t.Errorf("network-config lacks %q:\n%s", want, s.NetworkConfig)
		}
	}
}

func TestRefusals(t *testing.T) {
	if _, err := For(find("kr-1"), Options{SSHPublicKey: key}); err == nil {
		t.Error("kuberoot must not get cloud-init")
	}
	if _, err := For(find("cp-1"), Options{SSHPublicKey: "nope"}); err == nil {
		t.Error("a bad key must be refused")
	}
}
