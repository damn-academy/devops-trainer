// #/local-lab: how to put the course's local lab (dtlab, lab/README.md) on
// your own computer — what it runs and why, what the computer needs (the
// measured numbers of lab/README.md), the steps for Windows, macOS and Linux,
// exam facts, and the three ways out of the lab. Linked from the «?» help,
// from Settings and from the lessons and exams that need real machines.

import { h } from '../core/dom';
import { bi, lang, t, type Bi } from '../core/i18n';
import { LAB_REMOVAL } from '../engine/locallab/client';
import { prose, setTitle, type Page } from './common';
import { LOCAL_LAB_LINK } from './help';

export const DTLAB_REPO = 'https://github.com/damn-academy/devops-trainer';

/**
 * The ready-made dtlab builds on the repository's GitHub releases. Set
 * `published` once the release job has uploaded the assets; until then the
 * page shows how to build dtlab from the sources.
 */
export const DTLAB_RELEASE = {
  published: true,
  // Enable each platform only after its native assets are uploaded.
  installersPublished: { windows: true, macos: true, linux: true },
  coursesPublished: true,
  assets: {
    windows: [{ file: 'dtlab-windows-amd64.exe', label: bi('Windows 10 и 11, процессоры Intel и AMD', 'Windows 10 and 11, Intel and AMD processors') }],
    macos: [
      { file: 'dtlab-darwin-arm64', label: bi('Mac с процессором Apple (M1 и новее)', 'Mac with an Apple processor (M1 and newer)') },
      { file: 'dtlab-darwin-amd64', label: bi('Mac с процессором Intel', 'Mac with an Intel processor') },
    ],
    linux: [
      { file: 'dtlab-linux-amd64', label: bi('Linux на процессорах Intel и AMD', 'Linux on Intel and AMD processors') },
      { file: 'dtlab-linux-arm64', label: bi('Linux на процессорах ARM', 'Linux on ARM processors') },
    ],
  },
};

export type LabOS = keyof typeof DTLAB_RELEASE.assets;

export function assetUrl(file: string): string {
  return `${DTLAB_REPO}/releases/latest/download/${file}`;
}

/** The learner's system, to open its instructions first. */
export function guessOS(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): LabOS {
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return 'macos';
  return 'linux';
}

/** lab/README.md, «What your computer needs», measured on 20.11.2026. */
const NEEDS: { what: Bi; mem: Bi; cores: string; disk: Bi; measured: Bi }[] = [
  { what: bi('Курс только в браузере', 'The course in the browser only'), mem: bi('4 ГБ', '4 GB'), cores: '2', disk: bi('1 ГБ', '1 GB'), measured: bi('—', '—') },
  {
    what: bi('`light`: машина ученика и кластер kuberoot из одного узла', '`light`: the learner VM and a one-node kuberoot cluster'),
    mem: bi('8 ГБ', '8 GB'),
    cores: '2',
    disk: bi('10 ГБ', '10 GB'),
    measured: bi('2,6 ГиБ памяти компьютера с четырьмя подами на kuberoot; kuberoot стабилен при 1,5 ГиБ и не работает при 1 ГиБ', '2.6 GiB of host memory with four pods on kuberoot; kuberoot is stable at 1.5 GiB, not at 1 GiB'),
  },
  {
    what: bi('`light --with kubeadm-nodes`: управляющий узел и один рабочий для kubeadm', '`light --with kubeadm-nodes`: a control plane and one worker for kubeadm'),
    mem: bi('8 ГБ (впритык)', '8 GB (tight)'),
    cores: '2',
    disk: bi('10 ГБ', '10 GB'),
    measured: bi('Машины занимают 3,3 ГиБ; управляющий узел с Cilium использует 1,1 ГиБ из своих 2 ГиБ', 'VMs take 3.3 GiB; a control plane with Cilium uses 1.1 GiB of its 2 GiB'),
  },
  {
    what: bi('`standard`: машина ученика, kuberoot, управляющий и рабочий узлы kubeadm', '`standard`: learner VM, kuberoot, kubeadm control plane and worker'),
    mem: bi('16 ГБ', '16 GB'),
    cores: '4',
    disk: bi('20 ГБ', '20 GB'),
    measured: bi('7,0 ГиБ памяти компьютера и 7,0 ГБ диска, когда в обоих кластерах работает нагрузка', '7.0 GiB of host memory and 7.0 GB of disk with both clusters running a workload'),
  },
  {
    what: bi('`full`: всё сразу, включая три узла kubeadm для экзамена k8s-2', '`full`: everything, with the three-node kubeadm cluster of the k8s-2 exam'),
    mem: bi('24 ГБ', '24 GB'),
    cores: '6',
    disk: bi('30 ГБ', '30 GB'),
    measured: bi('Машины занимают 10 ГиБ', 'VMs take 10 GiB'),
  },
  {
    what: bi('Экзамен этапа 2 блока Kubernetes: три узла kubeadm без машины ученика и kuberoot (`full --with kubeadm-nodes`)', 'The Kubernetes stage 2 exam: three kubeadm nodes without the learner machine and kuberoot (`full --with kubeadm-nodes`)'),
    mem: bi('16 ГБ', '16 GB'),
    cores: '4',
    disk: bi('20 ГБ', '20 GB'),
    measured: bi('Машины занимают 6,5 ГиБ', 'VMs take 6.5 GiB'),
  },
];

