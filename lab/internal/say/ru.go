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

	// dtlab status, down, destroy (cmd/dtlab, internal/lab). The line
	// "VMs, their disks and the kuberoot credentials removed…" stays English:
	// the exams' cleanup (DTLAB_CLEANUP in web/src/app/real/facts.ts) reads it.
	"no lab yet: dtlab check, then dtlab up": "лаборатории пока нет: выполните dtlab check, потом dtlab up",
	"agent stopped":                          "агент лаборатории остановлен",
	"Delete them?":                           "Удалить их?",
	"nothing removed":                        "ничего не удалено",
	"do not ask":                             "не спрашивать подтверждения",
	"usage: dtlab down\n\nStops the VMs and the lab agent. Their disks and your work on them stay: dtlab up carries on where you left off.":                                                                        "как вызывать: dtlab down\n\nОстанавливает машины и агента лаборатории. Диски машин и ваша работа на них остаются: dtlab up продолжит с того же места.",
	"usage: dtlab destroy [--yes]\n\nDeletes the VMs, their disks and everything on them. Downloaded images stay, so the next dtlab up makes clean VMs without downloading again. Asks first; --yes does not ask.": "как вызывать: dtlab destroy [--yes]\n\nУдаляет машины, их диски и всё, что на них было. Скачанные образы остаются, поэтому следующий dtlab up создаст чистые машины без новой загрузки. Сначала спрашивает подтверждение; с флагом --yes не спрашивает.",
	"usage: dtlab up [--profile light|standard|full] [--with parts] [flags]\n\nCreates the lab's VMs and starts them, or starts the VMs of the lab that exists, and waits until they are ready.":                   "как вызывать: dtlab up [--profile light|standard|full] [--with части] [флаги]\n\nСоздаёт и запускает машины лаборатории, а если лаборатория уже создана, запускает её машины, и ждёт, пока они будут готовы.",
	"light, standard or full (default: the lab's own, or the one dtlab check recommends)":                                                                                                                          "light, standard или full (по умолчанию профиль уже созданной лаборатории или тот, что советует dtlab check)",
	"the parts: learner, kuberoot, kubeadm-nodes (comma list; default: the profile's)":                                                                                                                             "части лаборатории через запятую: learner, kuberoot, kubeadm-nodes (по умолчанию те, что входят в профиль)",
	"how to run the VMs: qemu, hyperv or auto (dtlab picks)":                                                                                                                                                       "чем запускать машины: qemu, hyperv или auto (тогда dtlab выберет сама)",
	"kuberoot artifacts: URL or directory, instead of the GitHub release":                                                                                                                                          "откуда взять файлы kuberoot вместо выпуска на GitHub: адрес или папка",
	"kuberoot release to install: a version (1.2.3) or latest":                                                                                                                                                     "какой выпуск kuberoot поставить: номер версии (1.2.3) или latest, то есть последний",
	"the built course (web/dist) to serve": "собранный курс (папка web/dist), который отдавать в браузер",
	"how long to wait for the VMs":         "сколько ждать, пока машины будут готовы",
	"usage: dtlab facts <vm> [flags]\n\nRuns the exam's read-only check in a VM and prints the block of facts to paste on the exam page. The exam page shows the whole command with its flags.": "как вызывать: dtlab facts <машина> [флаги]\n\nВыполняет на машине проверку экзамена, которая ничего не меняет, и печатает блок фактов, который нужно вставить на странице экзамена. Команду целиком, со всеми флагами, показывает страница экзамена.",
	"the exam attempt's one-time code (shown on the exam page)": "одноразовый код попытки экзамена (он есть на странице экзамена)",
	"the exam's machine id (default: the VM's name)":            "название машины в экзамене (по умолчанию имя машины в лаборатории)",
	"the exam's track": "раздел курса, к которому относится экзамен",
	"trainer-check-host.sh or trainer-check.sh (default by VM kind)":  "trainer-check-host.sh или trainer-check.sh (по умолчанию выбирается по виду машины)",
	"a collector argument, as on the exam page (repeat)":              "аргумент проверки, как на странице экзамена (флаг можно повторять)",
	"dtlab facts: name the VM first, for example dtlab facts learner": "dtlab facts: сначала назовите машину, например dtlab facts learner",
	"usage: dtlab uninstall [--yes]\n\nRemoves everything the lab ever added to this computer: the VMs, their disks, the downloads, the settings and dtlab itself. Shows the list and asks first; --yes does not ask.": "как вызывать: dtlab uninstall [--yes]\n\nУдаляет всё, что лаборатория добавила на этот компьютер: машины, их диски, скачанные файлы, настройки и саму dtlab. Сначала показывает список и спрашивает подтверждение; с флагом --yes не спрашивает.",
	"also remove things that were there before dtlab (asked otherwise)": "удалить и то, что было на компьютере до dtlab (без флага dtlab спросит про каждое)",
	"leave the dtlab program":                     "оставить саму программу dtlab",
	"usage: dtlab ssh <vm> [command]":             "как вызывать: dtlab ssh <машина> [команда]",
	"no backend in the lab state: run `dtlab up`": "лаборатория ещё не запускалась: выполните `dtlab up`",
	"expected a duration such as 30m":             "ожидается длительность, например 30m",
}

