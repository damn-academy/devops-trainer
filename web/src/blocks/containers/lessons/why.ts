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
    prompt: bi('На собеседовании часто спрашивают, чем контейнер отличается от виртуальной машины. Какой ответ верный?', 'Interviewers often ask how a container differs from a virtual machine. Which answer is right?'),
    options: [
      { id: 'kernel', text: bi('Контейнер — это процесс хоста в своих пространствах имён и своей cgroup, и ядро у всех контейнеров одно; виртуальная машина несёт собственное ядро и работает на виртуальном железе гипервизора', 'A container is a host process in its own namespaces and cgroup, and all containers share one kernel; a VM carries its own kernel and runs on the hypervisor’s virtual hardware'), correct: true, why: bi('Такого ответа, через пространства имён и cgroup, и ждут на собеседовании. Дальше стоит перечислить следствия: размер, скорость запуска, плотность размещения и силу изоляции.', 'This is the answer through namespaces and cgroups an interviewer waits for; then the consequences: size, start time, density, strength of isolation.') },
      { id: 'light-vm', text: bi('Контейнер можно считать облегчённой виртуальной машиной', 'A container can be thought of as a lightweight virtual machine'), why: bi('Это частая ошибка. У контейнера нет ни виртуального железа, ни собственного ядра, потому что он остаётся процессом, а не машиной.', 'A common mistake: a container has neither virtual hardware nor a kernel of its own. It is a process, not a machine.') },
      { id: 'virt-kernel', text: bi('Docker виртуализирует ядро, поэтому каждому контейнеру достаётся своё', 'Docker virtualises the kernel, so each container gets its own'), why: bi('Ядро никто не виртуализирует: команда `uname -r` в контейнере и на хосте покажет одну и ту же версию.', 'The kernel is not virtualised: `uname -r` in a container and on the host shows the same.') },
      { id: 'image', text: bi('Виртуальную машину запускают из образа, а контейнер без образа', 'A VM starts from an image and a container does not'), why: bi('Всё наоборот: контейнеры как раз запускают из образов, а у виртуальной машины тоже есть образ диска. Различаются они не образом, а ядром.', 'On the contrary, containers start from images; VMs have disk images too. The difference is the kernel, not the image.') },
    ],
    explain: bi('Отвечать удобно по плану: что это такое, как оно работает, что из этого следует и когда что выбирать. Контейнер изолирует слабее, потому что граница проходит внутри одного ядра, зато он лёгкий и быстрый. Виртуальная машина тяжелее, но у неё своё ядро, а между арендаторами стоит гипервизор.', 'Answer by the scheme “what it is → how it works → consequences → when to use which”. A container isolates less strongly (the boundary is inside one kernel) but is light and fast; a VM is heavier, but has its own kernel and a hypervisor between tenants.'),
    refs: { lesson: 'containers.why', explainer: 'containers.stack' },
  },
  {
    id: 'containers.q.windows',
    kind: 'mcq',
    concepts: ['docker.container'],
    prompt: bi('Можно ли запустить программу для Windows в контейнере на хосте с Linux, не прибегая к виртуальной машине?', 'Can a Windows program run in a container on a Linux host without a virtual machine?'),
    options: [
      { id: 'no', text: bi('Нет, потому что контейнер работает на ядре хоста, а на этом хосте ядро Linux', 'No, because a container runs on the host kernel, and this host has a Linux kernel'), correct: true },
      { id: 'image', text: bi('Да, если взять образ с Windows', 'Yes, with a Windows image'), why: bi('Образ содержит только файлы, а ядра в нём нет. Программе для Windows нужно ядро Windows, а на этом хосте его нет.', 'An image holds only files and no kernel. A Windows program needs a Windows kernel, and this host has none.') },
      { id: 'flag', text: bi('Да, если указать флаг --platform windows', 'Yes, with the --platform windows flag'), why: bi('Флаг --platform выбирает вариант образа, но дать контейнеру другое ядро он не может.', '--platform picks an image variant; it cannot give a container another kernel.') },
    ],
    explain: bi('Поэтому программы, которым нужно своё ядро или другая операционная система, запускают в виртуальных машинах, в том числе в виртуальных машинах внутри Kubernetes через KubeVirt.', 'That is why programs that need their own kernel or another OS run in VMs — including VMs inside Kubernetes through KubeVirt.'),
  },
  {
    id: 'containers.q.faster',
    kind: 'multi',
    concepts: ['docker.vm-vs-container'],
    prompt: bi('Почему новый контейнер запускается за доли секунды, а новая виртуальная машина за десятки секунд? Отметьте все верные причины.', 'Why does a new container start in a fraction of a second and a new VM in tens of seconds? Mark everything true.'),
    options: [
      { id: 'nokernel', text: bi('Контейнеру не нужно загружать ядро, потому что ядро хоста уже работает', 'A container does not boot a kernel, because the host kernel is already running'), correct: true },
      { id: 'noos', text: bi('Контейнеру не нужно запускать службы гостевой системы, потому что в нём запускается один процесс', 'A container does not start guest OS services, because only one process starts in it'), correct: true },
      { id: 'cache', text: bi('Docker держит контейнеры заранее запущенными в кэше', 'Docker keeps containers cached and pre-started'), why: bi('Такого кэша у Docker нет, и каждая команда `docker run` создаёт новый процесс.', 'Docker has no such cache, and every `docker run` creates a new process.') },
      { id: 'smaller', text: bi('Образы меньше, поэтому они быстрее читаются с диска', 'Images are smaller, so they are read from disk faster'), why: bi('Небольшой размер помогает при скачивании, но главная причина в том, что контейнеру не нужно загружать ни ядро, ни систему.', 'Size helps when downloading, but the main thing is: no kernel or OS to boot.') },
    ],
  },
  {
    id: 'containers.q.kubevirt-order',
    kind: 'order',
    concepts: ['docker.vm', 'docker.container'],
    prompt: bi('Соберите башню «виртуальная машина внутри Kubernetes» снизу вверх.', 'Build the “VM inside Kubernetes” tower from the bottom up.'),
    steps: [
      { id: 'hw', text: bi('железо', 'hardware') },
      { id: 'kernel', text: bi('ядро узла и агент kubelet', 'the node kernel and kubelet') },
      { id: 'pod', text: bi('под virt-launcher, то есть контейнер', 'the virt-launcher pod (a container)'), why: bi('В KubeVirt виртуальная машина работает как процесс внутри контейнера пода, поэтому под стоит ниже гипервизора.', 'In KubeVirt a VM is a process inside a pod container, so the pod comes before the hypervisor.') },
      { id: 'qemu', text: 'QEMU / KVM' },
      { id: 'guest', text: bi('ядро гостевой системы', 'the guest kernel') },
      { id: 'app', text: bi('приложение', 'the application') },
    ],
    explain: bi('В этой башне работают два ядра, ядро узла и ядро гостевой системы. Kubernetes размещает виртуальную машину так же, как обычный под, а гостевое ядро даёт приложению его собственную операционную систему.', 'This tower has two kernels: the node’s and the guest’s. Kubernetes schedules the VM like a pod, and the guest kernel gives the application its own OS.'),
  },
  {
    id: 'containers.q.boundary-where',
    kind: 'mcq',
    concepts: ['docker.vm-vs-container'],
    prompt: bi('В ядре хоста нашли уязвимость, через которую процесс может выйти за свои границы. Что под угрозой?', 'A host kernel vulnerability lets a process escape its limits. What is at risk?'),
    options: [
      { id: 'all-ct', text: bi('Все контейнеры этого хоста', 'All containers on this host'), correct: true },
      { id: 'one-ct', text: bi('Только тот контейнер, где запущен вредный код', 'Only the container running the malicious code'), why: bi('Граница между контейнерами проходит внутри ядра, поэтому дыра в ядре пробивает эту границу сразу для всех контейнеров.', 'The containers’ boundary runs inside the kernel: a hole in it is a hole in the boundary for everyone.') },
      { id: 'none', text: bi('Ничто, потому что от такой уязвимости защищают пространства имён', 'Nothing, because namespaces protect against such a vulnerability'), why: bi('Пространства имён устроены внутри того же ядра, поэтому уязвимость в ядре обходит и их.', 'Namespaces are a mechanism of the same kernel; a kernel vulnerability bypasses them too.') },
    ],
    explain: bi('Поэтому недоверенный код запускают в виртуальных машинах или в песочницах вроде gVisor и Kata Containers, а контейнеры одной команды можно плотно размещать на одном ядре.', 'That is why untrusted code runs in VMs or sandboxes (gVisor, Kata Containers), while one team’s containers can be packed densely on one kernel.'),
  },
];