const INTRO = bi(
  'Начинать курс без лаборатории можно. Уроки и экзамены до блока «Kubernetes, этап 2: настоящие машины» идут прямо в браузере, а у экзаменов по Linux и сетям, которые сдают на своих машинах, есть варианты во вкладке: в них настоящий Linux работает в браузере, и ничего ставить не нужно.\n\nЛаборатория впервые понадобится на этапе 2 блока Kubernetes, где кластер собирают своими руками через kubeadm, а потом в блоках о выкладке, GitOps и мониторинге, которым нужен работающий кластер. Такие машины можно арендовать в облаке, но там за каждую машину платят каждый час, пока она не удалена. Программа dtlab даёт другой путь: она бесплатно запускает те же машины на вашем компьютере, а когда они больше не нужны, одной командой убирает их за собой. На ней же можно сдать и экзамены по Linux и сетям на настоящих машинах.',
  'You can start the course without the lab. The lessons and exams up to the block “Kubernetes, stage 2: real machines” run right in the browser, and the Linux and Networks exams taken on your own machines have in-tab variants, where real Linux runs in the browser and nothing needs installing.\n\nThe lab is first needed at stage 2 of the Kubernetes block, where you assemble a cluster by hand with kubeadm, and then in the blocks about deploys, GitOps and monitoring, which need a running cluster. Such machines can be rented in a cloud, but there every machine is paid for every hour until it is deleted. The dtlab program offers another way: it runs the same machines on your computer for free, and when they are no longer needed, removes them with one command. The Linux and Networks exams on real machines can be taken on it too.',
);

const WHAT = bi(
  'Лаборатория запускает виртуальные машины, то есть отдельные компьютеры со своей системой, которые работают внутри вашего компьютера и не трогают его файлы. Машина `learner` нужна для экзаменов по Linux и сетям, и на ней же стоит kubectl, программа для работы с кластером. Docker на ней заранее не установлен, но для настоящей сборки образов его ставит одна команда `sudo apt install docker.io`. Чистые машины Ubuntu `cp-1`, `worker-1` и `worker-2` ждут, когда вы соберёте на них Kubernetes через kubeadm, поэтому ничего от Kubernetes на них заранее не установлено. На машине `kr-1` работает готовый кластер kuberoot для блоков, которые идут после этапа установки.\n\nВсе машины подключены к одной частной сети `10.10.1.0/24`, той же, что в уроках, и знают друг друга по именам: `learner` получает адрес `10.10.1.10`, `cp-1` — `10.10.1.11`, `worker-1` — `10.10.1.21`, `worker-2` — `10.10.1.22`, а `kr-1` — `10.10.1.30`. Образы машин лаборатория скачивает один раз, при первом запуске, и потом создаёт и пересоздаёт машины без интернета. Пакеты, которые вы ставите внутри машин по ходу уроков, по-прежнему скачиваются из интернета.\n\nВсе данные лаборатории лежат в одном каталоге: `~/.dtlab` на Linux и macOS и `%LOCALAPPDATA%\\dtlab` на Windows.',
  'The lab runs virtual machines, that is, separate computers with their own system that run inside your computer and do not touch its files. The `learner` machine is for the Linux and Networks exams, and it also has kubectl, the program for working with a cluster. Docker is not installed there in advance, but for building real images one command, `sudo apt install docker.io`, installs it. The clean Ubuntu machines `cp-1`, `worker-1` and `worker-2` wait for you to assemble Kubernetes on them with kubeadm, so nothing of Kubernetes is installed on them in advance. The `kr-1` machine runs a ready kuberoot cluster for the blocks that come after the installation stage.\n\nAll machines are on one private network, `10.10.1.0/24`, the same as in the lessons, and know each other by name: `learner` gets the address `10.10.1.10`, `cp-1` gets `10.10.1.11`, `worker-1` gets `10.10.1.21`, `worker-2` gets `10.10.1.22` and `kr-1` gets `10.10.1.30`. The lab downloads the machine images once, on the first start, and afterwards creates and recreates machines without the internet. Packages you install inside the machines during the lessons still come from the internet.\n\nAll the lab’s data is in one directory: `~/.dtlab` on Linux and macOS and `%LOCALAPPDATA%\\dtlab` on Windows.',
);

