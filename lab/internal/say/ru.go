package say

// exact holds the messages without variable parts.
var exact = map[string]string{
	// dtlab check: the hypervisor (internal/hostinfo).
	"Hypervisor.framework is not available (a Mac inside a VM without nested virtualisation?)": "Hypervisor.framework недоступен: похоже, этот Mac сам работает внутри виртуальной машины без вложенной виртуализации",
	"KVM (/dev/kvm is usable)": "KVM (/dev/kvm доступен)",
	"/dev/kvm exists but this user cannot open it: add yourself to the kvm group (sudo usermod -aG kvm $USER) and log in again":                                            "/dev/kvm есть, но вашему пользователю он закрыт: добавьте себя в группу kvm командой sudo usermod -aG kvm $USER, выйдите из системы и войдите снова",
	"the CPU supports virtualisation but /dev/kvm is missing: load the kvm_intel or kvm_amd module, or turn virtualisation on in the firmware":                             "процессор умеет запускать виртуальные машины, но /dev/kvm нет: загрузите модуль ядра kvm_intel или kvm_amd или включите виртуализацию в настройках BIOS или UEFI",
	"no hardware virtualisation: VMs would be emulated and too slow; turn VT-x/AMD-V on in the firmware (or nested virtualisation in the hypervisor this machine runs in)": "аппаратной виртуализации нет, и машины пришлось бы изображать программно, слишком медленно: включите VT-x или AMD-V в настройках BIOS или UEFI, а если этот компьютер сам виртуальный, включите вложенную виртуализацию в его гипервизоре",
	"Hyper-V is on, but this user is not in the Hyper-V Administrators group":                                                                                              "Hyper-V включён, но ваш пользователь не входит в группу «Администраторы Hyper-V»",
	"Windows Hypervisor Platform": "платформа низкоуровневой оболочки Windows",
	`no hypervisor: turn on "Windows Hypervisor Platform" (any edition) or Hyper-V (Pro) in Windows Features, and virtualisation in the firmware`: "гипервизора нет: включите в компонентах Windows «Платформу низкоуровневой оболочки Windows», которая есть в любой редакции, или Hyper-V в редакции Pro, а также виртуализацию в настройках BIOS или UEFI",

	// dtlab check: how the VMs will run (internal/backend).
	"Linux with KVM: QEMU runs the VMs at native speed":                                                                       "Linux с KVM: QEMU запускает машины почти с полной скоростью процессора",
	"macOS: QEMU on Hypervisor.framework boots both kuberoot's EFI media and Ubuntu cloud images, on Intel and Apple Silicon": "macOS: QEMU на Hypervisor.framework запускает и kuberoot, и Ubuntu, на Mac с процессорами Intel и Apple",
	"Windows with the Windows Hypervisor Platform: QEMU, the same VMs and network as on Linux and macOS":                      "Windows с платформой низкоуровневой оболочки: QEMU, те же машины и та же сеть, что на Linux и macOS",
	"Windows with Hyper-V: VHDX disks on an internal switch with NAT":                                                         "Windows с Hyper-V: диски VHDX, внутренний коммутатор и NAT",

	// dtlab check: what is missing and how to install it (cmd/dtlab).
	"winget install SoftwareFreedomConservancy.QEMU, or turn on Hyper-V":                "winget install SoftwareFreedomConservancy.QEMU или включите Hyper-V",
	"sudo apt install qemu-system-x86 qemu-utils ovmf, or your distribution's packages": "sudo apt install qemu-system-x86 qemu-utils ovmf или такие же пакеты вашего дистрибутива",
	"none — the course in the browser alone":                                            "нет, курс пойдёт только в браузере",

	// dtlab check: the profile (internal/profile).
	"8 GB computers: the learner VM and a one-node kuberoot, or (--with kubeadm-nodes) a two-node kubeadm cluster on its own": "для компьютера с 8 ГБ памяти: машина ученика и кластер kuberoot из одного узла, а с флагом --with kubeadm-nodes вместо них два узла для kubeadm",
	"16 GB computers: the learner VM, kuberoot and two Ubuntu nodes for kubeadm":                                              "для компьютера с 16 ГБ памяти: машина ученика, кластер kuberoot и два узла Ubuntu для kubeadm",
	"24 GB and more: everything at once, with the three-node kubeadm cluster of the k8s-2 exam":                               "для 24 ГБ памяти и больше: всё сразу, включая три узла kubeadm для экзамена k8s-2",
	"the course still works in the browser alone (simulators and the in-browser Linux)":                                       "курс по-прежнему работает в браузере: симуляторы и Linux во вкладке",
	"until then, use the course in the browser alone (4 GB is enough)":                                                        "пока проходите курс в браузере, ему хватает 4 ГБ памяти",
	"this computer is itself a VM: the lab runs, more slowly":                                                                 "этот компьютер сам работает внутри виртуальной машины: лаборатория запустится, но будет медленнее",

	// dtlab courses (cmd/dtlab).
	"available": "можно поставить",
	"installed": "установлен",
	"update":    "есть обновление",
	"No installed courses. Run: dtlab course install academy": "Курсы не установлены. Выполните: dtlab course install academy",
	"All installed courses are up to date.":                   "Все установленные курсы обновлены.",
}

// formats holds the messages made with fmt; {n} is the n-th verb's value.
var formats = []struct{ en, ru string }{
	{"%s and the Windows Hypervisor Platform", "{1} и платформа низкоуровневой оболочки Windows"},
	{"asked for with --backend %s", "выбрано флагом --backend {1}"},
	{"no usable hardware virtualisation: %s", "нет аппаратной виртуализации: {1}"},
	{"%d MiB of memory is below the light profile's %d GB", "памяти {1} МиБ, а самому маленькому профилю light нужно {2} ГБ"},
	{"%d CPUs are below the light profile's %d", "ядер процессора {1}, а профилю light нужно {2}"},
	{"%.1f GiB free disk at %s is below the light profile's %d GB: free some space, or set DTLAB_HOME to a folder on a disk with more",
		"на диске с папкой {2} свободно {1} ГиБ, а профилю light нужно {3} ГБ: освободите место или перенесите лабораторию на диск, где места больше. Для этого перед командами dtlab задайте переменную окружения DTLAB_HOME, то есть настройку, которую dtlab читает при запуске, с путём к папке на том диске"},
	{"only %d MiB are free right now and the VMs take %d MiB: close other programs before `dtlab up`", "сейчас свободно только {1} МиБ, а машинам нужно {2} МиБ: закройте другие программы перед `dtlab up`"},
	{"%s %s (%s), %d CPUs, %s", "{1} {2} ({3}), ядер процессора: {4}, {5}"},
	{"%d MiB, %d MiB free now", "{1} МиБ, сейчас свободно {2} МиБ"},
	{"%d MiB free at %s", "свободно {1} МиБ в {2}"},
	{"%s (fits: %s)", "{1} (подходят: {2})"},
}
