// Package cloudinit writes the NoCloud seed of the Ubuntu VMs: meta-data,
// user-data and, where the VM has no DHCP (Hyper-V), network-config.
//
// The seed gives a VM only what a cloud gives a new machine: its hostname,
// the learner's SSH key, the network and the lab's names in /etc/hosts.
// Nothing for Kubernetes is installed on the kubeadm nodes: installing
// containerd, kubeadm and kubelet is the learner's work in stage 2.
package cloudinit

import (
	"fmt"
	"sort"
	"strings"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

// User is the account the learner logs in with, as in a cloud image.
const User = "learner"

// Seed is the three files of one VM.
type Seed struct {
	MetaData      string
	UserData      string
	NetworkConfig string // empty: DHCP (the lab network gives every MAC a fixed address)
}

// Options of a seed.
type Options struct {
	SSHPublicKey string
	// Static: write the address into network-config (backends without the
	// lab's DHCP server).
	Static bool
	// DNS for a static configuration; the gateway by default.
	DNS []string
	// All VMs of the lab, for /etc/hosts.
	Peers []profile.VM
	// AgentURL: the host's lab agent as the VM sees it (http://10.10.1.254:7788).
	AgentURL string
	// Arch of the VMs (amd64, arm64), for the learner VM's kubectl.
	Arch string
}

// For builds the seed of one VM.
func For(vm profile.VM, o Options) (Seed, error) {
	if vm.Kind == profile.Kuberoot {
		return Seed{}, fmt.Errorf("%s: kuberoot nodes take no cloud-init: they are configured through their node API", vm.Name)
	}
	if !strings.HasPrefix(strings.TrimSpace(o.SSHPublicKey), "ssh-") {
		return Seed{}, fmt.Errorf("%s: an OpenSSH public key is required", vm.Name)
	}
	s := Seed{MetaData: fmt.Sprintf("instance-id: dtlab-%s\nlocal-hostname: %s\n", vm.Name, vm.Name)}
	if o.Static {
		s.NetworkConfig = networkConfig(vm, o.DNS)
	}
	s.UserData = userData(vm, o)
	return s, nil
}

func userData(vm profile.VM, o Options) string {
	var b strings.Builder
	b.WriteString("#cloud-config\n")
	fmt.Fprintf(&b, "hostname: %s\nfqdn: %s.lab\nprefer_fqdn_over_hostname: false\n", vm.Name, vm.Name)
	b.WriteString("manage_etc_hosts: false\n")
	b.WriteString("ssh_pwauth: false\ndisable_root: true\n")
	b.WriteString("users:\n")
	fmt.Fprintf(&b, "  - name: %s\n    gecos: DevOps Trainer learner\n    groups: [adm, sudo]\n    shell: /bin/bash\n    sudo: \"ALL=(ALL) NOPASSWD:ALL\"\n    lock_passwd: true\n", User)
	fmt.Fprintf(&b, "    ssh_authorized_keys:\n      - %s\n", strings.TrimSpace(o.SSHPublicKey))
	// The lab's names, so `ssh worker-1` and `ping cp-1` work as in the lessons.
	b.WriteString("write_files:\n")
	b.WriteString("  - path: /etc/hosts\n    permissions: \"0644\"\n    content: |\n")
	b.WriteString("      127.0.0.1 localhost\n")
	fmt.Fprintf(&b, "      127.0.1.1 %s.lab %s\n", vm.Name, vm.Name)
	peers := append([]profile.VM(nil), o.Peers...)
	sort.Slice(peers, func(i, j int) bool { return peers[i].IP < peers[j].IP })
	for _, p := range peers {
		if p.Name == vm.Name {
			continue
		}
		fmt.Fprintf(&b, "      %s %s.lab %s\n", p.IP, p.Name, p.Name)
	}
	fmt.Fprintf(&b, "      %s host.lab dtlab\n", profile.HostIP)
	b.WriteString("      ::1 localhost ip6-localhost ip6-loopback\n")
	// The course's own check scripts, from the lab agent: `bash
	// /usr/local/share/dtlab/trainer-check-host.sh` works without copying.
	if o.AgentURL != "" {
		b.WriteString("runcmd:\n")
		b.WriteString("  - [mkdir, -p, /usr/local/share/dtlab]\n")
		for _, f := range []string{"trainer-check.sh", "trainer-check-host.sh"} {
			fmt.Fprintf(&b, "  - [sh, -c, \"curl -fsS -o /usr/local/share/dtlab/%s %s/check/%s || true\"]\n", f, o.AgentURL, f)
		}
		if vm.Kind == profile.Learner && o.Arch != "" {
			// The learner VM is the learner's workstation in the lab: kubectl
			// for the kuberoot cluster, from the agent's offline cache first.
			fmt.Fprintf(&b, "  - [sh, -c, \"curl -fsS -o /usr/local/bin/kubectl %s/files/kubectl-linux-%s || curl -fsSL -o /usr/local/bin/kubectl https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/%s/kubectl; chmod 0755 /usr/local/bin/kubectl\"]\n", o.AgentURL, o.Arch, o.Arch)
		}
	}
	// Ubuntu minimal images skip some work at first boot when told there
	// is nothing to upgrade; the learner runs apt themselves.
	b.WriteString("package_update: false\npackage_upgrade: false\n")
	if vm.Kind == profile.Kubeadm {
		// Swap stays off (the image has none) and nothing of Kubernetes is
		// preinstalled: that is the learner's stage.
		b.WriteString("swap: {filename: /swap.img, size: 0}\n")
	}
	return b.String()
}

func networkConfig(vm profile.VM, dns []string) string {
	if len(dns) == 0 {
		dns = []string{profile.Gateway}
	}
	return fmt.Sprintf(`version: 2
ethernets:
  lab0:
    match: {macaddress: "%s"}
    set-name: eth0
    addresses: [%s/%d]
    routes: [{to: default, via: %s}]
    nameservers: {addresses: [%s], search: [lab]}
`, vm.MAC, vm.IP, profile.Prefix, profile.Gateway, strings.Join(dns, ", "))
}
