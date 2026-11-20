# The local lab: design

[Русская версия](DESIGN.ru.md)

The course runs in the browser and needs nothing else for most of its blocks. Some stages, however, need real machines: the Linux and Networks exams on a machine the learner administers, the Kubernetes stage where the learner installs a cluster by hand with kubeadm, and the later blocks (deploys, GitOps, monitoring, «Cluster from code») that need a working cluster to deploy to. The exam pages already describe these machines as something to order from a cloud. The local lab is the other way: `dtlab`, one program that runs the same machines on the learner's own computer, serves the course from there so that everything works offline, takes exam facts from the machines in one click, and removes all of it with one command.

## 1. What runs

| VM | Image | For | Default size |
|---|---|---|---|
| `learner` | Ubuntu 24.04 minimal cloud image | the Linux and Networks exams on a real machine, and the learner's workstation inside the lab (kubectl for the kuberoot cluster) | 1 vCPU, 1 GiB |
| `cp-1`, `worker-1`, `worker-2` | Ubuntu 24.04 minimal cloud image, nothing preinstalled | stage 2 of 05-kubernetes: containerd, kubeadm and Cilium installed by the learner | 2 vCPU, 2 GiB |
| `kr-1` | kuberoot `edge` (own kernel, EFI media from `mkimage`) | the ready cluster of the blocks after the installation stage | 2 vCPU, 1.5–2.5 GiB |

kuberoot, not k3s, is the ready cluster: it is one image with its own kernel and init, managed through the Kubernetes API itself (no SSH), it passes conformance, and it uses about 0.5 GiB of resident memory with a small workload (see [README](README.md) for the numbers). The Ubuntu minimal image (about 250 MB to download) is used only where the course needs an ordinary Linux: the learner VM and the nodes of the kubeadm stage. Nothing for Kubernetes is preinstalled on those nodes, because installing it is what the stage teaches; the seed gives them only what a cloud gives a new machine: a hostname, the learner's SSH key, the network and the lab's names in `/etc/hosts`.

## 2. Profiles

A profile is a size of the whole lab; `--with` picks its parts.

| Profile | Host | Parts by default | VMs' memory |
|---|---|---|---|
| browser only | 4 GB | none | — |
| `light` | 8 GB, 2 cores, 10 GB free | `learner` + `kr-1`; or `--with kubeadm-nodes`: `cp-1` + `worker-1` on their own | 2.3 GiB / 3.3 GiB |
| `standard` | 16 GB, 4 cores, 20 GB free | `learner` + `kr-1` + `cp-1` + `worker-1` | 6.75 GiB |
| `full` | 24 GB, 6 cores, 30 GB free | `learner` + `kr-1` + `cp-1` + `worker-1` + `worker-2` | 10 GiB |

The host's memory counts the operating system and a browser with the course, about 4 GB together. `dtlab check` reads the computer (OS, CPU, memory, free memory now, free disk where the lab lives, which hypervisor works) and names the largest profile that fits; `dtlab up` without `--profile` takes it. The k8s-2 exam asks for three kubeadm nodes; on a 16 GB computer that is `--profile full --with kubeadm-nodes` (three nodes, no learner VM and no kuberoot), which needs about 6.5 GiB.

## 3. Backends

The lab must boot two different kinds of image on Windows 10/11, macOS on Intel and Apple Silicon, and Linux: Ubuntu cloud images, which every tool supports, and kuberoot's EFI disk image, which has its own kernel and no cloud-init, SSH or guest agent, and which installs itself onto a second disk and reboots into it.

