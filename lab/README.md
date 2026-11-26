# dtlab: the DevOps Trainer's local lab

[Русская версия](README.ru.md) · [Design](DESIGN.md)

`dtlab` runs the course's machines on your own computer: a Linux machine for the Linux and Networks exams, bare Ubuntu nodes on which you build Kubernetes with kubeadm, and a ready kuberoot cluster for the blocks about deploys, GitOps and monitoring. It serves the course from the same place, so everything works without the internet, takes exam facts from the machines in one step, and removes all of it with one command.

## What your computer needs

| What you do | Memory | CPU cores | Free disk | Measured |
|---|---|---|---|---|
| The course in the browser only | 4 GB | 2 | 1 GB | — |
| `light`: the learner VM and a one-node kuberoot cluster | 8 GB | 2 | 10 GB | 2.6 GiB of host memory with four pods on kuberoot; kuberoot is stable at 1.5 GiB, not at 1 GiB |
| `light --with kubeadm-nodes`: a control plane and one worker for kubeadm | 8 GB (tight) | 2 | 10 GB | VMs take 3.3 GiB; a control plane with Cilium uses 1.1 GiB of its 2 GiB |
| `standard`: learner VM, kuberoot, kubeadm control plane and worker | 16 GB | 4 | 20 GB | 7.0 GiB of host memory and 7.0 GB of disk with both clusters running a workload |
| `full`: everything, with the three-node kubeadm cluster of the k8s-2 exam | 24 GB | 6 | 30 GB | VMs take 10 GiB |
| The k8s-2 exam alone (`full --with kubeadm-nodes`, three nodes) | 16 GB | 4 | 20 GB | VMs take 6.5 GiB |

The memory column is the whole computer, the operating system and a browser with the course included (together about 4 GB). You need hardware virtualisation: KVM on Linux, any Mac with Hypervisor.framework (Intel or Apple Silicon), and on Windows 10/11 the "Windows Hypervisor Platform" feature (any edition) or Hyper-V (Pro). `dtlab check` tells you what your computer has and which profile to use.

### Measured numbers

All measured on 2026-11-20 on AMD EPYC 9454P virtual machines.

**kuberoot `edge` node** (Kubernetes 1.37.2, containerd 2.4.2, 2 vCPU):

| | |
|---|---|
| From power-on to the node API on the live media | 80 s (of which about 20 s were the host attaching disks) |
| Installation onto the system disk, until the installed slot is Good | 61 s |
| From the reboot to the node Ready | about 30 s |
| Memory with 2 GiB, two nginx pods and the add-ons (CoreDNS, local-path, metrics-server) | 513 MiB resident, 629 MiB working set, 1248 MiB available |
| Memory with 1.5 GiB and six nginx pods, after 15 minutes | 522 MiB resident, 468 MiB available, node Ready, no restarts |
| With 1 GiB | not stable: the node stops answering a minute after boot |
| The node's own services (cgroup memory, page cache included) | kube-apiserver 334 MiB, containerd 440 MiB, kube-controller-manager 117 MiB, kuberoot-node 99 MiB, kubelet 90 MiB, kubepkg-operator 77 MiB, kine 75 MiB, kube-scheduler 60 MiB, kube-proxy 54 MiB |
| Disk | boot media 0.45 GB; on the system disk about 0.7 GB used (EFI 512 MiB partition, two 1 GiB root slots, the rest is state, of which 310 MiB used) |

**kubeadm control plane on Ubuntu 24.04 minimal** (Kubernetes 1.36.6, containerd 2.2, Cilium 1.20.3, 2 vCPU / 2 GiB):

| | |
|---|---|
| Boot of the clean image | 9.5 s; 270 MiB used, 0.5 GB of disk |
| containerd and the kubeadm packages, from the internet | 27 s |
| `kubeadm init` | 22 s |
| Cilium ready, node Ready | 107 s after the first command |
| Memory with Cilium and two nginx pods | 1097 MiB used, 802 MiB available of 1899 MiB |
| Biggest processes | kube-apiserver 313 MiB, cilium-agent 183 MiB, cilium-operator 116 MiB, kube-controller-manager 68 MiB, kubelet 64 MiB, CoreDNS 2×57 MiB, containerd 54 MiB, etcd 52 MiB |
| Disk | 3.6 GB used, of which 2.0 GB container images |

The minimum for a kubeadm control plane is 2 GiB: kubeadm's preflight check refuses less than 1700 MB. A worker with Cilium used 619 MiB.