const NEEDS_NOTE = bi(
  'В столбце памяти указан весь компьютер вместе с операционной системой и браузером с курсом, которые вдвоём занимают около 4 ГБ. В последнем столбце приведены замеры 20 ноября 2026 года. Кроме памяти, нужна аппаратная виртуализация, то есть поддержка виртуальных машин в процессоре и системе: KVM на Linux, Hypervisor.framework на любом Mac с процессором Intel или Apple, а на Windows 10 и 11 — компонент «Платформа низкоуровневой оболочки Windows», который есть в любой редакции, или Hyper-V в редакции Pro. Команда `dtlab check` скажет, что из этого есть у вашего компьютера и какой профиль выбрать.',
  'The memory column is the whole computer, including the operating system and a browser with the course, which together take about 4 GB. The last column holds the measurements of 20 November 2026. Besides memory you need hardware virtualisation, that is, support for virtual machines in the processor and the system: KVM on Linux, Hypervisor.framework on any Mac with an Intel or Apple processor, and on Windows 10 and 11 the “Windows Hypervisor Platform” feature, available in every edition, or Hyper-V in the Pro edition. The `dtlab check` command tells you which of these your computer has and which profile to choose.',
);

const OS_TITLE: Record<LabOS, Bi> = {
  windows: bi('Windows 10 и 11', 'Windows 10 and 11'),
  macos: bi('macOS', 'macOS'),
  linux: bi('Linux', 'Linux'),
};

/** Step 1 for each system: the hypervisor and QEMU. */
const HYPERVISOR: Record<LabOS, Bi> = {
  windows: bi(
    'Сначала включите платформу низкоуровневой оболочки Windows. Откройте «Панель управления», затем «Программы» и «Включение или отключение компонентов Windows», отметьте «Платформа низкоуровневой оболочки Windows», нажмите «ОК» и перезагрузите компьютер.\n\nЗатем поставьте QEMU, программу, через которую лаборатория запускает машины. Откройте окно «Терминал» и выполните команду:\n\n```powershell\nwinget install SoftwareFreedomConservancy.QEMU\n```\n\nЛаборатория сама находит QEMU в папке `Program Files\\qemu`, поэтому добавлять его в PATH не нужно. Если у вас Windows Pro, в которой уже включён Hyper-V, а платформа низкоуровневой оболочки выключена, лаборатория запустит машины через Hyper-V и обойдётся без QEMU. Для этого ваш пользователь должен входить в группу «Администраторы Hyper-V», и `dtlab check` скажет, если это не так.',
    'First turn on the Windows Hypervisor Platform. Open “Control Panel”, then “Programs” and “Turn Windows features on or off”, tick “Windows Hypervisor Platform”, press “OK” and restart the computer.\n\nThen install QEMU, the program the lab runs its machines with. Open “Terminal” and run:\n\n```powershell\nwinget install SoftwareFreedomConservancy.QEMU\n```\n\nThe lab finds QEMU in `Program Files\\qemu` by itself, so there is no need to add it to the PATH. If you have Windows Pro with Hyper-V already on and the Windows Hypervisor Platform off, the lab runs its machines with Hyper-V and needs no QEMU. Your user must then be in the “Hyper-V Administrators” group, and `dtlab check` tells you if it is not.',
  ),
  macos: bi(
    'На Mac лаборатория запускает машины через QEMU, программу для виртуальных машин. Удобнее всего поставить её через Homebrew. Это менеджер пакетов, то есть программа, которая одной командой скачивает и ставит другие программы. Если Homebrew у вас ещё нет, откройте программу «Терминал» и выполните команду установки с сайта brew.sh:\n\n```bash\n/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\n```\n\nОна попросит пароль, которым вы входите в Mac, а если на Mac нет инструментов разработчика Apple, поставит и их. В конце установщик напечатает раздел «Next steps» с командами, которые добавляют Homebrew в PATH: скопируйте и выполните их. Затем поставьте QEMU:\n\n```bash\nbrew install qemu\n```',
    'On a Mac the lab runs its machines with QEMU, a program for virtual machines. It is easiest to install with Homebrew, a package manager, that is, a program that downloads and installs other programs with one command. If you do not have Homebrew yet, open the “Terminal” app and run the install command from brew.sh:\n\n```bash\n/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\n```\n\nIt asks for the password you log in to the Mac with, and if the Mac lacks Apple’s developer tools, it installs them too. At the end the installer prints “Next steps” with commands that add Homebrew to the PATH: copy and run them. Then install QEMU:\n\n```bash\nbrew install qemu\n```',
  ),
  linux: bi(
    'На Linux лаборатория запускает машины через QEMU с ускорителем KVM, который встроен в ядро. В Ubuntu и Debian поставьте QEMU и добавьте себя в группу `kvm`, которой разрешено пользоваться KVM:\n\n```bash\nsudo apt install qemu-system-x86 qemu-utils ovmf\nsudo usermod -aG kvm $USER\n```\n\nПосле второй команды выйдите из системы и войдите снова, потому что новая группа начинает действовать только при следующем входе.',
    'On Linux the lab runs its machines with QEMU and the KVM accelerator built into the kernel. On Ubuntu and Debian install QEMU and add yourself to the `kvm` group, which is allowed to use KVM:\n\n```bash\nsudo apt install qemu-system-x86 qemu-utils ovmf\nsudo usermod -aG kvm $USER\n```\n\nAfter the second command log out and back in, because a new group takes effect only at the next login.',
  ),
};