**Lima** runs arbitrary images with `vz` on macOS and QEMU on Linux, but it manages its machines through SSH and a guest agent installed by cloud-init: port forwarding, readiness and file sharing all depend on them. kuberoot has neither, so Lima could start it but not tell when it is ready, forward its ports or follow its reboot after installation. Lima also has no Windows backend of its own (it runs inside WSL2). **Multipass** boots only Ubuntu images on macOS and Windows, so kuberoot is out. **Hyper-V** boots both (a Generation 2 VM takes a VHDX made from either image), but it exists only on Windows Pro, Enterprise and Education, needs administrator rights, and its internal switches have no DHCP. **QEMU** boots both images everywhere, with the accelerator of each system: KVM on Linux, Hypervisor.framework on macOS (`-accel hvf`, x86_64 on Intel Macs and aarch64 with kuberoot's arm64 build on Apple Silicon) and the Windows Hypervisor Platform on Windows (`-accel whpx`, available on Home editions too). It runs as the learner's own process, needs no root, and is the backend the kuberoot project tests installation and upgrades with.

So the lab uses **QEMU on every system**, and Hyper-V only on Windows where the Windows Hypervisor Platform is not turned on but Hyper-V is:

| Host | Backend | Accelerator | Why |
|---|---|---|---|
| Linux | QEMU | KVM | native speed; no daemon, no root beyond the `kvm` group |
| macOS, Apple Silicon | QEMU | HVF | boots kuberoot arm64 EFI media and Ubuntu arm64 images |
| macOS, Intel | QEMU | HVF | the same with amd64 images |
| Windows 10/11 with Windows Hypervisor Platform | QEMU | WHPX | the same VMs, disks and network as on the other systems |
| Windows Pro with Hyper-V only | Hyper-V | — | Generation 2 VMs, Secure Boot off, VHDX disks |

`dtlab check` reports what is missing and how to get it (`brew install qemu`, `apt install qemu-system-x86 qemu-utils ovmf`, `winget install SoftwareFreedomConservancy.QEMU`). The packaged lab bundles QEMU for macOS and Windows under `<root>/backends/qemu` (QEMU is GPL; the bundle ships its sources' address with it) and records it in the manifest as dtlab's own, so uninstall removes it; a QEMU that was already installed is recorded as pre-existing and is never removed without asking.

Two Hyper-V limits are known. The Ubuntu minimal image boots the `linux-kvm` kernel, which lacks Hyper-V's storage and network drivers, so on Hyper-V the lab takes the full server cloud image of the same release, whose `virtual` kernel has them (Canonical's Azure image has them too, but its cloud-init reads only Azure's metadata and ignores a NoCloud seed). kuberoot's kernel has Hyper-V's guest drivers built in (VMBus storage and network, balloon, utilities, sockets, synthetic video) from its first release on; its disks are SCSI there, so the lab installs it onto `sda` rather than `vda`. Should kuberoot not boot on a learner's Hyper-V, the way out is the Windows Hypervisor Platform (one checkbox and a restart; the existing Hyper-V setup keeps working) and QEMU.

The backend code builds commands and hands them to a runner interface; unit tests check the exact QEMU command lines and PowerShell scripts with a fake runner, so no VM ever starts in the tests.

## 4. Network

Every VM has one network card, on one virtual network `10.10.1.0/24`, the private network of the course's lessons (`cp-1` is `10.10.1.11` in f-kubeadm, so the lesson commands work as written). One card matters for kubeadm: with a second card for the internet, kubelet would pick the address of the default route, the same `10.0.2.15` on every node, and the cluster would break in ways the course does not teach.

With QEMU the network is a user-space switch inside the dtlab agent process: [gvisor-tap-vsock](https://github.com/containers/gvisor-tap-vsock), the network of podman machine on macOS and Windows. Each QEMU connects to it over a loopback TCP socket (`-netdev socket,connect=127.0.0.1:7789`). The switch's gateway `10.10.1.1` gives every VM its fixed address by DHCP (static leases by MAC), answers DNS for the lab's names (`cp-1.lab`, `kr-1.lab`, `host.lab`) and forwards the rest, and NATs traffic to the internet through the host's own sockets. `10.10.1.254` is the host as the VMs see it, mapped to the host's `127.0.0.1`, which is how the VMs reach the agent. The host reaches the VMs through ports the switch publishes on `127.0.0.1` only: `2210`–`2223` for SSH, `50000` for kuberoot's node API, `6443` for its API server, `6444` for the kubeadm API server. The same code runs unchanged on the three systems, needs no root, bridge or TAP device, and leaves nothing on the host when the agent stops.

With Hyper-V the network is an internal switch `dtlab` with the host at `10.10.1.1` and `10.10.1.254` and a NetNat for the internet. The internal switch has no DHCP, so the lab agent answers DHCP on it (`10.10.1.1:67`) with each VM's fixed address by its MAC, the host as the router and public resolvers; the Ubuntu VMs also carry their address in a `network-config` on their seed. Every VM has one card here too, and nothing depends on the Default Switch, which Windows Server does not have. The host reaches the VMs at their own addresses (SSH on 22, the node API on 50000, the API server on 6443) rather than through published ports, and the agent also listens on `10.10.1.254:7788` for the VMs, its API answering only on loopback. A firewall rule `dtlab-lab` lets the VMs through Windows' firewall on the lab switch only; it goes with the switch.

## 5. How each VM is configured

Ubuntu VMs read a NoCloud seed. With QEMU, the seed is not a disk: the VM's SMBIOS serial names `ds=nocloud;s=http://10.10.1.254:7788/seed/<vm>/`, and cloud-init fetches `meta-data` and `user-data` from the agent at first boot. With Hyper-V the seed is an ISO with the label `CIDATA`, written by Windows' own image mastering API, so no ISO tool is needed. The system disk is a qcow2 overlay on the cached image, so a VM takes only the space of its own changes and a fresh VM costs no download. The SSH key is the lab's own (`<root>/config/id_ed25519`), never the learner's, and host keys go to the lab's own `known_hosts`.

kuberoot is configured through its own installation API. dtlab writes the boot media with kuberoot's `mkimage` and a trust directory of this lab (`<root>/config/kuberoot-trust`), so the media carries a serving CA made for this lab and only this lab's admin certificate reaches the node API. The VM boots with its empty system disk first and the media second; the empty disk falls through to the media. dtlab waits for the node API on `127.0.0.1:50000`, creates an `Installation` onto `vda` with `reboot: true`, waits until the booted slot is `Good`, and fetches the cluster's admin kubeconfig from the node API (`kubeconfigs/admin`). It writes one copy for the host (`<root>/config/kuberoot.kubeconfig`, server `127.0.0.1:6443` with the node's address as the TLS name) and one into the learner VM (`~/.kube/config`, server `10.10.1.30:6443`). This is the flow of kuberoot's own end-to-end test on QEMU.

## 6. Serving the course

The agent serves the built course (`web/dist`, copied into `<root>/course` by `dtlab up --course` or `dtlab serve --course`, so the lab does not depend on the source tree) at `http://127.0.0.1:7788/`, with the same `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers as `vite.config.ts`, which the in-browser Linux needs. The course is a PWA and already works offline once loaded; served by the lab, it works on a computer that has never been online after the lab was installed.

## 7. Facts from the VMs

The exam pages for real machines (`web/src/app/real/`) give the learner a read-only check script and a box for the block it prints. The lab reuses both scripts unchanged: dtlab embeds copies of `web/public/check/trainer-check.sh` and `web/src/app/real/trainer-check-host.sh` (a test fails when they drift), runs the script over SSH with its text on standard input, so nothing is written to the VM, and returns the block between `-----BEGIN TRAINER ...-----` and `-----END TRAINER ...-----`. The defaults follow the VM: the learner VM gets the host check as root; a kubeadm node gets the cluster check with `--machine` as root with `KUBECONFIG=/etc/kubernetes/admin.conf`; kuberoot, which has no shell, gets the cluster check run from the learner VM with its kubeconfig. The exam's own arguments (`--scope net`, `--file /etc/hosts`, `--tcp web,10.10.1.21,80`) pass through as they are.

`dtlab facts <vm>` prints the block. The agent's `POST /api/v1/facts` returns it to the course page, and `web/src/engine/locallab/client.ts` is the page's side: `detectLab()` finds a running lab, `collectFacts()` returns the block for the exam's existing decoder (`decodeHostBlob`), and `vmForMachine()` maps an exam's machine id to a lab VM. The exam page then judges the block exactly as one pasted by hand.

## 8. Security

Everything listens on loopback: the agent (`127.0.0.1:7788`), the switch (`127.0.0.1:7789`), every published VM port and the QEMU monitors. Nothing of the lab is reachable from the learner's network. The agent refuses requests whose `Host` is not its own (DNS rebinding), answers the API only to the page it serves itself or to an origin named with `--allow-origin`, and requires the `X-DTLab` header on every API call, which forms and images cannot send. The API refuses calls coming from the VMs; VMs get only their seeds, the check scripts and the file cache. Facts requests are validated (nonce, machine and track names, argument length, no newlines) and every argument is quoted for the remote shell. The node API takes only the lab's own client certificate; the kuberoot media and trust are made per lab and removed with it.

## 9. Offline

Everything downloaded goes to `<root>/cache`: the Ubuntu image (checked against `SHA256SUMS`), kuberoot's artifacts and `mkimage` (from kuberoot's GitHub release, the latest or the one `--kuberoot-version` names, each file checked against the sha256 of the release's `kuberoot-edge.json` and kept under its version), and `kubectl` for the learner VM, which the learner VM fetches from the agent before trying the internet. After the first `dtlab up`, `dtlab destroy` and `dtlab up` again need no network. Each source can point at a mirror or a local directory (`--kuberoot <url or dir>` or `DTLAB_KUBEROOT_URL`, `DTLAB_UBUNTU_URL`), which is how a classroom copies one download to every computer: a directory with a release's assets and its manifest is checked like the download, a build's own layout (`<arch>/`, `bin/`) is taken as it is. Offline, the manifest kept from the last download of the same release stands in for the release. What the learner installs inside the VMs (apt packages, kubeadm, container images) still comes from the internet; the planned local registry (§11) removes that for the cluster blocks.

## 10. Stopping and removing

Three commands, in plain words:

- `dtlab down` stops the VMs and the agent. Disks and the learner's work stay; `dtlab up` continues where the learner stopped.
- `dtlab destroy` deletes the VMs, their disks, the lab's kuberoot credentials and its host network. Downloaded images stay, so the next `up` is quick and clean.
- `dtlab uninstall` removes everything the lab ever added: VMs and disks, images and caches, the network, the course copy, configuration and state, backends dtlab installed, PATH lines and completions, and the dtlab program itself.

Removal is first-class. All of the lab's data lives under one directory per system (`~/.dtlab` on Linux and macOS, `%LOCALAPPDATA%\dtlab` on Windows, `DTLAB_HOME` to move it). Everything dtlab creates outside its own process is recorded, at the moment it is made, in `<root>/manifest.json`: directories, the program's path, PATH lines (the exact text added), completion files, Hyper-V VMs, the switch and the NAT, and backends with a mark of whether they were there before dtlab. `uninstall` prints the list with sizes, asks (or takes `--yes`), stops the VMs, removes the items in order (VMs, networks, backends, data, PATH lines, the program last), and then checks every item again and reports what, if anything, is left and how much was freed. Things that were there before dtlab, such as a QEMU from Homebrew or the learner's own Hyper-V, are asked about separately and kept by default. The root directory is removed even when the manifest is damaged or lost, so the worst case leaves only a PATH line, which the report names. On Windows the running program cannot delete itself, so a detached `cmd` deletes it a moment after dtlab exits. The course page shows the same three commands with the same explanations (`LAB_REMOVAL` in `client.ts`).

## 11. Not done yet

- **Local git server and registry.** The GitOps and CI blocks need a git server and a container registry the cluster can reach. The plan is to run both as packages in the kuberoot cluster (Soft Serve or Gitea, and zot), with their data on kuberoot's disk so that `destroy` and `uninstall` remove it with the VM, and an offline image archive that the agent serves as a read-only registry mirror. Not implemented.
- **Exam page integration.** `client.ts` is ready and tested; the exam panel (`web/src/app/real/panel.ts`) still needs a "Take facts from the lab" button beside each paste box.
- **Hyper-V and WHPX** have run on Windows Server 2025 in a nested VM, not yet on a learner's Windows 11 laptop. Two limits stay: QEMU under WHPX cannot reset a VM after Linux has run in it ("WHPX: Unexpected VP exit code 4"), so the lab runs QEMU with `-action reboot=shutdown` and the agent, listening on a second monitor, starts a VM again when its guest rebooted; and Hyper-V's NetNat does not clamp TCP's segment size, so behind an uplink with an MTU below 1500 the VMs' TLS can stall (kuberoot would need to take the MTU from DHCP to fix this from the lab's side).
- **Bundled QEMU** for macOS and Windows is designed (directory, manifest record) but not packaged; today dtlab uses the QEMU on the PATH.
