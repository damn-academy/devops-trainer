// m01. Why containers: bare metal → VMs → containers → today's nesting (04 §4.3).

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { dockerHost, RU, SRC, web } from '../shared';

export const whyQuiz: QuizItem[] = [
  {
    id: 'containers.q.vm-vs-ct',
    kind: 'mcq',
    key: true,
    concepts: ['docker.vm-vs-container', 'docker.container'],
    prompt: bi('Вопрос с собеседования: чем контейнер отличается от виртуальной машины?', 'An interview question: how does a container differ from a virtual machine?'),
    options: [
      { id: 'kernel', text: bi('Контейнер — процесс хоста в своих пространствах имён и cgroup, ядро у всех контейнеров одно; ВМ несёт своё ядро и работает на виртуальном железе гипервизора', 'A container is a host process in its own namespaces and cgroup, and all containers share one kernel; a VM carries its own kernel and runs on the hypervisor’s virtual hardware'), correct: true, why: bi('Это и есть ответ через namespaces и cgroups, который ждут на собеседовании; дальше — следствия: размер, скорость старта, плотность, сила изоляции.', 'This is the answer through namespaces and cgroups an interviewer waits for; then the consequences: size, start time, density, strength of isolation.') },
      { id: 'light-vm', text: bi('Контейнер — это облегчённая виртуальная машина', 'A container is a lightweight virtual machine'), why: bi('Частая ошибка: у контейнера нет ни виртуального железа, ни своего ядра. Это процесс, а не машина.', 'A common mistake: a container has neither virtual hardware nor a kernel of its own. It is a process, not a machine.') },
      { id: 'virt-kernel', text: bi('Docker виртуализирует ядро, поэтому каждому контейнеру достаётся своё', 'Docker virtualises the kernel, so each container gets its own'), why: bi('Ядро не виртуализируется: `uname -r` в контейнере и на хосте покажет одно и то же.', 'The kernel is not virtualised: `uname -r` in a container and on the host shows the same.') },
      { id: 'image', text: bi('ВМ запускается из образа, а контейнер — нет', 'A VM starts from an image and a container does not'), why: bi('Наоборот, контейнеры запускают из образов; у ВМ образ диска тоже есть. Разница не в образе, а в ядре.', 'On the contrary, containers start from images; VMs have disk images too. The difference is the kernel, not the image.') },
    ],
    explain: bi('Ответ по схеме «что это → как работает → следствия → когда что». Контейнер изолирует слабее (граница внутри одного ядра), но лёгок и быстр; ВМ тяжелее, зато со своим ядром и гипервизором между арендаторами.', 'Answer by the scheme “what it is → how it works → consequences → when to use which”. A container isolates less strongly (the boundary is inside one kernel) but is light and fast; a VM is heavier, but has its own kernel and a hypervisor between tenants.'),
    refs: { lesson: 'containers.why', explainer: 'containers.stack' },
  },
  {
    id: 'containers.q.windows',
    kind: 'mcq',
    concepts: ['docker.container'],
    prompt: bi('Можно ли запустить в контейнере на Linux-хосте программу для Windows без виртуальной машины?', 'Can a Windows program run in a container on a Linux host without a virtual machine?'),
    options: [
      { id: 'no', text: bi('Нет: контейнер использует ядро хоста, а это ядро Linux', 'No: a container uses the host kernel, and it is a Linux kernel'), correct: true },
      { id: 'image', text: bi('Да, если взять образ с Windows', 'Yes, with a Windows image'), why: bi('Образ — это файлы, а не ядро. Программе Windows нужно ядро Windows; здесь его нет.', 'An image is files, not a kernel. A Windows program needs a Windows kernel; there is none here.') },
      { id: 'flag', text: bi('Да, с флагом --platform windows', 'Yes, with the --platform windows flag'), why: bi('--platform выбирает вариант образа, но не может дать контейнеру другое ядро.', '--platform picks an image variant; it cannot give a container another kernel.') },
    ],
    explain: bi('Поэтому программы, которым нужно своё ядро или другая ОС, запускают в ВМ — в том числе в ВМ внутри Kubernetes через KubeVirt.', 'That is why programs that need their own kernel or another OS run in VMs — including VMs inside Kubernetes through KubeVirt.'),
  },
  {
    id: 'containers.q.faster',
    kind: 'multi',
    concepts: ['docker.vm-vs-container'],
    prompt: bi('Почему новый контейнер стартует за доли секунды, а новая ВМ — за десятки секунд? Отметьте всё верное.', 'Why does a new container start in a fraction of a second and a new VM in tens of seconds? Mark everything true.'),
    options: [
      { id: 'nokernel', text: bi('Контейнеру не нужно загружать ядро: оно уже работает', 'A container does not boot a kernel: it is already running'), correct: true },
      { id: 'noos', text: bi('Не стартуют службы гостевой ОС: запускается один процесс', 'No guest OS services start: one process starts'), correct: true },
      { id: 'cache', text: bi('Docker держит контейнеры в кэше заранее запущенными', 'Docker keeps containers cached and pre-started'), why: bi('Нет такого кэша: каждый `docker run` создаёт новый процесс.', 'There is no such cache: every `docker run` creates a new process.') },
      { id: 'smaller', text: bi('Образы меньше, поэтому быстрее читаются с диска', 'Images are smaller, so they are read from disk faster'), why: bi('Размер помогает при скачивании, но главное — нет загрузки ядра и ОС.', 'Size helps when downloading, but the main thing is: no kernel or OS to boot.') },
    ],
  },
  {
    id: 'containers.q.kubevirt-order',
    kind: 'order',
    concepts: ['docker.vm', 'docker.container'],
    prompt: bi('Соберите башню «ВМ внутри Kubernetes» снизу вверх.', 'Build the “VM inside Kubernetes” tower from the bottom up.'),
    steps: [
      { id: 'hw', text: bi('железо', 'hardware') },
      { id: 'kernel', text: bi('ядро узла и kubelet', 'the node kernel and kubelet') },
      { id: 'pod', text: bi('под virt-launcher (контейнер)', 'the virt-launcher pod (a container)'), why: bi('ВМ в KubeVirt — процесс внутри контейнера пода, поэтому под идёт раньше гипервизора.', 'In KubeVirt a VM is a process inside a pod container, so the pod comes before the hypervisor.') },
      { id: 'qemu', text: 'QEMU / KVM' },
      { id: 'guest', text: bi('ядро гостя', 'the guest kernel') },
      { id: 'app', text: bi('приложение', 'the application') },
    ],
    explain: bi('В этой башне два ядра: узла и гостя. Kubernetes планирует ВМ как под, а гостевое ядро даёт приложению свою ОС.', 'This tower has two kernels: the node’s and the guest’s. Kubernetes schedules the VM like a pod, and the guest kernel gives the application its own OS.'),
  },
  {
    id: 'containers.q.boundary-where',
    kind: 'mcq',
    concepts: ['docker.vm-vs-container'],
    prompt: bi('В ядре хоста нашли уязвимость, позволяющую процессу выйти за свои пределы. Что под угрозой?', 'A host kernel vulnerability lets a process escape its limits. What is at risk?'),
    options: [
      { id: 'all-ct', text: bi('Все контейнеры этого хоста', 'All containers on this host'), correct: true },
      { id: 'one-ct', text: bi('Только контейнер, где запущен вредный код', 'Only the container running the malicious code'), why: bi('Граница контейнеров проходит внутри ядра: уязвимость в нём — это дыра в границе для всех.', 'The containers’ boundary runs inside the kernel: a hole in it is a hole in the boundary for everyone.') },
      { id: 'none', text: bi('Ничего: namespaces защищают от этого', 'Nothing: namespaces protect against it'), why: bi('Namespaces — механизм того же ядра; уязвимость ядра обходит и их.', 'Namespaces are a mechanism of the same kernel; a kernel vulnerability bypasses them too.') },
    ],
    explain: bi('Поэтому недоверенный код запускают в ВМ или песочницах (gVisor, Kata Containers), а контейнеры одной команды можно плотно класть на одно ядро.', 'That is why untrusted code runs in VMs or sandboxes (gVisor, Kata Containers), while one team’s containers can be packed densely on one kernel.'),
  },
];