const INSTALLERS: Record<LabOS, string[]> = {
  windows: ['dtlab-windows-amd64-setup.exe'],
  macos: ['dtlab-darwin-arm64.pkg', 'dtlab-darwin-amd64.pkg'],
  linux: ['dtlab-linux-amd64.deb', 'dtlab-linux-arm64.deb', 'dtlab-linux-amd64.rpm', 'dtlab-linux-arm64.rpm', 'install.sh'],
};

function installerSteps(os: LabOS): Bi {
  const links = INSTALLERS[os].map(file => `[${file}](${assetUrl(file)})`).join(', ');
  if (os === 'windows') return bi(
    `Скачайте установщик ${links} и откройте его. Он установит dtlab в Program Files и добавит команду в PATH. Установщик не подписан, то есть у него нет цифровой подписи издателя, и поэтому SmartScreen, фильтр, которым Windows проверяет скачанные программы, может его остановить. Если появится окно «Система Windows защитила ваш компьютер» («Windows protected your PC»), нажмите «Подробнее» («More info»), затем «Выполнить в любом случае» («Run anyway»). После установки откройте новое окно терминала.`,
    `Download and open the installer: ${links}. It installs dtlab in Program Files and adds it to PATH. The installer is unsigned, that is, it carries no publisher’s digital signature, so SmartScreen, the filter Windows checks downloaded programs with, may stop it. If SmartScreen shows “Windows protected your PC”, select “More info”, then “Run anyway”. Open a new terminal after installation.`,
  );
  if (os === 'macos') return bi(
    `Скачайте установщик для своего процессора: ${links}. arm64 подходит для Apple Silicon, amd64 — для Intel. Откройте .pkg и следуйте шагам установки. Пакет не подписан у Apple, поэтому Gatekeeper, защита macOS от программ неизвестных разработчиков, сначала его не откроет. В новых версиях macOS предупреждение говорит, что Apple не может проверить пакет на вредоносные программы, а в старых — что разработчик не установлен («unidentified developer»). Закройте предупреждение кнопкой «Готово» («Done») или «ОК», откройте «Системные настройки» → «Конфиденциальность и безопасность» («System Settings» → «Privacy & Security»), нажмите «Всё равно открыть» («Open Anyway»), подтвердите запуск и введите пароль от Mac. Программа установится в /usr/local/bin.`,
    `Download the installer for your processor: ${links}. Choose arm64 for Apple Silicon or amd64 for Intel. Open the .pkg and follow the installer. It is not signed with Apple, so Gatekeeper, macOS’s guard against programs from unknown developers, does not open it at first: newer macOS says Apple could not verify the package is free of malware, older macOS says it is from an “unidentified developer”. Close the warning with “Done” or “OK”, open System Settings → Privacy & Security → Open Anyway, confirm opening and authenticate. The program installs in /usr/local/bin.`,
  );
  return bi(
    `Скачайте пакет для своей системы и процессора: ${links}. Для Debian и Ubuntu выполните \`sudo apt install ./dtlab-linux-amd64.deb\`, для Fedora — \`sudo dnf install ./dtlab-linux-amd64.rpm\`; на ARM замените amd64 на arm64. Для остальных дистрибутивов выполните:\n\n\`\`\`sh\ncurl -fsSL ${assetUrl('install.sh')} | sh\n\`\`\`\n\nСкрипт сверит SHA256 и установит dtlab в ~/.local/bin. Добавьте этот каталог в PATH по подсказке скрипта.`,
    `Download a package for your distribution and processor: ${links}. On Debian or Ubuntu run \`sudo apt install ./dtlab-linux-amd64.deb\`; on Fedora run \`sudo dnf install ./dtlab-linux-amd64.rpm\`. Replace amd64 with arm64 on ARM. For other distributions run:\n\n\`\`\`sh\ncurl -fsSL ${assetUrl('install.sh')} | sh\n\`\`\`\n\nThe script verifies SHA256 and installs dtlab in ~/.local/bin. Follow its instruction to add this directory to PATH.`,
  );
}