export const whyLesson: Lesson = {
  id: 'containers.why',
  block: 'containers',
  title: bi('Зачем нужны контейнеры и чем они отличаются от виртуальных машин', 'Why containers: bare metal, VMs, containers and nesting'),
  summary: bi('В этом уроке вы узнаете, почему программу удобно запускать в контейнере, чем контейнер отличается от виртуальной машины и как сегодня их вкладывают друг в друга.', 'In this lesson you will learn why it is handy to run a program in a container, how a container differs from a virtual machine and how the two are nested in each other today.'),
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
        'На сервере компании работают два приложения. Старому нужна библиотека libssl версии 1.1, новому версия 3.0, и оба берут её из одного и того же каталога `/usr/lib`. Стоит поставить новую версию для нового приложения, и перестаёт работать старое; стоит откатить её, и не запускается новое. Разработчик разводит руками и говорит: «У меня всё работает». Дело в том, что на его ноутбуке стоит своя система со своими версиями библиотек.\n\nЭта глава отвечает на вопрос, который вы, скорее всего, уже задали себе сами: **почему программу на сервере удобнее запускать в контейнере, а не устанавливать прямо в систему?**',
        'A company server runs two applications: an old one that needs version 1.1 of the libssl library and a new one that needs 3.0. Both take it from the same `/usr/lib` directory. Install the new version for the new application and the old one falls over. Roll back and the new one does not start. The developer shrugs: “it works on my machine”. His laptop has its own system and its own versions.\n\nThis chapter answers a question you will ask yourself: **why is it more convenient to run a program in a container on a server, rather than just running it?**',
      ),
    },
    {
      id: 'problem',
      kind: 'text',
      step: 'explain',
      title: bi('Проблема окружений', 'The environment problem'),
      body: bi(
        'Программа почти никогда не работает сама по себе. Ей нужны библиотеки определённых версий, нужный интерпретатор (скажем, Python 3.13, а не 3.9), файлы настроек в определённых местах и переменные окружения. Всё это вместе называют **окружением** программы. Когда в одной системе работают несколько программ, окружение у них общее, и рано или поздно требования одной программы противоречат требованиям другой. Это и называется [[docker.env-problem|проблемой окружений]]: фраза «у меня работает» на деле означает «работает в моём окружении».\n\nДать каждой программе своё окружение можно двумя способами. Первый способ состоит в том, чтобы дать ей отдельный компьютер. Второй способ оставляет компьютер общим, но устроен так, что программа видит только то, что относится к ней. Первый способ привёл к виртуальным машинам, второй к контейнерам.',
        'A program almost never works alone. It needs libraries of particular versions, an interpreter (Python 3.13, not 3.9), configuration files in particular places, environment variables. All of that together is called the program’s **environment**. When several programs live on one system they share one environment, and sooner or later the needs of one contradict the needs of another. That is the [[docker.env-problem|environment problem]]: “it works on my machine” means “it works in my environment”.\n\nThere are two ways to give each program its own environment. The first is to give it a separate computer. The second is to keep the computer shared but make the program see only “its own”. The first way leads to virtual machines, the second to containers.',
      ),
    },
    {
      id: 'vm',
      kind: 'text',
      step: 'explain',
      title: bi('Как виртуальная машина даёт программе отдельный компьютер', 'How a virtual machine gives a program its own computer'),
      body: bi(
        'Отдельный физический сервер на каждое приложение обходится дорого, тем более что большую часть времени железо простаивает. Поэтому придумали **гипервизор** — программу, которая делит один физический сервер на несколько виртуальных. Каждой [[docker.vm|виртуальной машине]] (ВМ) гипервизор показывает её собственные процессоры, память, диск и сетевую карту, а внутрь устанавливают полноценную операционную систему со своим ядром. Приложение A работает в одной ВМ, приложение B в другой, и их библиотеки больше не встречаются.\n\nПлатить за это решение приходится дважды. Во-первых, каждая ВМ несёт собственную операционную систему, а это около гигабайта памяти и несколько гигабайт диска ещё до того, как запустилось приложение. Во-вторых, при запуске каждая ВМ загружает ядро и системные службы, и на это уходят десятки секунд. Гипервизоры бывают двух типов: гипервизор первого типа работает прямо на железе (VMware ESXi, Xen, KVM в ядре Linux), а второго типа работает как обычная программа внутри другой системы (VirtualBox на ноутбуке).',
        'A separate physical server for each application is expensive: most of the time the hardware is idle. So the **hypervisor** was invented — a program that divides one physical server into several virtual ones. To each [[docker.vm|virtual machine]] (VM) the hypervisor shows its own CPUs, memory, disk and network card; a complete operating system with its own kernel is installed inside. Application A lives in one VM, B in another, and their libraries never meet again.\n\nThis solution has a double price. Every VM carries its own OS: a gigabyte of memory and several gigabytes of disk before the application has even started. And every VM boots a kernel and system services when it starts — tens of seconds. Hypervisors come in two types: type 1 runs on the hardware itself (VMware ESXi, Xen, KVM in the Linux kernel), type 2 as an ordinary program inside another OS (VirtualBox on a laptop).',
      ),
    },
    {
      id: 'container',
      kind: 'text',
      step: 'explain',
      title: bi('Как контейнер отделяет программу на общем компьютере', 'How a container separates a program on a shared computer'),
      body: bi(
        'Все части второго решения вы уже встречали в блоке Linux, только не называли их вместе. Пространства имён (namespaces) показывают процессу его собственный список процессов, своё имя машины, свою сеть и своё дерево файлов. Группа cgroup ограничивает, сколько памяти и процессорного времени процесс может взять. Смена корня даёт ему собственный набор файлов, а значит, и собственные библиотеки. Из сочетания этих механизмов и получается [[docker.container|контейнер]], то есть **обычный процесс хоста, которому ядро показывает только его собственное окружение и ограничивает ресурсы**. Ядро при этом одно на все контейнеры.\n\nИз этого определения следует всё остальное. Своего ядра у контейнера нет, поэтому загружать нечего, и запуск контейнера сводится к созданию процесса, то есть занимает доли секунды. Гостевой системы тоже нет, поэтому контейнер занимает столько памяти, сколько само приложение, и ещё несколько мегабайт сверху. В контейнере A лежит libssl 1.1, в контейнере B версия 3.0, и они друг другу не мешают.',
        'In the Linux block you already assembled every part of the second solution, you just did not name them together. Namespaces show a process its own list of processes, its own machine name, its own network and its own file tree. A cgroup limits how much memory and CPU it may take. A change of root gives it its own set of files — with its own libraries. A [[docker.container|container]] is exactly their combination: **an ordinary host process that the kernel shows “its own” and limits in resources**. One kernel for all containers.\n\nEverything else follows from this definition. A container has no kernel of its own, so there is nothing to boot: starting it is creating a process, a fraction of a second. There is no guest OS either, so a container takes as much memory as the application itself, plus a few megabytes. Container A holds libssl 1.1, container B holds 3.0, and they do not get in each other’s way.',
      ),
    },
    { id: 'look-intro', kind: 'text', step: 'look', title: bi('Как приложения уживаются на сервере без изоляции, с виртуальными машинами и с контейнерами', 'How applications get along on a server without isolation, with virtual machines and with containers'), body: bi('Схема ниже ставит рядом три одинаковых сервера, по 16 ГиБ памяти у каждого, и показывает, как на них уживаются приложения. Слева сервер без изоляции, на котором приложения A и B ссорятся из-за версии libssl. В середине сервер с гипервизором, где у каждого приложения своя виртуальная машина. Справа сервер с контейнерами. Каждая башня собирается снизу вверх: физический сервер, потом то, что лежит прямо на нём (система, гипервизор или ядро), и наверху приложения.', 'The diagram below puts three servers of the same size side by side, 16 GiB of memory each, and shows how applications get along on them. On the left is a server without isolation, where apps A and B quarrel over the libssl version. In the middle is a server with a hypervisor, where each app has its own virtual machine. On the right is a server with containers. Each tower is built from the bottom up: the physical server, then what lies right on it (a system, a hypervisor or a kernel), and the applications on top.') },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.stack', howto: bi('Сначала на схеме только первый сервер. Нажмите «Начать с первого шага» и переходите дальше кнопкой «Шаг вперёд». На каждом шаге подсвечен один блок, тот, что работает сейчас, а облачко рядом с ним говорит, что он делает. Карточка на линии показывает, что этот блок передаёт ниже: запрос библиотеки или системный вызов. Под схемой появляются счётчики памяти и времени запуска для второго и третьего сервера.\n\nКогда пройдёте до конца, доведите в «Параметрах» число приложений до 30 и сравните счётчики памяти: виртуальные машины перестанут помещаться гораздо раньше контейнеров. Потом включите уязвимость в ядре и программу для Windows, а в блоке «Сломать» остановите гипервизор или ядро и посмотрите, сколько приложений остановится вместе с ними.', 'At first only the first server is shown. Press “Start from the first step” and go on with “Step forward”. At each step one block is highlighted, the one working now, and the callout next to it says what it does. The card on the line shows what the block hands down: a library request or a system call. Memory and start-time counters for the second and third servers appear under the diagram.\n\nWhen you reach the end, move the number of applications in “Parameters” to 30 and compare the memory counters: virtual machines stop fitting much earlier than containers. Then switch on the kernel vulnerability and the Windows program, and in “Break it” stop the hypervisor or the kernel and see how many applications stop with them.'), caption: bi('Эти цифры обычно и решают, что выбрать. Когда на собеседовании спросят, чем контейнер отличается от виртуальной машины, вспомните три башни: у какой своё ядро, сколько памяти уходит на гостевую систему и где проходит граница при уязвимости в ядре. В задании ниже вы проверите на настоящей команде, что ядро у контейнера и хоста одно.', 'These are the numbers that usually decide the choice. When an interview asks how a container differs from a VM, recall the three towers: which has its own kernel, how much memory the guest system takes, and where the boundary is when the kernel has a hole. In the task below you will check with a real command that a container and its host share one kernel.') },
    {
      id: 'compare',
      kind: 'text',
      step: 'explain',
      title: bi('Чем контейнер отличается от виртуальной машины', 'Container against VM'),
      body: bi(
        'Сравним их по четырём пунктам, потому что о них и спрашивают на собеседовании.\n\n- **Ядро.** У виртуальной машины ядро своё, а у контейнера общее с хостом. Из этого следует главное: программу, которой нужно другое ядро или другая операционная система, например программу для Windows, в контейнере на Linux не запустить.\n- **Изоляция.** Виртуальную машину отделяют от соседей гипервизор и её собственное ядро. Граница контейнера проходит внутри одного ядра, поэтому уязвимость в ядре становится общей бедой всех контейнеров хоста. По этой причине чужой, недоверенный код запускают в виртуальных машинах или в песочницах вроде gVisor и Kata Containers.\n- **Размер и плотность.** Виртуальная машина состоит из операционной системы и приложения, а контейнер содержит только приложение и его файлы. Поэтому на том же сервере контейнеров помещается в разы больше.\n- **Запуск.** Виртуальная машина загружает ядро и службы, и это занимает десятки секунд, а контейнер остаётся обычным процессом, который запускается за доли секунды.\n\nЕсли нужно ответить коротко, скажите так: выбирая между [[docker.vm-vs-container|контейнером и виртуальной машиной]], вы выбираете между лёгкостью и силой изоляции, и на практике их часто используют вместе.',
        'Let us compare point by point — this is exactly what an interview asks.\n\n- **Kernel.** A VM has its own; a container shares the host’s. The main consequence: a program that needs another kernel or another OS (a Windows one, say) cannot run in a container on Linux.\n- **Isolation.** A VM’s boundary is the hypervisor and its own kernel. A container’s boundary runs inside one kernel: a kernel vulnerability is a shared trouble for every container on the host. That is why untrusted code runs in VMs or in sandboxes such as gVisor and Kata Containers.\n- **Size and density.** A VM is an OS plus an application; a container is the application and its files. Many times more containers fit on the same server.\n- **Start.** A VM boots a kernel and services — tens of seconds; a container is a process — a fraction of a second.\n\nA short summary for the interview: [[docker.vm-vs-container|container versus VM]] is a choice between lightness and strength of isolation, and in real life they are often used together.',
      ),
    },
    {
      id: 'nesting',
      kind: 'text',
      step: 'explain',
      title: bi('Как сегодня вкладывают контейнеры и виртуальные машины друг в друга', 'Today they are nested in each other'),
      body: bi(
        'В облаке вы почти всегда работаете и с тем и с другим. Провайдер делит свои серверы гипервизором и выдаёт клиенту виртуальную машину, а клиент запускает в этой машине контейнеры: так устроен почти любой управляемый Kubernetes. Компания со своими серверами ставит Kubernetes прямо на них, и контейнеры работают на ядре узла без всякого гипервизора. А когда рядом с контейнерами нужна полноценная виртуальная машина, например для программы под Windows, её запускают внутри Kubernetes через KubeVirt: гипервизор QEMU работает процессом в контейнере, и Kubernetes размещает виртуальную машину так же, как свою обычную единицу работы, под, то есть группу контейнеров. Так платформа Cozystack и выдаёт виртуальные машины своим пользователям.\n\nИз всего этого стоит запомнить, что контейнер и виртуальная машина не соперничают друг с другом. Их вкладывают друг в друга как слои, когда задаче нужна более сильная изоляция.',
        'In the cloud you almost always work with both. A provider divides its servers with a hypervisor and gives the customer a VM, and the customer runs containers in that VM — almost every managed Kubernetes works this way. A company with its own hardware installs Kubernetes straight on the servers, and containers run on the node kernel without any hypervisor. And when a full VM is needed next to the containers — for a Windows program, say — it runs inside Kubernetes through KubeVirt: the QEMU hypervisor runs as a process in a container, and Kubernetes schedules the VM like an ordinary pod. This is how the Cozystack platform gives VMs to its users.\n\nThe conclusion worth remembering: containers and VMs are not rivals but layers nested in each other as isolation requires.',
      ),
    },
    { id: 'look-nesting-intro', kind: 'text', step: 'look', body: bi('Следующая схема ставит три таких устройства рядом: слева контейнеры внутри облачной виртуальной машины, в середине Kubernetes, установленный прямо на сервер компании, справа виртуальная машина внутри Kubernetes. Каждая башня собирается от железа к приложению, а в конце схема сравнивает башни и выбирает ту, в которой задаче будет лучше всего: свои веб-сервисы, код чужих клиентов или программа для Windows требуют разного устройства.', 'The next diagram puts the three setups side by side: on the left containers inside a cloud VM, in the middle Kubernetes installed straight on the company’s server, on the right a VM inside Kubernetes. Each tower is built from the hardware up to the application, and at the end the diagram compares the towers and picks the one where the task fits best: your own web services, outside customers’ code and a Windows program call for different setups.') },
    { id: 'look-nesting', kind: 'explainer', step: 'look', explainer: 'containers.nesting', howto: bi('Нажмите «Начать с первого шага» и переходите дальше кнопкой «Шаг вперёд». Башни вырастают по очереди, а облачко у подсвеченного блока говорит, что этот блок делает. На последнем шаге схема подсвечивает зелёным ту башню, в которую лучше поставить задачу, выбранную в «Параметрах», и объясняет почему. Счётчики под схемой показывают, сколько ядер работает в выбранной башне и сколько слоёв лежит между приложением и железом.\n\nНачните с задачи по умолчанию, десятка собственных веб-сервисов, а потом выберите код чужих клиентов и программу для Windows и посмотрите, как меняется выбор.', 'Press “Start from the first step” and go on with “Step forward”. The towers grow one by one, and the callout at the highlighted block says what it does. At the last step the diagram lights in green the tower where the task chosen in “Parameters” fits best and explains why. The counters under the diagram show how many kernels the chosen tower has and how many layers lie between the application and the hardware.\n\nStart with the default task, a dozen of your own web services, then choose outside customers’ code and the Windows program and see how the choice changes.'), caption: bi('Когда на работе встанет вопрос, где запустить новую задачу, задайте себе те же вопросы, что и схема: свой ли это код, нужно ли ему другое ядро и сколько машин придётся разместить. Ответ подскажет одну из трёх башен.', 'When at work you need to decide where a new task should run, ask yourself the questions the diagram asks: is it our own code, does it need another kernel, and how many machines must fit. The answer points to one of the three towers.') },
    {
      id: 'programmer',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы программист', 'If you are a programmer'),
      body: bi('С точки зрения системных вызовов контейнер получается так: `fork`, затем `unshare` с новыми пространствами имён, запись PID в файл `cgroup.procs`, `pivot_root` в подготовленный корень и, наконец, `execve`. Никакой эмуляции здесь нет, потому что все эти шаги выполняются системными вызовами того же ядра. Следующая глава разбирает, какие программы делают эти вызовы, когда вы набираете `docker run`.', 'A container = `fork` + `unshare` (new namespaces) + writing the PID into `cgroup.procs` + `pivot_root` into a prepared root + `execve`. No emulation: these are system calls of the same kernel. The next chapter takes apart who exactly makes these calls when you type `docker run`.'),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: dockerHost(),
      intro: bi('Перед вами машина в симуляторе, на которой установлен Docker. Команды `docker` подробно разобраны через две главы, а сейчас их достаточно повторить и посмотреть на результат.', 'A simulated machine with Docker. We take the `docker` commands apart in two chapters; for now it is enough to repeat them and look at the result.'),
      tasks: [
        {
          id: 'one-kernel',
          prompt: bi('Узнайте версию ядра хоста командой `uname -r`, а потом выполните ту же команду внутри контейнера: `docker run --rm alpine:3.22 uname -r`. Сравните две версии.', 'Find the host kernel version (`uname -r`), then run the same command inside a container: `docker run --rm alpine:3.22 uname -r`. Compare.'),
          check: { when: "docker.events[action=start]", stdout: '6.12.0-dt-sim' },
          chips: 'docker run --rm alpine:3.22 uname -r',
          concepts: ['docker.container'],
          docRef: web('get-started/docker-concepts/the-basics/what-is-a-container', 'containers-vs-vms', 'share the same kernel'),
          hints: { H1: bi('Версия ядра в обоих случаях одна и та же, потому что ядро на машине одно.', 'The kernel version is the same — because there is one kernel.') },
        },
        {
          id: 'other-files',
          prompt: bi('Теперь посмотрите на файлы. На хосте команда `cat /etc/os-release` показывает Debian. Выполните ту же команду в контейнере alpine: какую систему он видит?', 'Now the files: on the host `cat /etc/os-release` shows Debian. Run the same command in an alpine container — which system does it “see”?'),
          check: { when: "docker.events[action=start]", stdout: 'Alpine Linux' },
          chips: 'docker run --rm alpine:3.22 cat /etc/os-release',
          concepts: ['docker.container'],
          hints: { H1: bi('Ядро у контейнера общее с хостом, а файлы у него свои, потому что у контейнера собственный корень файловой системы.', 'The kernel is shared with the host, but the files are the container’s own, because the container has its own root file system.'), H2: bi('Это команда из предыдущего задания, только вместо `uname -r` в ней стоит `cat /etc/os-release`.', 'It is the command of the previous task with `cat /etc/os-release` instead of `uname -r`.') },
        },
      ],
    },
    {
      id: 'doc',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте страницу документации Docker «What is a container?». В каком её разделе контейнеры сравнивают с виртуальными машинами? Нажмите на этот раздел.', 'Open the Docker documentation page “What is a container?”. Which section compares containers and VMs? Click it.'),
      ref: web('get-started/docker-concepts/the-basics/what-is-a-container'),
      answer: 'containers-vs-vms',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: whyQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог главы', 'Summary'),
      body: bi('Каждой программе нужно своё окружение. Виртуальная машина даёт программе отдельный компьютер со своим ядром. Изоляция у такого решения сильная, но оно тяжёлое и медленное. Контейнер остаётся процессом хоста, который работает в своих пространствах имён и своей cgroup. Поэтому он лёгкий и быстрый, но ядро у всех контейнеров общее. Поэтому сегодня контейнеры и виртуальные машины часто вкладывают друг в друга, чтобы получить и лёгкость, и сильную изоляцию.', 'Programs need their own environments. A VM gives each its own computer with its own kernel — strong isolation, but heavy and slow. A container is a host process in its own namespaces and cgroup: light and fast, but with a shared kernel. Today they are nested in each other.'),
    },
  ],
};