export const whyLesson: Lesson = {
  id: 'containers.why',
  block: 'containers',
  title: bi('Зачем контейнеры: железо, ВМ, контейнер и вложенность', 'Why containers: bare metal, VMs, containers and nesting'),
  summary: bi('Почему одну и ту же программу удобно запускать в контейнере, чем это отличается от виртуальной машины и как их сегодня вкладывают друг в друга.', 'Why it is handy to run a program in a container, how that differs from a virtual machine and how the two are nested today.'),
  introduces: ['docker.env-problem', 'docker.vm', 'docker.container', 'docker.vm-vs-container'],
  uses: [],
  tier: 'core',
  minutes: 35,
  sources: {
    en: [SRC.whatIsContainer, SRC.namespaces, SRC.cgroups, SRC.kubevirt, SRC.cozystack],
    ru: [RU.vm, RU.hypervisor, RU.containerisation, SRC.k8sRuContainers],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'На сервере компании работают два приложения: старое, которому нужна библиотека libssl версии 1.1, и новое, которому нужна 3.0. Обе берут её из одного и того же каталога `/usr/lib`. Ставишь новую версию для нового приложения — падает старое. Откатываешь — не запускается новое. Разработчик разводит руками: «у меня работает». У него на ноутбуке своя система и свои версии.\n\nЭта глава отвечает на вопрос, который вы зададите себе сами: **почему одну и ту же программу на одном сервере удобнее запускать в контейнере, а не просто так?**',
        'A company server runs two applications: an old one that needs version 1.1 of the libssl library and a new one that needs 3.0. Both take it from the same `/usr/lib` directory. Install the new version for the new application and the old one falls over. Roll back and the new one does not start. The developer shrugs: “it works on my machine”. His laptop has its own system and its own versions.\n\nThis chapter answers a question you will ask yourself: **why is it more convenient to run a program in a container on a server, rather than just running it?**',
      ),
    },
    {
      id: 'problem',
      kind: 'text',
      step: 'explain',
      title: bi('Проблема окружений', 'The environment problem'),
      body: bi(
        'Программа почти никогда не работает одна. Ей нужны библиотеки определённых версий, интерпретатор (Python 3.13, а не 3.9), файлы настроек в определённых местах, переменные окружения. Всё вместе это называют **окружением** программы. Когда на одной системе живут несколько программ, они делят одно окружение, и требования одной рано или поздно противоречат требованиям другой. Это и есть [[docker.env-problem|проблема окружений]]: «у меня работает» значит «в моём окружении работает».\n\nЕсть два способа дать каждой программе своё окружение. Первый — дать ей отдельный компьютер. Второй — оставить компьютер общим, но сделать так, чтобы программа видела только «своё». Первый способ ведёт к виртуальным машинам, второй — к контейнерам.',
        'A program almost never works alone. It needs libraries of particular versions, an interpreter (Python 3.13, not 3.9), configuration files in particular places, environment variables. All of that together is called the program’s **environment**. When several programs live on one system they share one environment, and sooner or later the needs of one contradict the needs of another. That is the [[docker.env-problem|environment problem]]: “it works on my machine” means “it works in my environment”.\n\nThere are two ways to give each program its own environment. The first is to give it a separate computer. The second is to keep the computer shared but make the program see only “its own”. The first way leads to virtual machines, the second to containers.',
      ),
    },
    {
      id: 'vm',
      kind: 'text',
      step: 'explain',
      title: bi('Первое решение: виртуальная машина', 'The first solution: a virtual machine'),
      body: bi(
        'Отдельный физический сервер на каждое приложение — дорого: большую часть времени железо простаивает. Поэтому придумали **гипервизор** — программу, которая делит один физический сервер на несколько виртуальных. Каждой [[docker.vm|виртуальной машине]] (ВМ) гипервизор показывает свои процессоры, память, диск и сетевую карту; внутри ставится полноценная операционная система со своим ядром. Приложение A живёт в одной ВМ, B — в другой, и их библиотеки больше не встречаются.\n\nЦена у этого решения двойная. Каждая ВМ несёт свою ОС: гигабайт памяти и несколько гигабайт диска ещё до того, как запустилось приложение. И каждая ВМ при старте загружает ядро и системные службы — это десятки секунд. Гипервизоры бывают двух типов: тип 1 работает прямо на железе (VMware ESXi, Xen, KVM в ядре Linux), тип 2 — как обычная программа внутри другой ОС (VirtualBox на ноутбуке).',
        'A separate physical server for each application is expensive: most of the time the hardware is idle. So the **hypervisor** was invented — a program that divides one physical server into several virtual ones. To each [[docker.vm|virtual machine]] (VM) the hypervisor shows its own CPUs, memory, disk and network card; a complete operating system with its own kernel is installed inside. Application A lives in one VM, B in another, and their libraries never meet again.\n\nThis solution has a double price. Every VM carries its own OS: a gigabyte of memory and several gigabytes of disk before the application has even started. And every VM boots a kernel and system services when it starts — tens of seconds. Hypervisors come in two types: type 1 runs on the hardware itself (VMware ESXi, Xen, KVM in the Linux kernel), type 2 as an ordinary program inside another OS (VirtualBox on a laptop).',
      ),
    },
    {
      id: 'container',
      kind: 'text',
      step: 'explain',
      title: bi('Второе решение: контейнер', 'The second solution: a container'),
      body: bi(
        'В блоке Linux вы уже собрали все детали второго решения, только не называли их вместе. Пространства имён (namespaces) показывают процессу свой список процессов, своё имя машины, свою сеть и своё дерево файлов. Группа cgroup ограничивает, сколько памяти и процессора он может взять. Смена корня даёт ему свой набор файлов — со своими библиотеками. [[docker.container|Контейнер]] — это ровно их сочетание: **обычный процесс хоста, которому ядро показывает «своё» и ограничивает ресурсы**. Ядро одно на все контейнеры.\n\nИз этого определения следует всё остальное. Своего ядра у контейнера нет, поэтому загружать нечего: запуск — это создание процесса, доли секунды. Гостевой ОС тоже нет, поэтому контейнер занимает столько памяти, сколько само приложение, плюс несколько мегабайт. В контейнере A лежит libssl 1.1, в контейнере B — 3.0, и они не мешают друг другу.\n\nПосмотрите на это в объяснителе ниже. Двигайте число приложений: башня виртуальных машин упирается в память гораздо раньше башни контейнеров.',
        'In the Linux block you already assembled every part of the second solution, you just did not name them together. Namespaces show a process its own list of processes, its own machine name, its own network and its own file tree. A cgroup limits how much memory and CPU it may take. A change of root gives it its own set of files — with its own libraries. A [[docker.container|container]] is exactly their combination: **an ordinary host process that the kernel shows “its own” and limits in resources**. One kernel for all containers.\n\nEverything else follows from this definition. A container has no kernel of its own, so there is nothing to boot: starting it is creating a process, a fraction of a second. There is no guest OS either, so a container takes as much memory as the application itself, plus a few megabytes. Container A holds libssl 1.1, container B holds 3.0, and they do not get in each other’s way.\n\nLook at this in the explainer below. Move the number of applications: the tower of virtual machines hits the memory limit much earlier than the tower of containers.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.stack', caption: bi('Пройдите шаги, подвигайте ползунок, включите уязвимость в ядре. Любой блок открывает карточку.', 'Walk the steps, move the slider, switch on the kernel vulnerability. Any block opens a card.') },
    {
      id: 'compare',
      kind: 'text',
      step: 'explain',
      title: bi('Контейнер против ВМ', 'Container against VM'),
      body: bi(
        'Сравним по пунктам — именно это спросят на собеседовании.\n\n- **Ядро.** У ВМ своё, у контейнера общее с хостом. Отсюда главное следствие: программу, которой нужно другое ядро или другая ОС (например, для Windows), в контейнере на Linux не запустить.\n- **Изоляция.** Граница ВМ — гипервизор и её собственное ядро. Граница контейнера проходит внутри одного ядра: уязвимость в ядре — общая беда всех контейнеров хоста. Поэтому чужой, недоверенный код запускают в ВМ или в песочницах вроде gVisor и Kata Containers.\n- **Размер и плотность.** ВМ — это ОС плюс приложение, контейнер — приложение и его файлы. На том же сервере контейнеров помещается в разы больше.\n- **Старт.** ВМ загружает ядро и службы — десятки секунд; контейнер — это процесс, доли секунды.\n\nКраткий итог для собеседования: [[docker.vm-vs-container|контейнер против ВМ]] — это выбор между лёгкостью и силой изоляции, и в жизни их часто используют вместе.',
        'Let us compare point by point — this is exactly what an interview asks.\n\n- **Kernel.** A VM has its own; a container shares the host’s. The main consequence: a program that needs another kernel or another OS (a Windows one, say) cannot run in a container on Linux.\n- **Isolation.** A VM’s boundary is the hypervisor and its own kernel. A container’s boundary runs inside one kernel: a kernel vulnerability is a shared trouble for every container on the host. That is why untrusted code runs in VMs or in sandboxes such as gVisor and Kata Containers.\n- **Size and density.** A VM is an OS plus an application; a container is the application and its files. Many times more containers fit on the same server.\n- **Start.** A VM boots a kernel and services — tens of seconds; a container is a process — a fraction of a second.\n\nA short summary for the interview: [[docker.vm-vs-container|container versus VM]] is a choice between lightness and strength of isolation, and in real life they are often used together.',
      ),
    },
    {
      id: 'nesting',
      kind: 'text',
      step: 'explain',
      title: bi('Сегодня их вкладывают друг в друга', 'Today they are nested in each other'),
      body: bi(
        'В облаке вы почти всегда работаете с обоими. Провайдер делит свои серверы гипервизором и выдаёт клиенту ВМ, а клиент запускает в этой ВМ контейнеры — так устроен почти любой управляемый Kubernetes. Компания со своим железом ставит Kubernetes прямо на серверы, и контейнеры работают на ядре узла без всякого гипервизора. А когда рядом с контейнерами нужна полноценная ВМ — например, для программы под Windows, — её запускают внутри Kubernetes через KubeVirt: гипервизор QEMU работает как процесс в контейнере, и Kubernetes планирует ВМ как обычный под. Так платформа Cozystack выдаёт ВМ своим пользователям.\n\nВывод, который стоит запомнить: контейнер и ВМ — не соперники, а слои, которые вкладывают друг в друга по нужде изоляции.',
        'In the cloud you almost always work with both. A provider divides its servers with a hypervisor and gives the customer a VM, and the customer runs containers in that VM — almost every managed Kubernetes works this way. A company with its own hardware installs Kubernetes straight on the servers, and containers run on the node kernel without any hypervisor. And when a full VM is needed next to the containers — for a Windows program, say — it runs inside Kubernetes through KubeVirt: the QEMU hypervisor runs as a process in a container, and Kubernetes schedules the VM like an ordinary pod. This is how the Cozystack platform gives VMs to its users.\n\nThe conclusion worth remembering: containers and VMs are not rivals but layers nested in each other as isolation requires.',
      ),
    },
    { id: 'look-nesting', kind: 'explainer', step: 'look', explainer: 'containers.nesting', caption: bi('Выберите, что нужно запустить, — и посмотрите, в какую башню это пойдёт.', 'Choose what has to run — and see which tower it goes to.') },
    {
      id: 'programmer',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы программист', 'If you are a programmer'),
      body: bi('Контейнер = `fork` + `unshare` (новые пространства имён) + запись PID в `cgroup.procs` + `pivot_root` в подготовленный корень + `execve`. Никакой эмуляции: это системные вызовы того же ядра. Следующая глава разбирает, кто именно делает эти вызовы, когда вы пишете `docker run`.', 'A container = `fork` + `unshare` (new namespaces) + writing the PID into `cgroup.procs` + `pivot_root` into a prepared root + `execve`. No emulation: these are system calls of the same kernel. The next chapter takes apart who exactly makes these calls when you type `docker run`.'),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: dockerHost(),
      intro: bi('Машина в симуляторе с Docker. Команды `docker` подробно разберём через две главы; сейчас достаточно повторить их и посмотреть на результат.', 'A simulated machine with Docker. We take the `docker` commands apart in two chapters; for now it is enough to repeat them and look at the result.'),
      tasks: [
        {
          id: 'one-kernel',
          prompt: bi('Узнайте версию ядра хоста (`uname -r`), а потом выполните ту же команду внутри контейнера: `docker run --rm alpine:3.22 uname -r`. Сравните.', 'Find the host kernel version (`uname -r`), then run the same command inside a container: `docker run --rm alpine:3.22 uname -r`. Compare.'),
          check: { when: "docker.events[action=start]", stdout: '6.12.0-dt-sim' },
          chips: 'docker run --rm alpine:3.22 uname -r',
          concepts: ['docker.container'],
          docRef: web('get-started/docker-concepts/the-basics/what-is-a-container', 'containers-vs-vms', 'share the same kernel'),
          hints: { H1: bi('Версия ядра одна и та же — потому что ядро одно.', 'The kernel version is the same — because there is one kernel.') },
        },
        {
          id: 'other-files',
          prompt: bi('А теперь файлы: на хосте `cat /etc/os-release` покажет Debian. Выполните ту же команду в контейнере alpine — какую систему он «видит»?', 'Now the files: on the host `cat /etc/os-release` shows Debian. Run the same command in an alpine container — which system does it “see”?'),
          check: { when: "docker.events[action=start]", stdout: 'Alpine Linux' },
          chips: 'docker run --rm alpine:3.22 cat /etc/os-release',
          concepts: ['docker.container'],
          hints: { H1: bi('Ядро общее, а файлы — свои: у контейнера свой корень.', 'The kernel is shared, the files are its own: the container has its own root.'), H2: bi('Это команда из предыдущего задания, только вместо `uname -r` — `cat /etc/os-release`.', 'It is the command of the previous task with `cat /etc/os-release` instead of `uname -r`.') },
        },
      ],
    },
    {
      id: 'doc',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте страницу документации Docker «What is a container?». В каком разделе сравниваются контейнеры и ВМ? Нажмите на него.', 'Open the Docker documentation page “What is a container?”. Which section compares containers and VMs? Click it.'),
      ref: web('get-started/docker-concepts/the-basics/what-is-a-container'),
      answer: 'containers-vs-vms',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: whyQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi('Программам нужны свои окружения. ВМ даёт каждой свой компьютер со своим ядром — сильная изоляция, но тяжело и медленно. Контейнер — процесс хоста в своих пространствах имён и cgroup: лёгкий и быстрый, но с общим ядром. Сегодня их вкладывают друг в друга.', 'Programs need their own environments. A VM gives each its own computer with its own kernel — strong isolation, but heavy and slow. A container is a host process in its own namespaces and cgroup: light and fast, but with a shared kernel. Today they are nested in each other.'),
    },
  ],
};
