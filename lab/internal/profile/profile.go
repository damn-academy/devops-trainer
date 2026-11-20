// Package profile turns a resource profile and the parts the learner asks
// for into the list of VMs of the lab, with their sizes and addresses.
package profile

import (
	"fmt"
	"sort"
	"strings"

	"github.com/tym83/devops-trainer/lab/internal/hostinfo"
)

// Kind is what a VM is for.
type Kind string

const (
	Learner  Kind = "learner"  // the learner's Linux machine for the Linux and Networks exams
	Kubeadm  Kind = "kubeadm"  // a bare Ubuntu node the learner turns into a kubeadm cluster
	Kuberoot Kind = "kuberoot" // the ready cluster for deploys, GitOps and monitoring
)

// The lab network. 10.10.1.0/24 is the private network of the course's
// lessons (cp-1 is 10.10.1.11 in f-kubeadm), so lesson commands work as
// written.
const (
	Subnet    = "10.10.1.0/24"
	Gateway   = "10.10.1.1"
	HostIP    = "10.10.1.254" // the host as the VMs see it (course, seeds, cache)
	Prefix    = 24
	AgentPort = 7788
)

// VM is one machine of the lab.
type VM struct {
	Name     string `json:"name"`
	Kind     Kind   `json:"kind"`
	CPUs     int    `json:"cpus"`
	MemMiB   int    `json:"memMiB"`
	DiskGiB  int    `json:"diskGiB"`
	IP       string `json:"ip"`
	MAC      string `json:"mac"`
	SSHPort  int    `json:"sshPort,omitempty"` // 127.0.0.1:<port> → VM:22 (not kuberoot: it has no SSH)
	Forwards []Fwd  `json:"forwards,omitempty"`
}

// Fwd is a port of the VM published on the host's loopback only.
type Fwd struct {
	Host  int `json:"host"`
	Guest int `json:"guest"`
}

// Profile is a named size of the lab.
type Profile struct {
	Name string
	// MinHostMiB: the least host memory the profile is meant for, the
	// browser and the OS included.
	MinHostMiB int
	MinCPUs    int
	MinDiskGiB int
	// Parts started when --with is not given.
	Default []string
	// Workers: kubeadm workers besides cp-1.
	Workers int
	// Sizes per kind.
	Learner, CP, Worker, Kuberoot Size
	Note                          string
}

// Size of one VM.
type Size struct{ CPUs, MemMiB, DiskGiB int }

// Parts the learner can ask for with --with.
const (
	PartLearner  = "learner"
	PartKuberoot = "kuberoot"
	PartKubeadm  = "kubeadm-nodes"
)

// Profiles, sized from measurements (lab/README.md): a kuberoot edge node
// with a small workload is stable at 1.5 GiB and uses about 1 GiB; a kubeadm
// node with containerd and Cilium needs about 1.7 GiB on the control plane.
var Profiles = map[string]Profile{
	"light": {
		Name: "light", MinHostMiB: 8 * 1024, MinCPUs: 2, MinDiskGiB: 10,
		Default: []string{PartLearner, PartKuberoot}, Workers: 1,
		Learner:  Size{1, 768, 6},
		Kuberoot: Size{2, 1536, 8},
		CP:       Size{2, 2048, 8},
		Worker:   Size{1, 1280, 6},
		Note:     "8 GB computers: the learner VM and a one-node kuberoot, or (--with kubeadm-nodes) a two-node kubeadm cluster on its own",
	},
	"standard": {
		Name: "standard", MinHostMiB: 16 * 1024, MinCPUs: 4, MinDiskGiB: 20,
		Default: []string{PartLearner, PartKuberoot, PartKubeadm}, Workers: 1,
		Learner:  Size{1, 1024, 8},
		Kuberoot: Size{2, 2048, 10},
		CP:       Size{2, 2048, 10},
		Worker:   Size{2, 1792, 10},
		Note:     "16 GB computers: the learner VM, kuberoot and two Ubuntu nodes for kubeadm",
	},
	"full": {
		Name: "full", MinHostMiB: 24 * 1024, MinCPUs: 6, MinDiskGiB: 30,
		Default: []string{PartLearner, PartKuberoot, PartKubeadm}, Workers: 2,
		Learner:  Size{1, 1024, 8},
		Kuberoot: Size{2, 2560, 12},
		CP:       Size{2, 2560, 12},
		Worker:   Size{2, 2048, 10},
		Note:     "24 GB and more: everything at once, with the three-node kubeadm cluster of the k8s-2 exam",
	},
}

// Names in order of size.
func Names() []string { return []string{"light", "standard", "full"} }

// Get returns a profile by name.
func Get(name string) (Profile, error) {
	p, ok := Profiles[name]
	if !ok {
		return Profile{}, fmt.Errorf("unknown profile %q (light, standard or full)", name)
	}
	return p, nil
}