**The whole `standard` lab end to end**, on a 4-core 10 GiB Linux VM with nested KVM standing in for the learner's computer (QEMU 8.2 from Ubuntu's packages):

| | |
|---|---|
| `dtlab up --profile standard` with an empty cache (downloads 248 MB Ubuntu, 342 MB kuberoot, kubectl) | 1 min 28 s until all four VMs are ready and kuberoot is installed |
| Preparing both kubeadm nodes as in the lessons (in parallel) | 37 s |
| `kubeadm init --apiserver-advertise-address=10.10.1.11` and Cilium | 27 s; both nodes Ready 81 s after `init` began |
| Host memory, idle lab / both clusters with a workload | 4.3 GiB / 7.0 GiB |
| QEMU processes (resident) | cp-1 2.1 GiB, kr-1 2.1 GiB, worker-1 1.85 GiB, learner 0.6 GiB |
| Disk under `~/.dtlab` | 7.0 GB: cp-1 3.0 GB, worker-1 2.3 GB, kr-1 1.1 GB, learner 88 MB, images 590 MB, files 64 MB |
| `dtlab down` / `dtlab up` again | 36 s / 22 s, both clusters and their deployments intact |
| `dtlab destroy` / `dtlab uninstall` | 90 s / under a second; 690.6 MiB freed by uninstall, nothing left, disk usage back to the value before the install |
| `dtlab up --profile light` with a warm cache, then `dtlab uninstall --yes` on the running lab | 1 min 10 s until ready; QEMU kr-1 1.55 GiB and learner 0.57 GiB resident; uninstall stopped the VMs, freed 1.8 GiB and left nothing |

## Getting started

```sh
dtlab check                          # what this computer can run
dtlab up                             # the profile check recommended
dtlab up --profile standard --course web/dist
dtlab status
dtlab ssh learner
dtlab ssh cp-1                       # build the cluster as in stage 2 of Kubernetes
kubectl --kubeconfig ~/.dtlab/config/kuberoot.kubeconfig get nodes
```

The course is then at <http://127.0.0.1:7788/>. The lab's network is `10.10.1.0/24`, the private network of the lessons: `learner` is `10.10.1.10`, `cp-1` `10.10.1.11`, `worker-1` `10.10.1.21`, `worker-2` `10.10.1.22`, `kr-1` `10.10.1.30`, and the machines know each other by these names. The kubeadm nodes have nothing of Kubernetes installed: that is your work in the stage. The learner VM has `kubectl` and a kubeconfig for the kuberoot cluster.

On Linux, install QEMU first (`sudo apt install qemu-system-x86 qemu-utils ovmf` on Debian and Ubuntu) and be in the `kvm` group. On macOS, `brew install qemu`. On Windows, `winget install SoftwareFreedomConservancy.QEMU` (or the installer from qemu.weilnetz.de, which qemu.org links to; dtlab finds QEMU in `Program Files\qemu`, it need not be on PATH) with the Windows Hypervisor Platform turned on (Windows Features, then a restart).

## Exam facts

The exams on real machines ask you to run a read-only check script on a machine and paste the block it prints. With the lab, `dtlab facts` does both steps:

```sh
dtlab facts cp-1 --nonce <code from the exam page>           # k8s-2: the cluster check on cp-1
dtlab facts learner --nonce <code> --machine app-01 --track linux-disk --arg '--scope mounts'
dtlab facts kr-1 --nonce <code>                              # the kuberoot cluster, from the learner VM
```

It prints the same block you would paste. A course page served by `dtlab` can ask for it directly (`POST /api/v1/facts`, see `web/src/engine/locallab/client.ts`).

## Stopping and removing the lab

| Command | What it does | What stays |
|---|---|---|
| `dtlab down` | Stops the machines and frees their memory. | Everything: the machines' disks and your work on them. `dtlab up` carries on where you left off. |
| `dtlab destroy` | Deletes the machines and their disks. | The downloaded images, so the next `dtlab up` makes clean machines without downloading again. |
| `dtlab uninstall` | Removes everything the lab ever added to the computer: machines and disks, images and caches, the lab network, the copy of the course, settings and state, any hypervisor dtlab installed itself, the lines it added to your shell's startup file, and the dtlab program itself. | Nothing of the lab. Things that were on the computer before dtlab (a QEMU you installed, your own Hyper-V) stay unless you say otherwise. |