/** Step 2 with ready-made builds: download and put dtlab on the PATH. */
function downloadSteps(os: LabOS): Bi {
  const [first] = DTLAB_RELEASE.assets[os];
  if (os === 'windows')
    return bi(
      `Скачайте программу dtlab и положите её на PATH. В окне «Терминал» выполните:\n\n\`\`\`powershell\ncurl.exe -L -o dtlab.exe ${assetUrl(first.file)}\n.\\dtlab.exe install\n\`\`\`\n\nКоманда \`install\` копирует dtlab в каталог лаборатории и добавляет его в PATH вашего пользователя. После неё откройте новое окно терминала, и команда \`dtlab\` заработает из любой папки.`,
      `Download dtlab and put it on the PATH. In “Terminal” run:\n\n\`\`\`powershell\ncurl.exe -L -o dtlab.exe ${assetUrl(first.file)}\n.\\dtlab.exe install\n\`\`\`\n\nThe \`install\` command copies dtlab into the lab’s directory and adds it to your user’s PATH. Then open a new terminal window, and the \`dtlab\` command works from any folder.`,
    );
  const files = DTLAB_RELEASE.assets[os];
  const which = files.length > 1 ? files.map((f) => `\`${f.file}\``).join(lang() === 'ru' ? ' или ' : ' or ') : `\`${first.file}\``;
  return bi(
    `Скачайте программу dtlab для своего процессора (${which}, список файлов ниже) и положите её на PATH. В терминале выполните, подставив нужное имя файла:\n\n\`\`\`bash\ncurl -L -o dtlab ${assetUrl(first.file)}\nchmod +x dtlab\n./dtlab install\n\`\`\`\n\nКоманда \`chmod +x\` разрешает запускать скачанный файл как программу, а \`install\` копирует dtlab в каталог лаборатории и добавляет его в PATH и в файл запуска вашей оболочки. После этого откройте новое окно терминала, и команда \`dtlab\` заработает из любой папки.`,
    `Download dtlab for your processor (${which}, see the list of files below) and put it on the PATH. In a terminal run, with the right file name:\n\n\`\`\`bash\ncurl -L -o dtlab ${assetUrl(first.file)}\nchmod +x dtlab\n./dtlab install\n\`\`\`\n\n\`chmod +x\` allows the downloaded file to run as a program, and \`install\` copies dtlab into the lab’s directory and adds it to the PATH in your shell’s startup file. Then open a new terminal window, and the \`dtlab\` command works from any folder.`,
  );
}

/** Step 2 until ready-made builds are published: build dtlab from the sources. */
function buildSteps(os: LabOS): Bi {
  const exe = os === 'windows' ? 'dtlab.exe' : 'dtlab';
  const run = os === 'windows' ? '.\\dtlab.exe install' : './dtlab install';
  return bi(
    `Готовые файлы программы dtlab для Windows, macOS и Linux появятся на этой странице после первого выпуска. До тех пор dtlab собирают из исходников курса. Для этого нужны Git и Go: Go ставится с сайта go.dev. Затем в терминале выполните:\n\n\`\`\`${os === 'windows' ? 'powershell' : 'bash'}\ngit clone ${DTLAB_REPO}.git\ncd devops-trainer/lab\ngo build -o ${exe} ./cmd/dtlab\n${run}\n\`\`\`\n\nКоманда \`go build\` собирает программу из исходников в один файл, а \`install\` копирует его в каталог лаборатории и добавляет в PATH. После этого откройте новое окно терминала, и команда \`dtlab\` заработает из любой папки.`,
    `Ready-made dtlab files for Windows, macOS and Linux will appear on this page after the first release. Until then dtlab is built from the course’s sources. You need Git and Go, which installs from go.dev. Then run in a terminal:\n\n\`\`\`${os === 'windows' ? 'powershell' : 'bash'}\ngit clone ${DTLAB_REPO}.git\ncd devops-trainer/lab\ngo build -o ${exe} ./cmd/dtlab\n${run}\n\`\`\`\n\n\`go build\` builds the program from the sources into one file, and \`install\` copies it into the lab’s directory and adds it to the PATH. Then open a new terminal window, and the \`dtlab\` command works from any folder.`,
  );
}

const UNINSTALL_QEMU: Record<LabOS, string> = {
  windows: 'winget uninstall SoftwareFreedomConservancy.QEMU',
  macos: 'brew uninstall qemu',
  linux: 'sudo apt remove qemu-system-x86 qemu-utils ovmf',
};