// ParseWith reads --with: a comma list of parts; empty means the defaults.
func ParseWith(p Profile, with string) ([]string, error) {
	if strings.TrimSpace(with) == "" {
		return append([]string(nil), p.Default...), nil
	}
	seen := map[string]bool{}
	var out []string
	for _, w := range strings.Split(with, ",") {
		w = strings.TrimSpace(w)
		switch w {
		case PartLearner, PartKuberoot, PartKubeadm:
		case "kubeadm":
			w = PartKubeadm
		default:
			return nil, fmt.Errorf("unknown part %q (learner, kuberoot, kubeadm-nodes)", w)
		}
		if !seen[w] {
			seen[w] = true
			out = append(out, w)
		}
	}
	return out, nil
}

// Plan lists the VMs of a profile with the given parts. Addresses, MACs and
// host ports are fixed per name, so a VM keeps them across `down` and `up`.
func Plan(p Profile, parts []string) []VM {
	has := map[string]bool{}
	for _, x := range parts {
		has[x] = true
	}
	var vms []VM
	add := func(name string, k Kind, s Size, host int, ssh int, fwd ...Fwd) {
		vms = append(vms, VM{Name: name, Kind: k, CPUs: s.CPUs, MemMiB: s.MemMiB, DiskGiB: s.DiskGiB,
			IP: fmt.Sprintf("10.10.1.%d", host), MAC: fmt.Sprintf("52:54:00:d7:01:%02x", host), SSHPort: ssh, Forwards: fwd})
	}
	if has[PartLearner] {
		add("learner", Learner, p.Learner, 10, 2210)
	}
	if has[PartKubeadm] {
		add("cp-1", Kubeadm, p.CP, 11, 2211, Fwd{Host: 6444, Guest: 6443})
		for w := 1; w <= p.Workers; w++ {
			add(fmt.Sprintf("worker-%d", w), Kubeadm, p.Worker, 20+w, 2220+w)
		}
	}
	if has[PartKuberoot] {
		add("kr-1", Kuberoot, p.Kuberoot, 30, 0, Fwd{Host: 50000, Guest: 50000}, Fwd{Host: 6443, Guest: 6443})
	}
	return vms
}

// Totals of a plan.
func Totals(vms []VM) (cpus, memMiB, diskGiB int) {
	for _, v := range vms {
		cpus += v.CPUs
		memMiB += v.MemMiB
		diskGiB += v.DiskGiB
	}
	return
}

// Recommendation is what `dtlab check` advises.
type Recommendation struct {
	Profile string   `json:"profile"` // "" means: browser only
	Reasons []string `json:"reasons"`
	Fits    []string `json:"fits"` // every profile this computer can run
}

// Recommend picks the largest profile the host fits. Memory counts the host
// as a whole: the OS and a browser with the course need about 4 GB of it.
func Recommend(i hostinfo.Info) Recommendation {
	var r Recommendation
	if i.Virt.Accel == "" && !i.Virt.HyperV {
		r.Reasons = append(r.Reasons, "no usable hardware virtualisation: "+i.Virt.Detail)
		r.Reasons = append(r.Reasons, "the course still works in the browser alone (simulators and the in-browser Linux)")
		return r
	}
	for _, n := range Names() {
		p := Profiles[n]
		// 5% slack: "16 GB" machines report a little less than 16384 MiB.
		if i.MemMiB*100 >= p.MinHostMiB*95 && i.CPUs >= p.MinCPUs && i.DiskFreeMiB >= p.MinDiskGiB*1024 {
			r.Fits = append(r.Fits, n)
		}
	}
	sort.SliceStable(r.Fits, func(a, b int) bool { return Profiles[r.Fits[a]].MinHostMiB < Profiles[r.Fits[b]].MinHostMiB })
	if len(r.Fits) == 0 {
		r.Reasons = append(r.Reasons, fmt.Sprintf("%d MiB of memory, %d CPUs and %d GiB free disk are below the light profile (8 GB, 2 CPUs, 10 GB free)", i.MemMiB, i.CPUs, i.DiskFreeMiB/1024))
		r.Reasons = append(r.Reasons, "use the course in the browser alone (4 GB is enough)")
		return r
	}
	r.Profile = r.Fits[len(r.Fits)-1]
	p := Profiles[r.Profile]
	r.Reasons = append(r.Reasons, p.Note)
	if i.MemAvailMiB > 0 {
		_, need, _ := Totals(Plan(p, p.Default))
		if i.MemAvailMiB < need {
			r.Reasons = append(r.Reasons, fmt.Sprintf("only %d MiB are free right now and the VMs take %d MiB: close other programs before `dtlab up`", i.MemAvailMiB, need))
		}
	}
	if i.Virt.Nested {
		r.Reasons = append(r.Reasons, "this computer is itself a VM: the lab runs, more slowly")
	}
	return r
}
