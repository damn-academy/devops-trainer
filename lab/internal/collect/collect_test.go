package collect

import (
	"os"
	"strings"
	"testing"
)

func TestRemoteCommand(t *testing.T) {
	r := Request{Script: Host, Nonce: "abc123", Machine: "vm1", Track: "net-b", Sudo: true,
		Args: []string{"--scope net", "--tcp web,10.10.1.21,80", "--http portal,https://www.corp.lab/,resolve=www.corp.lab:443:10.10.1.10", "--file /etc/it's"}}
	if err := r.Validate(); err != nil {
		t.Fatal(err)
	}
	got := r.RemoteCommand()
	want := `sudo bash -s -- --nonce abc123 --machine vm1 --track net-b --scope net --tcp web,10.10.1.21,80 --http portal,https://www.corp.lab/,resolve=www.corp.lab:443:10.10.1.10 --file '/etc/it'\''s'`
	if got != want {
		t.Errorf("\n got %s\nwant %s", got, want)
	}
	k := Request{Script: K8s, Nonce: "n0nce", Kubeconfig: "/etc/kubernetes/admin.conf", Sudo: true, Machine: "cp-1", Track: "k8s-2"}
	if got := k.RemoteCommand(); got != "sudo env KUBECONFIG=/etc/kubernetes/admin.conf bash -s -- --nonce n0nce --machine cp-1 --track k8s-2" {
		t.Error(got)
	}
}

func TestValidate(t *testing.T) {
	bad := []Request{
		{Script: "rm.sh", Nonce: "abcd"},
		{Nonce: "ab; rm -rf /"},
		{Nonce: "abcd", Machine: "CP_1"},
		{Nonce: "abcd", Args: []string{"--file /x\nrm -rf /"}},
	}
	for _, r := range bad {
		if r.Validate() == nil {
			t.Errorf("accepted %+v", r)
		}
	}
}

func TestBlock(t *testing.T) {
	out := "noise\n-----BEGIN TRAINER FACTS-----\nH4sI\n-----END TRAINER FACTS-----\ntrailer"
	if b, err := Block(out); err != nil || !strings.HasPrefix(b, "-----BEGIN") || !strings.HasSuffix(b, "FACTS-----") {
		t.Error(b, err)
	}
	if b, err := Block("-----BEGIN TRAINER CHECK-----\nx\n-----END TRAINER CHECK-----"); err != nil || !strings.Contains(b, "CHECK") {
		t.Error(b, err)
	}
	if _, err := Block("nothing"); err == nil {
		t.Error("no block found")
	}
}

// The embedded copies must be the course's own scripts.
func TestScriptsMatchCourse(t *testing.T) {
	for file, text := range map[string]string{"../../../web/public/check/trainer-check.sh": K8sScript, "../../../web/src/app/real/trainer-check-host.sh": HostScript} {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Skipf("course sources not here: %v", err)
		}
		if string(raw) != text {
			t.Errorf("%s changed: copy it to lab/internal/collect/scripts/", file)
		}
	}
}