const START = bi(
  'Когда dtlab установлен, сначала проверьте компьютер:\n\n```bash\ndtlab check\n```\n\nКоманда смотрит на систему, процессор, память, свободное место и гипервизор, сообщает, чего не хватает и как это поставить, и называет самый крупный профиль, который поместится на этом компьютере. Если язык системы русский, dtlab отвечает по-русски. На Mac с 16 ГБ памяти ответ выглядит так:\n\n```text\nкомпьютер:    darwin arm64 (macOS 26.4), ядер процессора: 10, Apple M4\nпамять:       16384 МиБ, сейчас свободно 9120 МиБ\nдиск:         свободно 60,0 ГиБ в /Users/olga/.dtlab\nгипервизор:   Hypervisor.framework\nзапуск машин: qemu — macOS: QEMU на Hypervisor.framework запускает и kuberoot, и Ubuntu, на Mac с процессорами Intel и Apple\nпрофиль:      standard (подходят: light, standard)\n              для компьютера с 16 ГБ памяти: машина ученика, кластер kuberoot и два узла Ubuntu для kubeadm\n\nдальше:       dtlab up --profile standard\n```\n\n- Строки «компьютер», «память» и «диск» показывают, что нашёл dtlab: систему, процессор, память всего и свободную сейчас и место на диске в папке, где лаборатория будет хранить машины. Мебибайт (МиБ) почти равен мегабайту, а гибибайт (ГиБ) — гигабайту; 1024 МиБ составляют 1 ГиБ.\n- «Гипервизор» — это часть системы, которая запускает виртуальные машины. Если его нет, в этой строке сказано, что включить.\n- «Запуск машин» называет программу, которой dtlab запустит машины, обычно QEMU.\n- Строка «не хватает» появляется, только если не найдена нужная программа, и в скобках стоит команда, которая её ставит.\n- «Профиль» называет самый крупный размер лаборатории для этого компьютера, а строки под ним объясняют выбор. Если подходящего профиля нет, там сказано, чего не хватило, например места на диске, и что с этим сделать.\n- «Дальше» — команда, которую выполнить следующей.\n\nЕсли язык системы не русский, те же строки называются computer, memory, disk, hypervisor, backend, missing, profile и next. Профиль задаёт размер лаборатории: `light` запускает машину ученика и кластер kuberoot и помещается в 8 ГБ памяти, а `standard` добавляет управляющий и рабочий узлы kubeadm и требует 16 ГБ. Запустите лабораторию с выбранным профилем:\n\n```bash\ndtlab up --profile light\ndtlab up --profile standard\n```\n\nКоманда `dtlab up` без `--profile` берёт профиль, который посоветовал `dtlab check`. При первом запуске лаборатория скачивает образы Ubuntu и kuberoot, около 600 МБ, а потом ждёт, пока все машины будут готовы. Экзамену k8s-2 нужны три узла kubeadm, и на компьютере с 16 ГБ памяти их запускают отдельно, без машины ученика и без kuberoot: `dtlab up --profile full --with kubeadm-nodes`.\n\nКогда лаборатория запущена, `dtlab status` показывает машины, их адреса и то, работают ли они, а `dtlab ssh learner` или `dtlab ssh cp-1` открывает терминал на выбранной машине. Для кластера kuberoot на вашем компьютере есть готовый файл настроек kubectl:\n\n```bash\nkubectl --kubeconfig ~/.dtlab/config/kuberoot.kubeconfig get nodes\n```',
  'Once dtlab is installed, check the computer first:\n\n```bash\ndtlab check\n```\n\nThe command looks at the system, processor, memory, free space and hypervisor, tells you what is missing and how to install it, and names the largest profile that fits this computer. On a Mac with 16 GB of memory the answer looks like this:\n\n```text\ncomputer:   darwin arm64 (macOS 26.4), 10 CPUs, Apple M4\nmemory:     16384 MiB, 9120 MiB free now\ndisk:       60.0 GiB free at /Users/olga/.dtlab\nhypervisor: Hypervisor.framework\nbackend:    qemu — macOS: QEMU on Hypervisor.framework boots both kuberoot\'s EFI media and Ubuntu cloud images, on Intel and Apple Silicon\nprofile:    standard (fits: light, standard)\n            16 GB computers: the learner VM, kuberoot and two Ubuntu nodes for kubeadm\n\nnext:       dtlab up --profile standard\n```\n\n- `computer`, `memory` and `disk` show what dtlab found: the system, the processor, the memory in all and free now, and the free space in the folder where the lab keeps its machines.\n- `hypervisor` is the part of the system that runs virtual machines. Without one, the line says what to turn on.\n- `backend` names the program dtlab runs the machines with, usually QEMU.\n- `missing` appears only when a needed program is not found, with the command that installs it in brackets.\n- `profile` names the largest lab size for this computer, and the lines under it explain the choice. Without a fitting profile they say what was short, such as disk space, and what to do about it.\n- `next` is the command to run next.\n\nWith a Russian system language the same lines come in Russian. The profile sets the size of the lab: `light` runs the learner machine and the kuberoot cluster and fits in 8 GB of memory, while `standard` adds a kubeadm control plane and worker and needs 16 GB. Start the lab with the chosen profile:\n\n```bash\ndtlab up --profile light\ndtlab up --profile standard\n```\n\n`dtlab up` without `--profile` takes the profile `dtlab check` recommended. On the first start the lab downloads the Ubuntu and kuberoot images, about 600 MB, and then waits until all machines are ready. The k8s-2 exam needs three kubeadm nodes, and on a computer with 16 GB of memory they are started on their own, without the learner machine and kuberoot: `dtlab up --profile full --with kubeadm-nodes`.\n\nWhile the lab runs, `dtlab status` shows the machines, their addresses and whether they are running, and `dtlab ssh learner` or `dtlab ssh cp-1` opens a terminal on the chosen machine. For the kuberoot cluster your computer has a ready kubectl settings file:\n\n```bash\nkubectl --kubeconfig ~/.dtlab/config/kuberoot.kubeconfig get nodes\n```',
);