// formats holds the messages made with fmt; {n} is the n-th verb's value.
var formats = []struct{ en, ru string }{
	{"%s and the Windows Hypervisor Platform", "{1} и платформа низкоуровневой оболочки Windows"},
	{"asked for with --backend %s", "выбрано флагом --backend {1}"},
	{"no usable hardware virtualisation: %s", "нет аппаратной виртуализации: {1}"},
	{"%.1f GiB of memory is below the light profile's %d GiB", "памяти {1} ГиБ, а самому маленькому профилю light нужно {2} ГиБ"},
	{"%d CPUs are below the light profile's %d", "ядер процессора {1}, а профилю light нужно {2}"},
	{"%.1f GiB free disk at %s is below the light profile's %d GiB: free some space, or set DTLAB_HOME to a folder on a disk with more (export DTLAB_HOME=/Volumes/Data/dtlab on macOS and Linux, $env:DTLAB_HOME=\"D:\\dtlab\" in PowerShell on Windows)",
		"на диске с папкой {2} свободно {1} ГиБ, а профилю light нужно {3} ГиБ: освободите место или перенесите лабораторию на диск, где места больше. Для этого перед командами dtlab задайте переменную окружения DTLAB_HOME, то есть настройку, которую dtlab читает при запуске, с путём к папке на том диске: например, export DTLAB_HOME=/Volumes/Data/dtlab на macOS и Linux или $env:DTLAB_HOME=\"D:\\dtlab\" в PowerShell на Windows"},
	{"only %d MiB are free right now and the VMs take %d MiB: close other programs before `dtlab up`", "сейчас свободно только {1} МиБ, а машинам нужно {2} МиБ: закройте другие программы перед `dtlab up`"},
	{"%s %s (%s), %d CPUs, %s", "{1} {2} ({3}), ядер процессора: {4}, {5}"},
	{"%d MiB, %d MiB free now", "{1} МиБ, сейчас свободно {2} МиБ"},
	{"%.1f GiB free at %s", "свободно {1} ГиБ в {2}"},
	{"%s (fits: %s)", "{1} (подходят: {2})"},

	// dtlab up, status, ssh, down, destroy (cmd/dtlab, internal/lab).
	{"profile %s, backend %s, agent %s", "профиль {1}, запуск машин: {2}, агент лаборатории: {3}"},
	{"the lab is already %s with %s; `dtlab destroy` first to change it",
		"лаборатория уже создана с профилем {1} и частями {2}, а эта команда просит другой набор. Если нужные экзамену машины уже работают, ничего перезапускать не нужно. Чтобы сменить набор, сначала выполните `dtlab destroy`: эта команда удалит прежние машины вместе с их дисками"},
	{"this computer cannot run the lab: %s", "на этом компьютере лаборатория не запустится: {1}"},
	{"profile %s: %s; %d MiB of memory and up to %d GiB of disk for the VMs", "профиль {1}: {2}; машинам нужно {3} МиБ памяти и до {4} ГиБ диска"},
	{"backend: %s", "запуск машин: {1}"},
	{"warning: %d MiB of memory are free and the VMs need %d MiB; close programs or use a smaller profile", "внимание: свободно {1} МиБ памяти, а машинам нужно {2} МиБ; закройте другие программы или выберите профиль поменьше"},
	{"%s is running", "машина {1} уже работает"},
	{"%s started (%d vCPU, %d MiB, %s)", "машина {1} запущена (ядер: {2}, {3} МиБ, адрес {4})"},
	{"%s ready (%s)", "машина {1} готова ({2})"},
	{"lab up in %s; the course: http://127.0.0.1:%d/", "лаборатория запущена за {1}; курс: http://127.0.0.1:{2}/"},
	{"lab up in %s; the course is at https://damn.academy (to serve a local copy: dtlab serve --course <web/dist>)", "лаборатория запущена за {1}; курс открывается на https://damn.academy (чтобы открыть его копию с этого компьютера: dtlab serve --course <web/dist>)"},
	{"%s stopped", "машина {1} остановлена"},
	{"no VM %q in the lab (dtlab status)", "в лаборатории нет машины {1}; какие есть, покажет dtlab status"},
	{"no VM %q in the lab", "в лаборатории нет машины {1}"},
	{"%s is kuberoot: it has no shell; use kubectl --kubeconfig %s", "{1} — кластер kuberoot, терминала на нём нет; работайте с ним через kubectl --kubeconfig {2}"},
	{"dtlab %s: unexpected argument %q", "dtlab {1}: лишний аргумент {2}"},
	{"dtlab %s: flag provided but not defined: %s", "dtlab {1}: такого флага нет: {2}"},
	{"dtlab %s: invalid value %q for flag %s: %s", "dtlab {1}: неверное значение {2} у флага {3}: {4}"},
	{"Help: dtlab %s --help", "Справка: dtlab {1} --help"},
	{"unknown profile %q (light, standard or full)", "профиля {1} нет: выберите light, standard или full"},
	{"unknown part %q (learner, kuberoot, kubeadm-nodes)", "части {1} нет: выберите learner, kuberoot или kubeadm-nodes"},
	{"unknown backend %q (qemu or hyperv)", "способа запуска машин {1} нет: выберите qemu или hyperv"},
	{"unknown check script %q", "скрипта проверки {1} нет"},
	{"dtlab destroy will delete these VMs with their disks and everything on them: %s", "dtlab destroy удалит эти машины вместе с дисками и всем, что на них есть: {1}"},
}