`dtlab uninstall` first shows the list of what it will remove with sizes and asks; `--yes` skips the question. Afterwards it checks everything again and says how much was freed and whether anything is left. All of the lab's data is in one directory, `~/.dtlab` on Linux and macOS and `%LOCALAPPDATA%\dtlab` on Windows, so removing that directory removes the lab even if something went wrong.

## Building

```sh
cd lab
go test ./...
GOFLAGS=-p=2 CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dtlab ./cmd/dtlab
```

dtlab builds for linux/amd64, linux/arm64, darwin/amd64, darwin/arm64 and windows/amd64 (12–14 MB each). The tests never start a VM: the backends build commands and the tests check them with a fake runner.

## Status

Works end to end on Linux with KVM: `check`, `up` for all parts, `status`, `ssh`, `facts` (CLI and API), `serve`, `down`, `up` again, `destroy`, `install`, `uninstall`. On Windows (Windows Server 2025, the same 24H2 base as Windows 11, in a VM with nested virtualisation, 4 vCPU and 5 GiB) `check`, `up --profile light`, `status`, `ssh`, `facts`, a reboot inside a VM and `uninstall` work with both the Windows Hypervisor Platform and Hyper-V: the light lab came up in 5 min 44 s with QEMU and WHPX and in 2 min 8 s with Hyper-V, where kuberoot boots with its own Hyper-V drivers and installs onto `sda`; `uninstall` left the registry, PATH, Hyper-V and the network as they were. Not yet: the local git server and registry, the "take facts from the lab" button on the exam page, an automated macOS run (no macOS VM can be run legally in the test cluster; the check is manual, see below), and a bundled QEMU. Known on Windows: QEMU under WHPX cannot reset a VM once Linux has run in it, so a reboot powers QEMU off and the lab agent starts it again; with Hyper-V, whose NAT passes packets as they are, a host whose uplink MTU is below 1500 (a VPN, PPPoE) can stall TLS from the VMs, which QEMU's lab switch does not. kuberoot comes from its GitHub release (the latest, or `--kuberoot-version 1.2.3`), checked against the release's manifest; `--kuberoot <url or directory>` takes a mirror, a copy of a release or a build instead. See [DESIGN.md](DESIGN.md) §11.

## Manual check on macOS and a real Windows 11

There is no automated macOS run (a macOS VM cannot be started legally in the test cluster), so the checklist is walked through by hand. On 26.11.2026 it passed on a MacBook with an Apple M4, 16 GB and macOS 26.4.1: `check` found Hypervisor.framework and suggested `light`; `up --profile light` downloaded the arm64 images and brought the lab up in 1 min 40 s, a second `up` after `down` took 14 s; `status`, `ssh learner`, `kubectl get nodes` (node Ready), an nginx pod, `facts kr-1`, `down` and `uninstall --yes` worked, `uninstall` freed 1.9 GiB and left nothing, and the Homebrew QEMU stayed in place. Windows was checked inside a VM, and until the checklist is walked through on a real Windows 11, its support is "expected to work". It takes one computer, 30–40 minutes and 10–20 GB of disk.

1. `dtlab check` — finds QEMU and Hypervisor.framework (macOS) or the Windows Hypervisor Platform (Windows 11: a Windows feature, then a reboot); suggests a profile.
2. `dtlab up --profile light` — the learner machine and `kr-1` boot, and kuberoot installs onto its disk (a Good slot appears in the output).
3. `dtlab status` — every machine is green.
4. `dtlab ssh learner` — passwordless login; `ping kr-1` from the learner machine answers.
5. `kubectl --kubeconfig ~/.dtlab/config/kuberoot.kubeconfig get nodes` — the node is Ready.
6. The course in a browser: `dtlab serve --course web/dist`, open <http://127.0.0.1:7788/>, walk a lesson that uses a machine; the "collect facts" button on the exam page sees the lab.
7. A reboot from inside: run `reboot` on `kr-1` — the node becomes Ready again. With WHPX on Windows this looks like QEMU powering off and the lab agent starting it again — a known behaviour, not an error.
8. `dtlab down`, then `dtlab up` — the machines and all work on them are still there.
9. `dtlab destroy`, then `dtlab uninstall --yes` — the disk space is freed and nothing is left in `~/.dtlab` (`%LOCALAPPDATA%\dtlab` on Windows).
10. On Windows whose main interface MTU is below 1500 (a VPN, PPPoE), run `curl -v https://github.com` from the learner machine — TLS must not stall (the Hyper-V NAT passes packets as they are).

Record the results in [STATUS](../web/STATUS.md): the OS version, how long step 2 took, any deviations.