const FACTS = bi(
  'Экзамен на настоящих машинах просит запустить на машине скрипт проверки, который ничего не меняет, а только читает, и вставить напечатанный им блок в поле экзамена. В лаборатории оба шага делает одна команда `dtlab facts`. Ей передают имя машины и одноразовый код попытки со страницы экзамена, а для экзаменов по Linux и сетям ещё имя машины экзамена, трек и аргументы скрипта, которые указаны на той же странице:\n\n```bash\ndtlab facts cp-1 --nonce <код со страницы экзамена>\ndtlab facts learner --nonce <код> --machine app-01 --track linux-disk --arg \'--scope mounts\'\ndtlab facts kr-1 --nonce <код>\n```\n\nКоманда печатает тот же блок, который вы вставили бы руками, и его остаётся скопировать в поле экзамена. Какая машина лаборатории служит какой машиной экзамена, какой командой запустить нужные машины и как на них войти, написано на странице каждого экзамена в разделе «Что заказать».',
  'An exam on real machines asks you to run a check script on the machine, which changes nothing and only reads, and to paste the block it prints into the exam’s box. In the lab both steps are done by one command, `dtlab facts`. It takes the machine’s name and the attempt’s one-time code from the exam page, and for the Linux and Networks exams also the exam’s machine name, track and the script arguments shown on the same page:\n\n```bash\ndtlab facts cp-1 --nonce <code from the exam page>\ndtlab facts learner --nonce <code> --machine app-01 --track linux-disk --arg \'--scope mounts\'\ndtlab facts kr-1 --nonce <code>\n```\n\nThe command prints the same block you would paste by hand, and all that is left is to copy it into the exam’s box. Which lab machine plays which exam machine, which command starts the machines needed and how to get into them is on each exam’s page, under “What to order”.',
);

const REMOVE_ALL = bi(
  'Флаг `--yes` отвечает на вопрос `dtlab uninstall` «да» за вас, а в отчёте после удаления команда называет освободившееся место. QEMU, который вы ставили сами, и ваш собственный Hyper-V команда не трогает, если вы не скажете иначе. Если что-то пошло не так, удаление каталога `~/.dtlab` или `%LOCALAPPDATA%\\dtlab` тоже убирает лабораторию целиком.\n\nЧтобы убрать с компьютера и QEMU, удалите его тем же способом, которым ставили:',
  'The `--yes` flag answers “yes” to the question of `dtlab uninstall` for you, and the report after the removal names the space freed. A QEMU you installed yourself and your own Hyper-V stay untouched unless you say otherwise. If something went wrong, deleting the directory `~/.dtlab` or `%LOCALAPPDATA%\\dtlab` also removes the whole lab.\n\nTo remove QEMU from the computer too, uninstall it the same way you installed it:',
);

const PATH_NOTE = bi(
  'В инструкциях встретится слово PATH. Так называется список папок, в которых система ищет программу, когда вы набираете её имя в терминале. Когда папка с dtlab попадает в этот список, команда `dtlab` работает из любой папки.',
  'The instructions mention the PATH: the list of folders where the system looks for a program when you type its name in a terminal. Once the folder with dtlab is on that list, the `dtlab` command works from any folder.',
);

const OFFLINE = bi(
  'Курс можно читать и без сети. Скачайте его и запустите локальный сайт:\n\n```sh\ndtlab courses\ndtlab course install academy v86\ndtlab serve\n```\n\nи откройте http://127.0.0.1:7788/. Пакет `academy` — это сам курс, а `v86` — машины с настоящим Linux, которые работают во вкладке. Пакет `v86` занимает около 325 МБ, и без него уроки и экзамены с такими машинами в копии без сети не запустятся. Если он не нужен, ставьте только `academy`. Для чтения курса QEMU не нужен.',
  'The course can be read without a network. Download it and start the local site:\n\n```sh\ndtlab courses\ndtlab course install academy v86\ndtlab serve\n```\n\nthen open http://127.0.0.1:7788/. The `academy` package is the course itself, and `v86` holds the real Linux machines that run in the tab. `v86` takes about 325 MB, and without it the lessons and exams with such machines do not start in the offline copy. If you do not need them, install `academy` alone. Reading the course does not require QEMU.',
);

const sec = (id: string, title: Bi, ...body: (Node | null)[]) => h('section.ll-sec', { id: `ll-${id}` }, h('h2', {}, t(title)), ...body);

function needsTable(): HTMLElement {
  const cell = (b: Bi | string) => h('td', {}, ...prose(typeof b === 'string' ? b : t(b), 'll-cell').childNodes);
  return h(
    'div.ll-table-wrap',
    { tabindex: 0, role: 'region', 'aria-label': t(bi('Что нужно компьютеру', 'What your computer needs')) },
    h(
      'table.ll-table',
      {},
      h('thead', {}, h('tr', {}, ...[bi('Что вы делаете', 'What you do'), bi('Память', 'Memory'), bi('Ядра', 'CPU cores'), bi('Свободный диск', 'Free disk'), bi('Замерено', 'Measured')].map((c) => h('th', { scope: 'col' }, t(c))))),
      h('tbody', {}, ...NEEDS.map((r) => h('tr', {}, cell(r.what), cell(r.mem), cell(r.cores), cell(r.disk), cell(r.measured)))),
    ),
  );
}

function osBlock(os: LabOS, open: boolean): HTMLElement {
  const files = DTLAB_RELEASE.published
    ? h('ul.ll-files', {}, ...DTLAB_RELEASE.assets[os].map((f) => h('li', {}, h('a', { href: assetUrl(f.file), rel: 'noopener' }, h('code', {}, f.file)), ` — ${t(f.label)}`)))
    : null;
  return h(
    'details.ll-os',
    { 'data-os': os, open },
    h('summary', {}, t(OS_TITLE[os])),
    h('h3', {}, t(bi('Шаг 1. Гипервизор и QEMU', 'Step 1. The hypervisor and QEMU'))),
    prose(HYPERVISOR[os]),
    h('h3', {}, t(bi('Шаг 2. Программа dtlab', 'Step 2. The dtlab program'))),
    DTLAB_RELEASE.published && DTLAB_RELEASE.installersPublished[os] ? prose(installerSteps(os)) : null,
    DTLAB_RELEASE.published && DTLAB_RELEASE.installersPublished[os] ? h('h4', {}, t(bi('Отдельный файл программы вместо установщика', 'Plain binary alternative'))) : null,
    prose(DTLAB_RELEASE.published ? downloadSteps(os) : buildSteps(os)),
    files,
  );
}

export function localLabPage(): Page {
  const title = LOCAL_LAB_LINK;
  setTitle(t(title));
  const mine = guessOS();
  const order: LabOS[] = [mine, ...(['windows', 'macos', 'linux'] as LabOS[]).filter((o) => o !== mine)];
  const el = h(
    'div.local-lab',
    {},
    h('h1', {}, t(title)),
    prose(INTRO, 'prose.lede'),
    sec('what', bi('Что запускает лаборатория', 'What the lab runs'), prose(WHAT)),
    sec('needs', bi('Что нужно компьютеру', 'What your computer needs'), needsTable(), prose(NEEDS_NOTE)),
    sec(
      'install',
      bi('Как поставить лабораторию', 'How to install the lab'),
      h('p', {}, t(bi('Выберите свою систему. Инструкция для системы, в которой открыт этот браузер, уже раскрыта.', 'Choose your system. The instructions for the system this browser runs on are already open.'))),
      prose(PATH_NOTE),
      ...order.map((os) => osBlock(os, os === mine)),
      h('h3', {}, t(bi('Шаг 3. Проверка и запуск', 'Step 3. The check and the start'))),
      prose(START),
    ),
    sec(
      'offline',
      bi('Курс без интернета', 'The course without the internet'),
      prose(OFFLINE),
      DTLAB_RELEASE.coursesPublished ? null : prose(bi('Эти команды установки курса станут доступны после публикации каталога в выпуске GitHub.', 'These course installation commands become available once the catalog is published in a GitHub release.')),
    ),
    sec('facts', bi('Как сдать экзамен на машинах лаборатории', 'How to take an exam on the lab’s machines'), prose(FACTS)),
    sec(
      'remove',
      bi('Как остановить и удалить лабораторию', 'How to stop and remove the lab'),
      h(
        'div.ll-table-wrap',
        {},
        h(
          'table.ll-table.ll-remove',
          {},
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t(bi('Команда', 'Command'))), h('th', { scope: 'col' }, t(bi('Что она делает', 'What it does'))))),
          h('tbody', {}, ...LAB_REMOVAL.map((r) => h('tr', {}, h('td', {}, h('code', {}, r.cmd)), h('td', {}, ...prose(t(r.what), 'll-cell').childNodes)))),
        ),
      ),
      prose(REMOVE_ALL),
      h('ul.ll-qemu', {}, ...(['windows', 'macos', 'linux'] as LabOS[]).map((os) => h('li', {}, `${t(OS_TITLE[os])}: `, h('code', {}, UNINSTALL_QEMU[os])))),
      prose(bi('Платформу низкоуровневой оболочки Windows выключают той же галочкой в компонентах Windows, которой её включали.', 'The Windows Hypervisor Platform is turned off with the same tick in Windows features that turned it on.')),
    ),
    prose(bi(`Исходники и подробное описание лаборатории лежат в каталоге [lab](${DTLAB_REPO}/tree/main/lab) репозитория курса.`, `The lab’s sources and a detailed description are in the [lab](${DTLAB_REPO}/tree/main/lab) directory of the course repository.`), 'prose.small.muted'),
  );
  return { el };
}
