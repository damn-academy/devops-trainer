// Orientation, lessons 1–5: what is inside a computer, the operating system
// and files, talking to a machine in text, networks and the internet,
// servers, clients and requests (01 §3.4, §6.2: F01–F07).

import { bi } from '../../core/i18n';
import type { Lesson, QuizItem } from '../../core/types';
import { desk, EN, laptop, man, RU, sources } from './shared';

// ── 1. Inside a computer ───────────────────────────────────────────────────

export const insideQuiz: QuizItem[] = [
  {
    id: 'orient.q.power-cut',
    kind: 'mcq',
    key: true,
    concepts: ['orient.computer'],
    prompt: bi('Вы три часа писали отчёт и не сохраняли его. Свет моргнул, ноутбук без батареи выключился. Что вы найдёте после включения?', 'You wrote a report for three hours without saving it. The power flickered and the laptop, which has no battery, switched off. What will you find after switching on?'),
    options: [
      { id: 'prog', text: bi('Программа на месте, отчёта нет', 'The program is there, the report is not'), correct: true, why: bi('Программа лежит на диске, а несохранённый текст жил только в памяти — она забывает всё без питания.', 'The program lives on the disk, while the unsaved text lived only in memory, which forgets everything without power.') },
      { id: 'all', text: bi('И программа, и отчёт: компьютер всё помнит', 'Both the program and the report: the computer remembers everything'), why: bi('Помнит диск, а текст до нажатия «Сохранить» лежал в памяти. Память при выключении обнуляется.', 'The disk remembers, but until you press “Save” the text lay in memory. Memory is wiped at power-off.') },
      { id: 'none', text: bi('Ни программы, ни отчёта', 'Neither the program nor the report'), why: bi('Программа записана на диск, а диску выключение не страшно.', 'The program is written on the disk, and the disk does not mind a power-off.') },
    ],
    explain: bi('Память быстрая, но держит данные только под током. Диск медленнее, зато хранит их годами. Кнопка «Сохранить» — это и есть копия из памяти на диск.', 'Memory is fast but holds data only while powered. The disk is slower but keeps data for years. The “Save” button is exactly a copy from memory to the disk.'),
    refs: { lesson: 'orient.inside', explainer: 'orient.run' },
  },
  {
    id: 'orient.q.match-parts',
    kind: 'match',
    concepts: ['orient.computer'],
    prompt: bi('Сопоставьте часть компьютера и её работу.', 'Match each part of the computer with its job.'),
    pairs: [
      { id: 'cpu', left: bi('Процессор', 'Processor'), right: bi('выполняет инструкции, одну за другой', 'carries out instructions one after another') },
      { id: 'ram', left: bi('Память', 'Memory'), right: bi('держит то, с чем работают прямо сейчас', 'holds what is being worked on right now') },
      { id: 'disk', left: bi('Диск', 'Disk'), right: bi('хранит программы и документы, пока их не удалят', 'keeps programs and documents until they are deleted') },
    ],
    explain: bi('Три роли, которые повторяются в любой машине — от телефона до огромного компьютера в дата-центре.', 'Three roles that repeat in every machine, from a phone to a huge computer in a data centre.'),
  },
  {
    id: 'orient.q.start-order',
    kind: 'order',
    concepts: ['orient.program', 'orient.computer'],
    prompt: bi('Расставьте по порядку, что происходит после двойного щелчка по значку программы.', 'Put in order what happens after a double click on a program’s icon.'),
    steps: [
      { id: 'find', text: bi('по значку находят файл программы на диске', 'the icon leads to the program file on the disk') },
      { id: 'copy', text: bi('программу копируют с диска в память', 'the program is copied from the disk into memory') },
      { id: 'exec', text: bi('процессор выполняет её инструкции из памяти', 'the processor carries out its instructions from memory') },
      { id: 'draw', text: bi('на экране появляется окно', 'a window appears on the screen') },
    ],
    explain: bi('Процессор не умеет работать с диском напрямую: всё, что он выполняет, сначала попадает в память. Поэтому большой программе на медленном диске нужно время, чтобы открыться.', 'The processor cannot work with the disk directly: everything it carries out first lands in memory. That is why a big program on a slow disk takes time to open.'),
    refs: { explainer: 'orient.run' },
  },
  {
    id: 'orient.q.slow-start',
    kind: 'multi',
    concepts: ['orient.computer', 'orient.program'],
    prompt: bi('Программа открывается долго. Что из этого может быть причиной?', 'A program takes a long time to open. Which of these can be the reason?'),
    options: [
      { id: 'big', text: bi('программа большая, копировать её в память долго', 'the program is big, copying it into memory takes long'), correct: true },
      { id: 'hdd', text: bi('диск старый, вращающийся (HDD), а не SSD', 'the disk is an old spinning one (HDD) rather than an SSD'), correct: true },
      { id: 'full', text: bi('память забита другими открытыми программами', 'memory is packed with other open programs'), correct: true },
      { id: 'screen', text: bi('экран слишком маленький', 'the screen is too small'), why: bi('Экран только показывает готовую картинку; на скорость запуска он не влияет.', 'The screen only shows the finished picture; it does not affect how fast a program starts.') },
    ],
    explain: bi('Запуск — это копирование с диска в память. Его замедляют размер программы, скорость диска и нехватка свободной памяти, когда системе приходится выгружать куски других программ обратно на диск.', 'Starting is copying from the disk to memory. It is slowed by the size of the program, the speed of the disk and a lack of free memory, when pieces of other programs have to be pushed back out to the disk.'),
    refs: { explainer: 'orient.run' },
  },
  {
    id: 'orient.q.more-ram',
    kind: 'mcq',
    concepts: ['orient.computer'],
    prompt: bi('Коллега жалуется: «Открыто сорок вкладок, всё тормозит, а на диске ещё 300 ГБ свободно». Чего, скорее всего, не хватает?', 'A colleague complains: “Forty tabs open, everything is slow, and the disk still has 300 GB free.” What is most likely lacking?'),
    options: [
      { id: 'ram', text: bi('Памяти', 'Memory'), correct: true },
      { id: 'disk', text: bi('Места на диске', 'Disk space'), why: bi('Место на диске есть; открытые вкладки живут не там, а в памяти.', 'There is disk space; open tabs do not live there but in memory.') },
      { id: 'screen', text: bi('Размера экрана', 'Screen size'), why: bi('Экран к скорости не относится.', 'The screen has nothing to do with speed.') },
    ],
    explain: bi('Память и диск путают постоянно, даже в магазинах техники. Память — то, что занято сейчас; диск — то, что хранится. Память кончается, когда много открыто, диск — когда много сохранено.', 'Memory and disk are mixed up all the time, even in electronics shops. Memory is what is in use now; the disk is what is kept. Memory runs out when much is open, the disk when much is saved.'),
  },
];

export const insideLesson: Lesson = {
  id: 'orient.inside',
  block: 'orient',
  title: bi('Что внутри компьютера', 'What is inside a computer'),
  summary: bi('Процессор, память и диск: кто что делает, когда вы запускаете программу, и почему несохранённое пропадает.', 'Processor, memory and disk: who does what when you start a program, and why unsaved work disappears.'),
  introduces: ['orient.computer', 'orient.program'],
  uses: [],
  tier: 'core',
  minutes: 25,
  sources: sources([EN.vonNeumann, EN.cpu, EN.ram], [RU.vonNeumann, RU.cpu, RU.ram]),
  sections: [
    {
      id: 'course',
      kind: 'callout',
      tone: 'note',
      step: 'hook',
      levels: ['beginner'],
      title: bi('Зачем этот блок', 'What this block is for'),
      body: bi(
        'Этот блок для тех, кто знает компьютер как пользователь: открывает программы, пишет письма, но никогда не заглядывал внутрь. За десять коротких уроков вы получите словарь, на котором говорит любая IT-команда, и сделаете первые шаги на учебной машине. Дальше по курсу эти слова будут встречаться в каждом абзаце, и вам не придётся останавливаться на каждом.',
        'This block is for those who know computers as users: they open programs and write letters but have never looked inside. In ten short lessons you will get the vocabulary every IT team speaks in and take your first steps on a training machine. Further on, these words appear in every paragraph, and you will not have to stop at each one.',
      ),
    },
    {
      id: 'skip',
      kind: 'callout',
      tone: 'note',
      step: 'hook',
      levels: ['intermediate', 'experienced'],
      title: bi('Если вы уже работали в IT', 'If you have already worked in IT'),
      body: bi(
        'Блок рассчитан на новичков. Если вы работали рядом с IT-командой и её повседневный словарь вам привычен, пройдите на странице блока проверку из трёх вопросов: она отметит все понятия блока как известные, и следующие блоки не будут на них спотыкаться.',
        'The block is meant for beginners. If you have worked next to an IT team and its everyday vocabulary is familiar, take the three-question check on the block page: it marks all the block’s ideas as known, and the following blocks will not stumble over them.',
      ),
    },
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы три часа писали отчёт. Свет на секунду моргнул, ноутбук без батареи погас, а после включения программа на месте — пропал только отчёт. В описании того же ноутбука значилось «16 ГБ памяти, 512 ГБ диска», и продавец уверял, что это совсем разные вещи. Оба случая объясняются одним и тем же устройством компьютера, и к концу урока вы сможете его нарисовать.',
        'You spent three hours writing a report. The power flickered for a second, the laptop without a battery went dark, and after switching on the program is still there; only the report is gone. The same laptop was described as “16 GB of memory, 512 GB of disk”, and the shop assistant insisted these were quite different things. Both cases are explained by one and the same arrangement of a computer, and by the end of the lesson you will be able to draw it.',
      ),
    },
    {
      id: 'parts',
      kind: 'text',
      step: 'explain',
      title: bi('Три части', 'Three parts'),
      body: bi(
        'Внутри любого [[orient.computer|компьютера]] — от телефона до огромной машины в дата-центре — работают три главные части, и у каждой своя роль.\n\n**Процессор** выполняет инструкции. Инструкция — крошечное действие: сложить два числа, сравнить их, перейти к другой инструкции. Сам по себе процессор ничего не помнит, зато выполняет миллиарды таких действий в секунду. Когда говорят «процессор на 3 ГГц с четырьмя ядрами», имеют в виду, что внутри четыре независимых исполнителя и каждый делает около трёх миллиардов шагов в секунду.\n\n**Память** (её ещё называют оперативной) держит то, с чем компьютер работает прямо сейчас: открытые программы, страницу в браузере, ваш несохранённый текст. Она быстрая, но живёт только под током: выключили питание — и память пуста.\n\n**Диск** хранит всё остальное: программы, документы, фотографии. Он в сотни раз медленнее памяти, но помнит годами и без питания. Старые диски, HDD, устроены как пластинки с головкой; новые, SSD, собраны из микросхем и быстрее раз в десять.\n\nТеперь история с отчётом понятна. Программа лежала на диске и уцелела. Отчёт до нажатия «Сохранить» был только в памяти — и исчез вместе с током. А 16 ГБ памяти и 512 ГБ диска — действительно разные вещи: сколько можно держать открытым одновременно и сколько можно хранить.',
        'Inside every [[orient.computer|computer]], from a phone to a huge machine in a data centre, three main parts are at work, each with its own role.\n\nThe **processor** carries out instructions. An instruction is a tiny action: add two numbers, compare them, jump to another instruction. The processor itself remembers nothing, but it carries out billions of such actions a second. When someone says “a 3 GHz processor with four cores”, they mean there are four independent workers inside, each making about three billion steps a second.\n\n**Memory** (also called main memory or RAM) holds what the computer is working on right now: open programs, the page in the browser, your unsaved text. It is fast, but it lives only while powered: switch off the power and memory is empty.\n\nThe **disk** keeps everything else: programs, documents, photos. It is hundreds of times slower than memory, but it remembers for years and without power. Old disks, HDDs, work like record players with a moving arm; new ones, SSDs, are made of chips and are about ten times faster.\n\nNow the report story makes sense. The program lay on the disk and survived. Until “Save” was pressed, the report was only in memory, and it vanished with the power. And 16 GB of memory and 512 GB of disk really are different things: how much can be open at once and how much can be kept.',
      ),
    },
    {
      id: 'program',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое программа и что значит «запустить»', 'What a program is and what “start” means'),
      body: bi(
        '[[orient.program|Программа]] — это длинная последовательность инструкций для процессора, записанная на диск. Пока её никто не запустил, это просто данные, такие же, как фотография. Запустить программу — значит скопировать её с диска в память и сказать процессору: «начинай отсюда». Дальше процессор берёт из памяти инструкцию за инструкцией и выполняет их, а программа рисует своё окно, ждёт ваших щелчков и отвечает на них.\n\nОдна программа на диске может быть запущена несколько раз: два окна одного редактора — это две копии в памяти, у каждой свои данные. А значок на рабочем столе — вовсе не программа, а только ярлык, который указывает, где она лежит. Удалите программу с диска, и значок будет указывать в пустоту.\n\nПройдите объяснение ниже. Пошевелите ползунки: сделайте программу больше, поменяйте диск на медленный, откройте лишние программы. А потом выключите питание до сохранения — и сравните со своим предсказанием.',
        'A [[orient.program|program]] is a long sequence of instructions for the processor, written to the disk. Until someone starts it, it is just data, like a photo. Starting a program means copying it from the disk into memory and telling the processor: “begin here”. From then on the processor takes instruction after instruction from memory and carries them out, while the program draws its window, waits for your clicks and responds to them.\n\nOne program on the disk can be started several times: two windows of the same editor are two copies in memory, each with its own data. And the icon on the desktop is not the program at all, only a shortcut pointing to where it lies. Delete the program from the disk, and the icon points at nothing.\n\nWalk through the explainer below. Move the sliders: make the program bigger, switch to a slow disk, open too many programs. Then cut the power before saving, and compare with your prediction.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.run', caption: bi('Шаги листаются стрелками. Нажмите на любой блок или линию — они объяснят себя.', 'Step through with the arrows. Click any block or line: it explains itself.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: desk(),
      intro: bi(
        'Это учебная машина прямо в браузере. У неё нет окон и значков: с ней разговаривают текстом. Как это устроено, разберём через урок, а сейчас достаточно напечатать то, что написано в задании, нажать Enter и прочитать ответ. Сломать здесь ничего нельзя: кнопка «Сбросить» вернёт машину в начало.',
        'This is a training machine right in your browser. It has no windows or icons: you talk to it in text. How that works we take apart in two lessons; for now it is enough to type what the task says, press Enter and read the answer. Nothing can be broken here: the “Reset” button returns the machine to the start.',
      ),
      tasks: [
        {
          id: 'cores',
          prompt: bi('Сколько ядер у процессора этой машины? Напечатайте `nproc` и нажмите Enter.', 'How many cores does this machine’s processor have? Type `nproc` and press Enter.'),
          check: { stdout: /^\d+\n?$/ },
          chips: 'nproc',
          docRef: man('nproc.1'),
          concepts: ['orient.computer'],
          hints: { H1: bi('Наберите буквы n, p, r, o, c и нажмите Enter.', 'Type the letters n, p, r, o, c and press Enter.') },
        },
        {
          id: 'memory',
          prompt: bi('Сколько у неё памяти и сколько свободно? Команда `free -h` — в строке `Mem:` первое число означает всего, а `available` — сколько ещё можно занять.', 'How much memory does it have and how much is free? The command is `free -h`: in the `Mem:` line the first number is the total, and `available` is how much can still be taken.'),
          check: { stdout: /Mem:/ },
          chips: 'free -h',
          docRef: man('free.1', 'OPTIONS', '-h'),
          concepts: ['orient.computer'],
          hints: { H1: bi('Буквы `-h` после пробела просят показать числа в понятных единицах: Mi, Gi.', 'The letters `-h` after a space ask for numbers in readable units: Mi, Gi.') },
        },
        {
          id: 'disk',
          prompt: bi('А сколько у машины диска? Команда `df -h`: в строке, которая кончается на `/`, видно размер и сколько занято.', 'And how much disk does the machine have? The command is `df -h`: the line ending in `/` shows the size and how much is used.'),
          check: { stdout: /Filesystem/ },
          chips: 'df -h',
          docRef: man('df.1'),
          concepts: ['orient.computer'],
          hints: { H1: bi('Сравните с `free -h`: памяти — гигабайты, диска — тоже гигабайты, но их больше.', 'Compare with `free -h`: memory is in gigabytes, the disk too, but there are more of them.') },
        },
      ],
    },
    {
      id: 'programmer',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы программист', 'If you are a programmer'),
      body: bi(
        'Это архитектура фон Неймана в один абзац: программа и данные лежат в одной памяти, процессор выбирает и исполняет инструкции. Кэши, виртуальная память и подкачка — уточнения этой картины, а не её замена: выгрузка страниц на диск при нехватке памяти и есть «всё тормозит» из объяснения.',
        'This is the von Neumann architecture in one paragraph: the program and its data share one memory, the processor fetches and executes instructions. Caches, virtual memory and paging refine this picture rather than replace it: paging out to the disk when memory runs short is exactly the “everything slows down” of the explainer.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: insideQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Процессор выполняет, память держит то, что нужно сейчас, диск хранит. Программа — инструкции на диске; запустить её значит скопировать в память и отдать процессору. Всё, что не сохранено на диск, исчезает вместе с питанием.',
        'The processor carries out, memory holds what is needed now, the disk keeps. A program is instructions on the disk; starting it means copying it into memory and handing it to the processor. Anything not saved to the disk disappears with the power.',
      ),
    },
  ],
};

// ── 2. The operating system and files ──────────────────────────────────────

export const systemQuiz: QuizItem[] = [
  {
    id: 'orient.q.os-job',
    kind: 'multi',
    key: true,
    concepts: ['orient.os'],
    prompt: bi('Что из этого делает операционная система?', 'Which of these does the operating system do?'),
    options: [
      { id: 'turns', text: bi('по очереди даёт программам процессор', 'gives programs the processor in turns'), correct: true },
      { id: 'mem', text: bi('выдаёт каждой программе её участок памяти', 'gives each program its piece of memory'), correct: true },
      { id: 'files', text: bi('помнит, где на диске лежит каждый файл', 'remembers where each file lies on the disk'), correct: true },
      { id: 'text', text: bi('пишет за вас текст письма', 'writes the text of your letter for you'), why: bi('Текст пишете вы в программе-редакторе. Система только сохраняет его, когда редактор попросит.', 'You write the text in an editor program. The system only saves it when the editor asks.') },
    ],
    explain: bi('Система — посредник между программами и железом. Программы просят её, а она решает, кому что дать, и следит, чтобы они не мешали друг другу.', 'The system is the go-between for programs and hardware. Programs ask it, and it decides who gets what and makes sure they do not get in each other’s way.'),
    refs: { explainer: 'orient.system' },
  },
  {
    id: 'orient.q.one-core',
    kind: 'mcq',
    concepts: ['orient.os'],
    prompt: bi('У старого ноутбука одно ядро, а вы одновременно слушаете музыку, пишете письмо и качаете файл. Как это возможно?', 'An old laptop has one core, and you listen to music, write a letter and download a file at the same time. How is that possible?'),
    options: [
      { id: 'turns', text: bi('Система переключает процессор между программами сотни раз в секунду', 'The system switches the processor between programs hundreds of times a second'), correct: true },
      { id: 'magic', text: bi('Одно ядро умеет выполнять три программы сразу', 'One core can run three programs at once'), why: bi('В каждый момент одно ядро выполняет одну программу. Одновременность — иллюзия от очень частых переключений.', 'At any moment one core runs one program. The simultaneity is an illusion from very frequent switching.') },
      { id: 'queue', text: bi('Программы ждут, пока предыдущая закончит работу', 'The programs wait until the previous one finishes'), why: bi('Тогда музыка играла бы только после того, как вы допишете письмо.', 'Then the music would play only after you finished the letter.') },
    ],
    explain: bi('Каждой программе достаётся отрезок в несколько миллисекунд, потом система отдаёт процессор следующей. Глазу и уху этого не заметить.', 'Each program gets a slice of a few milliseconds, then the system gives the processor to the next one. Neither eye nor ear can notice it.'),
    refs: { explainer: 'orient.system' },
  },
  {
    id: 'orient.q.path',
    kind: 'mcq',
    concepts: ['orient.file'],
    prompt: bi('Файл `todo.txt` лежит в папке `notes`, а она — в папке `learner`, которая лежит в `home`. Как записать его путь?', 'The file `todo.txt` lies in the folder `notes`, which is in the folder `learner`, which lies in `home`. How is its path written?'),
    options: [
      { id: 'ok', text: '/home/learner/notes/todo.txt', correct: true },
      { id: 'rev', text: '/todo.txt/notes/learner/home', why: bi('Путь читают от самой внешней папки к файлу, как адрес от страны к квартире.', 'A path reads from the outermost folder to the file, like an address from the country to the flat.') },
      { id: 'back', text: '\\home\\learner\\notes\\todo.txt', why: bi('Обратную косую черту использует Windows. На машинах, с которыми работает этот курс, разделитель — «/».', 'The backslash is used by Windows. On the machines this course works with the separator is “/”.') },
    ],
    explain: bi('Путь начинается с «/» — самой верхней папки — и перечисляет папки по очереди до файла.', 'A path starts with “/”, the topmost folder, and lists the folders in turn down to the file.'),
  },
  {
    id: 'orient.q.os-names',
    kind: 'mcq',
    concepts: ['orient.os'],
    prompt: bi('Какая операционная система работает на большинстве машин, которыми управляет инженер эксплуатации?', 'Which operating system runs on most machines an operations engineer manages?'),
    options: [
      { id: 'linux', text: 'Linux', correct: true },
      { id: 'win', text: 'Windows', why: bi('Windows встречается на рабочих местах и в части компаний, но машины, которые обслуживают сайты и приложения, — в подавляющем большинстве Linux.', 'Windows appears on desktops and in some companies, but the machines that serve sites and applications are overwhelmingly Linux.') },
      { id: 'mac', text: 'macOS', why: bi('macOS — система ноутбуков и компьютеров Apple; для таких машин её почти не используют.', 'macOS is the system of Apple laptops and computers; it is hardly used for such machines.') },
    ],
    explain: bi('Поэтому второй блок курса целиком про Linux. Многое из этого урока вы увидите там снова, но уже изнутри.', 'That is why the course’s second block is entirely about Linux. Much of this lesson you will see there again, this time from the inside.'),
  },
  {
    id: 'orient.q.folders-label',
    kind: 'label',
    concepts: ['orient.file'],
    prompt: bi('Подпишите схему: папки и файл на пути `/home/learner/notes/todo.txt`.', 'Label the diagram: the folders and the file on the path `/home/learner/notes/todo.txt`.'),
    diagram: {
      width: 520,
      height: 240,
      slots: [
        { id: 's-root', x: 200, y: 8, w: 120, h: 36, answer: 'root', family: 'store' },
        { id: 's-home', x: 200, y: 64, w: 120, h: 36, answer: 'home', family: 'store' },
        { id: 's-learner', x: 200, y: 120, w: 120, h: 36, answer: 'learner', family: 'store' },
        { id: 's-notes', x: 200, y: 176, w: 120, h: 36, answer: 'notes', family: 'store' },
        { id: 's-todo', x: 368, y: 176, w: 136, h: 36, answer: 'todo', family: 'user' },
      ],
      edges: [
        { from: 's-root', to: 's-home' },
        { from: 's-home', to: 's-learner' },
        { from: 's-learner', to: 's-notes' },
        { from: 's-notes', to: 's-todo' },
      ],
    },
    labels: [
      { id: 'root', text: '/' },
      { id: 'home', text: 'home' },
      { id: 'learner', text: 'learner' },
      { id: 'notes', text: 'notes' },
      { id: 'todo', text: 'todo.txt' },
    ],
    explain: bi('Каждая «/» в пути — шаг на одну папку вниз. Самая верхняя папка называется просто «/».', 'Every “/” in a path is one step down into a folder. The topmost folder is called simply “/”.'),
  },
];

export const systemLesson: Lesson = {
  id: 'orient.system',
  block: 'orient',
  title: bi('Операционная система и файлы', 'The operating system and files'),
  summary: bi('Главная программа компьютера: делит процессор и память между программами, хранит файлы в папках. Linux, Windows, macOS.', 'The main program of the computer: it shares the processor and memory among programs and keeps files in folders. Linux, Windows, macOS.'),
  introduces: ['orient.os', 'orient.file'],
  uses: ['orient.computer', 'orient.program'],
  tier: 'core',
  minutes: 25,
  sources: sources([EN.os, EN.file], [RU.os, RU.file]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В прошлом уроке программа «копировалась с диска в память», а процессор «брал инструкции». Но кто всё это делал? Процессор сам ничего не помнит, а программа ещё лежала на диске и ничего не могла. Кроме того, на диске нет никаких «файлов» и «папок» — только миллиарды пронумерованных ячеек. Кто-то должен помнить, что ячейки с 4711-й по 4713-ю — это ваш отчёт. Этот кто-то и есть главная программа компьютера.',
        'In the last lesson the program was “copied from the disk into memory” and the processor “took instructions”. But who did all that? The processor itself remembers nothing, and the program was still lying on the disk and could do nothing. Besides, a disk has no “files” or “folders”, only billions of numbered cells. Somebody has to remember that cells 4711 to 4713 are your report. That somebody is the main program of the computer.',
      ),
    },
    {
      id: 'os',
      kind: 'text',
      step: 'explain',
      title: bi('Посредник между программами и железом', 'A go-between for programs and hardware'),
      body: bi(
        '[[orient.os|Операционная система]] (ОС) — первая программа, которая загружается при включении компьютера, и последняя, которая завершается при выключении. Все остальные программы запускает она, и к железу они обращаются только через неё.\n\nУ системы четыре главные работы. Она **запускает программы** — та самая копия с диска в память делается её руками. Она **делит процессор**: программ запущено много, а ядер мало, поэтому система даёт каждой программе процессор на несколько миллисекунд и переключает дальше; переключения так часты, что вам кажется, будто всё работает одновременно. Она **раздаёт память**, каждой программе свой участок, и не пускает одну программу в чужой. И она **ведёт учёт диска**: какие ячейки свободны, какие заняты и каким файлам принадлежат.\n\nСистемы бывают разные. На ноутбуках чаще всего Windows и macOS, на телефонах — Android и iOS. А на машинах, которые круглые сутки обслуживают сайты и приложения, почти всегда работает Linux — поэтому ему посвящён целый следующий технический блок курса.',
        'The [[orient.os|operating system]] (OS) is the first program to load when a computer is switched on and the last to finish when it is switched off. It starts all other programs, and they reach the hardware only through it.\n\nThe system has four main jobs. It **starts programs**: that copy from the disk into memory is made by its hands. It **shares the processor**: many programs are running and there are few cores, so the system gives each program the processor for a few milliseconds and moves on; the switches are so frequent that it seems to you everything runs at once. It **hands out memory**, a piece to each program, and keeps one program out of another’s. And it **keeps track of the disk**: which cells are free, which are taken and which files they belong to.\n\nSystems differ. Laptops most often run Windows and macOS, phones Android and iOS. But the machines that serve sites and applications around the clock almost always run Linux, which is why the course’s next technical block is devoted entirely to it.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.system', caption: bi('Добавьте программ на одно ядро, потом дайте четыре ядра. И уберите посредника — пусть программы пишут на диск сами.', 'Add programs on one core, then give it four cores. And remove the go-between: let the programs write to the disk themselves.') },
    {
      id: 'files',
      kind: 'text',
      step: 'explain',
      title: bi('Файлы и папки', 'Files and folders'),
      body: bi(
        '[[orient.file|Файл]] — именованный кусок данных на диске: текст, фотография, программа. Имя придумали для людей; для системы файл — это список занятых ячеек и запись о том, как он называется и кому принадлежит.\n\nФайлы лежат в папках, папки — в других папках, и вместе они образуют дерево. На машинах с Linux у этого дерева одна вершина, она называется просто `/`. Внутри неё папка `home`, где у каждого человека своя папка: у вас на учебной машине это `learner`. Чтобы назвать файл точно, перечисляют все папки от вершины до него через косую черту: `/home/learner/notes/todo.txt`. Такая запись называется путём. Её читают как почтовый адрес — от страны к квартире.\n\nВ Windows дерево устроено похоже, только верхушек несколько (`C:`, `D:`), а черта обратная: `C:\\Users\\learner\\notes\\todo.txt`. На машинах, с которыми работает этот курс, всегда прямая — `/`.',
        'A [[orient.file|file]] is a named piece of data on the disk: a text, a photo, a program. The name was invented for people; to the system a file is a list of occupied cells plus a record of what it is called and whom it belongs to.\n\nFiles lie in folders, folders in other folders, and together they form a tree. On Linux machines the tree has a single top, called simply `/`. Inside it is the folder `home`, where every person has a folder of their own: on the training machine yours is `learner`. To name a file exactly, you list all folders from the top down to it, separated by slashes: `/home/learner/notes/todo.txt`. This is called a path. You read it like a postal address, from the country down to the flat.\n\nIn Windows the tree is arranged in a similar way, except there are several tops (`C:`, `D:`) and the slash leans the other way: `C:\\Users\\learner\\notes\\todo.txt`. On the machines this course works with it is always the forward one, `/`.',
      ),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: desk(),
      intro: bi('Та же учебная машина. В вашей папке уже лежат папки `notes` и `photos`.', 'The same training machine. Your folder already holds the folders `notes` and `photos`.'),
      tasks: [
        {
          id: 'where',
          prompt: bi('В какой папке вы сейчас находитесь? Команда `pwd` напечатает её путь.', 'Which folder are you in now? The `pwd` command prints its path.'),
          check: { stdout: /^\/home\/learner\n?$/ },
          chips: 'pwd',
          docRef: man('pwd.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('Три буквы: p, w, d — «print working directory», «покажи рабочую папку».', 'Three letters: p, w, d, “print working directory”.') },
        },
        {
          id: 'list',
          prompt: bi('Что лежит в вашей папке? Посмотрите командой `ls`, а потом — что внутри `notes`: `ls notes`.', 'What is in your folder? Look with `ls`, then look inside `notes`: `ls notes`.'),
          check: { stdout: /todo\.txt/ },
          chips: 'ls notes',
          docRef: man('ls.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('`ls` без продолжения показывает текущую папку; с именем папки — её содержимое.', '`ls` on its own lists the current folder; with a folder name, its contents.') },
        },
        {
          id: 'read',
          prompt: bi('Прочитайте список дел: `cat notes/todo.txt`.', 'Read the to-do list: `cat notes/todo.txt`.'),
          check: { stdout: /call the bank/ },
          chips: 'cat notes/todo.txt',
          docRef: man('cat.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('`notes/todo.txt` — путь к файлу от того места, где вы стоите.', '`notes/todo.txt` is the path to the file from where you stand.') },
        },
        {
          id: 'mkdir',
          prompt: bi('Заведите папку для документов: `mkdir docs`. Проверьте `ls`, что она появилась.', 'Make a folder for documents: `mkdir docs`. Check with `ls` that it appeared.'),
          check: { when: "files['/home/learner/docs'].type=d" },
          chips: 'mkdir docs',
          docRef: man('mkdir.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('mkdir — «make directory», «создай папку».', 'mkdir means “make directory”.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: systemQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Операционная система — главная программа: запускает остальные, по очереди даёт им процессор, раздаёт память и ведёт учёт диска. Файл — именованные данные на диске, папки складываются в дерево, путь `/home/learner/notes/todo.txt` называет файл точно.',
        'The operating system is the main program: it starts the others, gives them the processor in turns, hands out memory and keeps track of the disk. A file is named data on the disk, folders form a tree, and the path `/home/learner/notes/todo.txt` names a file exactly.',
      ),
    },
  ],
};

// ── 3. Talking to a machine in text ────────────────────────────────────────

export const textQuiz: QuizItem[] = [
  {
    id: 'orient.q.why-text',
    kind: 'mcq',
    key: true,
    concepts: ['orient.command'],
    prompt: bi('Почему с машинами, которые обслуживают сайты, обычно говорят командами, а не мышью?', 'Why do people usually talk to the machines that serve sites in commands rather than with a mouse?'),
    options: [
      { id: 'far', text: bi('Машина стоит далеко и без экрана, а текст легко передать по сети, записать и повторить', 'The machine is far away and has no screen, and text is easy to send over a network, to write down and to repeat'), correct: true },
      { id: 'old', text: bi('Это пережиток: так работали до изобретения мыши', 'It is a leftover: that is how it worked before the mouse was invented'), why: bi('Команды живут не по привычке: строку можно сохранить, отправить коллеге и выполнить на сотне машин сразу. С щелчками мыши так не выйдет.', 'Commands survive not out of habit: a line can be saved, sent to a colleague and run on a hundred machines at once. Mouse clicks cannot do that.') },
      { id: 'secret', text: bi('Чтобы посторонние не поняли, что происходит', 'So that outsiders do not understand what is going on'), why: bi('Команды — не шифр: они записаны в открытой справке, и их учит любой желающий.', 'Commands are no cipher: they are written in open documentation, and anyone can learn them.') },
    ],
    explain: bi('Текстовую команду можно напечатать за тысячу километров, вставить в инструкцию и выполнить снова через год. В этом её сила.', 'A text command can be typed a thousand kilometres away, put into an instruction and run again a year later. That is its strength.'),
  },
  {
    id: 'orient.q.words',
    kind: 'mcq',
    concepts: ['orient.command'],
    prompt: bi('В строке `ls -l notes` что сделать, а что — с чем?', 'In the line `ls -l notes`, what is the action and what is it done with?'),
    options: [
      { id: 'ok', text: bi('`ls` — что сделать (показать), `-l` — как (подробно), `notes` — с чем (с этой папкой)', '`ls` is what to do (list), `-l` is how (in detail), `notes` is with what (this folder)'), correct: true },
      { id: 'all', text: bi('Это одно слово, его надо выучить целиком', 'It is one word to be learnt as a whole'), why: bi('Слова разделены пробелами, и у каждого своя роль. Поэтому из нескольких знакомых слов можно составить новую строку.', 'The words are separated by spaces and each has its own role. That is why familiar words can be combined into a new line.') },
      { id: 'rev', text: bi('`notes` — команда, а `ls` — папка', '`notes` is the command and `ls` is the folder'), why: bi('Первое слово строки — всегда команда; остальные ей уточняют задачу.', 'The first word of a line is always the command; the rest refine its task.') },
    ],
    explain: bi('Слова, начинающиеся с дефиса, называют опциями или флагами: они говорят «как». Их не учат наизусть — их смотрят в справке.', 'Words starting with a hyphen are called options or flags: they say “how”. Nobody learns them by heart; they are looked up in the documentation.'),
  },
  {
    id: 'orient.q.fill-echo',
    kind: 'fill-command',
    concepts: ['orient.command', 'orient.file'],
    prompt: bi('Запишите в файл `hello.txt` строку `hello`. Напечатайте строку команды целиком.', 'Write the line `hello` into the file `hello.txt`. Type the whole command line.'),
    setup: { hostname: 'trainer' },
    check: { when: "files['/home/learner/hello.txt'].text~'hello'" },
    misconceptions: [{ match: '^echo hello$', why: bi('Так строка напечатается на экран. Чтобы она ушла в файл, после неё нужен знак `>` и имя файла.', 'This prints the line on the screen. To send it to a file, add the `>` sign and the file name.') }],
    explain: bi('`echo` печатает то, что ему дали, а знак `>` отправляет напечатанное не на экран, а в файл. Если файла не было, он появится.', '`echo` prints what it is given, and the `>` sign sends the printout not to the screen but to a file. If the file did not exist, it appears.'),
  },
  {
    id: 'orient.q.help',
    kind: 'mcq',
    concepts: ['orient.command'],
    prompt: bi('Вы забыли, как у `ls` включить подробный список. Где посмотреть быстрее всего?', 'You forgot how to make `ls` show a detailed list. Where is it fastest to look?'),
    options: [
      { id: 'help', text: bi('`ls --help` прямо на машине', '`ls --help` right on the machine'), correct: true },
      { id: 'ask', text: bi('Спросить коллегу в чате', 'Ask a colleague in the chat'), why: bi('Коллега ответит, но через минуты; справка у каждой команды под рукой сразу и всегда.', 'A colleague will answer, but in minutes; every command’s help is at hand at once and always.') },
      { id: 'guess', text: bi('Перебрать буквы наугад', 'Try letters at random'), why: bi('Наугад можно случайно включить что-нибудь опасное. Справка дешевле.', 'At random you might switch on something dangerous. The help is cheaper.') },
    ],
    explain: bi('Почти у любой команды есть справка: `--help` — короткая, `man` и имя команды — подробная. Дальше по курсу вы будете заглядывать туда всё чаще.', 'Almost every command has help: `--help` is the short one, `man` plus the command name the detailed one. Further on in the course you will look there more and more.'),
  },
];

export const textLesson: Lesson = {
  id: 'orient.text',
  block: 'orient',
  title: bi('Разговор текстом: команды', 'Talking in text: commands'),
  summary: bi('Почему с машинами говорят строками текста, из каких слов строка состоит и где у каждой команды справка.', 'Why people talk to machines in lines of text, which words a line is made of and where every command keeps its help.'),
  introduces: ['orient.command'],
  uses: ['orient.os', 'orient.file'],
  tier: 'core',
  minutes: 20,
  sources: sources([EN.cli, EN.tlcl], [RU.cli]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Окна, значки и мышь — удобный способ говорить с компьютером, который стоит перед вами. Но машина, на которой работает сайт магазина, стоит в чужом здании за сотни километров, у неё нет ни монитора, ни мыши, а иногда таких машин у компании тысяча. С ними говорят по-другому: печатают строку текста, а машина выполняет её и отвечает тоже текстом. На учебной машине вы уже так делали. Теперь разберёмся, что именно вы печатали.',
        'Windows, icons and a mouse are a handy way to talk to the computer in front of you. But the machine that runs a shop’s site stands in someone else’s building hundreds of kilometres away; it has no monitor and no mouse, and sometimes a company has a thousand such machines. People talk to them differently: they type a line of text, and the machine carries it out and answers in text too. You have already done this on the training machine. Now let us see what exactly you were typing.',
      ),
    },
    {
      id: 'command',
      kind: 'text',
      step: 'explain',
      title: bi('Строка — это слова', 'A line is words'),
      body: bi(
        'Строка, которую вы печатаете машине и отправляете клавишей Enter, называется [[orient.command|командой]]. Машина делит её на слова по пробелам. Первое слово говорит, **что сделать**: `ls` — показать список, `cat` — вывести файл, `mkdir` — создать папку. Остальные слова уточняют, **с чем** и **как**:\n\n```\nls -l notes\n```\n\nЗдесь `ls` — что сделать, `notes` — с какой папкой, а `-l` — как: подробно, с размерами и датами. Слова с дефисом называют опциями. Учить их наизусть не нужно: у каждой команды есть справка, и через пару блоков вы будете находить в ней нужную опцию быстрее, чем вспоминать.\n\nКаждое слово команды — сокращение английского: `ls` — list, `pwd` — print working directory, `mkdir` — make directory, `cat` — concatenate, «склеить» (команда умеет выводить подряд несколько файлов). Знать это полезно: сокращение подсказывает, что делает команда, и её проще запомнить.\n\nЕщё одно правило пригодится сразу. Знак `>` после команды отправляет то, что она напечатала бы на экран, в файл:\n\n```\necho "buy milk" > notes/shopping.txt\n```\n\n`echo` просто печатает свои слова, а `>` кладёт их в файл `shopping.txt`. Если такого файла не было, он появится; если был — его прежнее содержимое заменится.',
        'The line you type to a machine and send with the Enter key is called a [[orient.command|command]]. The machine splits it into words at the spaces. The first word says **what to do**: `ls` lists, `cat` prints a file, `mkdir` makes a folder. The other words refine **with what** and **how**:\n\n```\nls -l notes\n```\n\nHere `ls` is what to do, `notes` is which folder, and `-l` is how: in detail, with sizes and dates. Words with a hyphen are called options. There is no need to learn them by heart: every command has its help, and in a couple of blocks you will find the right option there faster than you could recall it.\n\nEvery command word is an English abbreviation: `ls` is list, `pwd` is print working directory, `mkdir` is make directory, `cat` is concatenate (the command can print several files one after another). Knowing this helps: the abbreviation hints at what the command does and makes it easier to remember.\n\nOne more rule will be useful right away. The `>` sign after a command sends what it would have printed on the screen into a file:\n\n```\necho "buy milk" > notes/shopping.txt\n```\n\n`echo` simply prints its words, and `>` puts them into the file `shopping.txt`. If there was no such file, it appears; if there was, its old contents are replaced.',
      ),
    },
    {
      id: 'why',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Почему текст, а не кнопки', 'Why text rather than buttons'),
      body: bi(
        'Команду можно скопировать коллеге в чат, записать в инструкцию и через год выполнить снова — с тем же результатом. Её можно отправить сразу на сто машин. Щелчок мышью нельзя ни переслать, ни повторить точно. Поэтому почти вся работа с машинами, которые обслуживают сайты, идёт текстом.',
        'A command can be copied to a colleague in a chat, written into an instruction and run again a year later with the same result. It can be sent to a hundred machines at once. A mouse click can be neither forwarded nor repeated exactly. That is why almost all work with the machines that serve sites is done in text.',
      ),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: desk(),
      intro: bi('Пять минут на учебной машине. Если ошибётесь в букве, машина ответит, что не знает такой команды, — исправьте и попробуйте снова. Стрелка вверх возвращает прошлую строку.', 'Five minutes on the training machine. If you mistype a letter, the machine answers that it knows no such command: fix it and try again. The up arrow brings back the previous line.'),
      tasks: [
        {
          id: 'who',
          prompt: bi('Под каким именем вы работаете на этой машине? Команда `whoami` — «who am I».', 'Which name are you working under on this machine? The command is `whoami`, “who am I”.'),
          check: { stdout: /^learner\n?$/ },
          chips: 'whoami',
          docRef: man('whoami.1'),
          concepts: ['orient.command'],
          hints: { H1: bi('Одно слово без пробелов.', 'One word, no spaces.') },
        },
        {
          id: 'detail',
          prompt: bi('Посмотрите на папку `notes` подробно: `ls -l notes`. Чем ответ отличается от простого `ls notes`?', 'Look at the folder `notes` in detail: `ls -l notes`. How does the answer differ from plain `ls notes`?'),
          check: { stdout: /todo\.txt/ },
          chips: 'ls -l notes',
          docRef: man('ls.1', 'OPTIONS', '-l'),
          concepts: ['orient.command'],
          hints: { H1: bi('Между словами пробелы: `ls`, пробел, `-l`, пробел, `notes`.', 'Spaces between the words: `ls`, space, `-l`, space, `notes`.') },
        },
        {
          id: 'write',
          prompt: bi('Запишите список покупок: `echo "buy milk" > notes/shopping.txt`. Потом прочитайте его командой `cat`.', 'Write a shopping list: `echo "buy milk" > notes/shopping.txt`. Then read it with `cat`.'),
          check: { when: "files['/home/learner/notes/shopping.txt'].text~'buy milk'" },
          chips: 'echo "buy milk" > notes/shopping.txt',
          docRef: man('echo.1'),
          concepts: ['orient.command', 'orient.file'],
          hints: { H1: bi('Кавычки нужны, чтобы два слова «buy milk» стали одним куском текста.', 'The quotes make the two words “buy milk” one piece of text.') },
        },
      ],
    },
    {
      id: 'doc',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('У каждой команды есть подробная справка. Откройте справку `ls` и нажмите на раздел, где перечислены опции — те самые слова с дефисом.', 'Every command has a detailed help page. Open the help for `ls` and click the section that lists the options, the very words with a hyphen.'),
      ref: { page: 'man/ls.1' },
      answer: 'OPTIONS',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: textQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Команда — строка текста: первое слово говорит, что сделать, остальные — с чем и как. Слова с дефисом — опции, их смотрят в справке. Знак `>` отправляет вывод в файл. Текст можно переслать, записать и повторить, поэтому с удалёнными машинами работают именно так.',
        'A command is a line of text: the first word says what to do, the rest with what and how. Words with a hyphen are options, looked up in the help. The `>` sign sends output to a file. Text can be forwarded, written down and repeated, which is why remote machines are worked with exactly this way.',
      ),
    },
  ],
};

// ── 4. Networks and the internet ───────────────────────────────────────────

export const netQuiz: QuizItem[] = [
  {
    id: 'orient.q.internet-is',
    kind: 'mcq',
    key: true,
    concepts: ['orient.internet'],
    prompt: bi('Что такое интернет?', 'What is the internet?'),
    options: [
      { id: 'nets', text: bi('Десятки тысяч сетей разных владельцев, которые договорились передавать сообщения друг друга', 'Tens of thousands of networks with different owners that agreed to pass each other’s messages on'), correct: true },
      { id: 'one', text: bi('Одна большая сеть, которой владеет международная организация', 'One big network owned by an international organisation'), why: bi('Единого владельца у интернета нет. Есть домашние сети, сети провайдеров, компаний, университетов — и договорённости между ними.', 'The internet has no single owner. There are home networks, networks of providers, companies and universities, and agreements between them.') },
      { id: 'wifi', text: bi('Wi-Fi в квартире', 'The Wi-Fi in your flat'), why: bi('Wi-Fi — только последний кусок пути, от ноутбука до домашнего роутера.', 'Wi-Fi is only the last piece of the path, from the laptop to the home router.') },
    ],
    explain: bi('Само слово так и переводится: «между сетями». Подробная карта интернета будет в блоке «Сети».', 'The word itself means “between networks”. A detailed map of the internet comes in the Networks block.'),
  },
  {
    id: 'orient.q.address',
    kind: 'mcq',
    concepts: ['orient.network'],
    prompt: bi('Зачем у каждого компьютера в сети есть адрес?', 'Why does every computer on a network have an address?'),
    options: [
      { id: 'deliver', text: bi('Чтобы сообщение для него можно было доставить именно ему', 'So that a message for it can be delivered to it and nobody else'), correct: true },
      { id: 'name', text: bi('Чтобы владелец мог дать компьютеру красивое имя', 'So that the owner can give the computer a pretty name'), why: bi('Имена для людей тоже есть, но доставка идёт по числовому адресу.', 'There are names for people too, but delivery goes by the numeric address.') },
      { id: 'speed', text: bi('Чтобы сеть работала быстрее', 'So that the network runs faster'), why: bi('Скорость от адреса не зависит. Адрес нужен, чтобы знать, куда везти.', 'Speed does not depend on the address. The address says where to carry the message.') },
    ],
    explain: bi('Как у дома на улице: без адреса письмо не найдёт получателя.', 'Like a house on a street: without an address a letter cannot find its recipient.'),
  },
  {
    id: 'orient.q.far',
    kind: 'mcq',
    concepts: ['orient.network', 'orient.internet'],
    prompt: bi('Почему страница из соседнего города открывается быстрее, чем такая же страница с другого континента?', 'Why does a page from the next city open faster than the same page from another continent?'),
    options: [
      { id: 'dist', text: bi('Сообщению дольше ехать: даже свету через океан нужны десятки миллисекунд', 'The message has further to go: even light needs tens of milliseconds to cross an ocean'), correct: true },
      { id: 'lang', text: bi('Её приходится переводить на другой язык', 'It has to be translated into another language'), why: bi('Сеть ничего не переводит, она только доставляет.', 'The network translates nothing; it only delivers.') },
      { id: 'cust', text: bi('На границе её проверяет таможня', 'Customs checks it at the border'), why: bi('Это шутка, но расстояние — настоящая причина: время в пути не уменьшить ничем, кроме приближения.', 'That is a joke, but distance is the real reason: the travel time cannot be cut by anything except getting closer.') },
    ],
    explain: bi('Поэтому крупные сайты держат копии своих страниц в разных частях света — поближе к людям.', 'That is why big sites keep copies of their pages in different parts of the world, closer to the people.'),
  },
];

export const netLesson: Lesson = {
  id: 'orient.net',
  block: 'orient',
  title: bi('Сеть и интернет', 'Networks and the internet'),
  summary: bi('Как компьютеры посылают друг другу сообщения по адресам и почему интернет — сеть из сетей, у которой нет одного хозяина.', 'How computers send each other messages by address and why the internet is a network of networks with no single owner.'),
  introduces: ['orient.network', 'orient.internet'],
  uses: ['orient.computer', 'orient.command'],
  tier: 'core',
  minutes: 20,
  sources: sources([EN.network, EN.internet, EN.mdnWeb], [RU.network, RU.internet]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы нажимаете на ссылку, и через полсекунды на экране страница магазина, чьи компьютеры стоят в другом городе. Между вашим ноутбуком и ними — роутер в прихожей, провода провайдера, кабели под землёй, а может быть, и под океаном. Никто не прокладывал отдельный провод от вашей квартиры до магазина. Как же сообщение находит дорогу?',
        'You click a link, and half a second later the shop’s page is on the screen, though its computers stand in another city. Between your laptop and them lie the router in your hallway, the provider’s wires, cables under the ground and perhaps under the ocean. Nobody laid a separate wire from your flat to the shop. So how does a message find its way?',
      ),
    },
    {
      id: 'network',
      kind: 'text',
      step: 'explain',
      title: bi('Сеть', 'A network'),
      body: bi(
        '[[orient.network|Сеть]] — это компьютеры, соединённые проводами или радиоволнами так, что могут посылать друг другу сообщения. Ваш ноутбук, телефон и телевизор, подключённые к одному роутеру, — маленькая домашняя сеть. В офисе сеть побольше, у провайдера — огромная.\n\nЧтобы сообщение нашло получателя, у каждого компьютера в сети есть **адрес** — набор чисел, похожий на `198.51.100.20`. Отправитель пишет на сообщении адрес получателя, и сеть доставляет его так же, как почта доставляет письмо: не зная, что внутри. Большое сообщение — фотография, страница — режется на небольшие куски, каждый идёт со своим адресом, а у получателя куски собираются обратно.\n\nЛюдям числа запоминать неудобно, поэтому у компьютеров есть ещё и имена вроде `shop.example`. Когда вы пишете имя, ваш компьютер сначала спрашивает в сети, какой адрес ему соответствует, — примерно как вы смотрите номер телефона в записной книжке, прежде чем позвонить.',
        'A [[orient.network|network]] is computers connected by wires or radio waves so that they can send each other messages. Your laptop, phone and TV, connected to one router, are a small home network. An office has a bigger network, a provider a huge one.\n\nFor a message to find its recipient, every computer on a network has an **address**, a set of numbers like `198.51.100.20`. The sender writes the recipient’s address on the message, and the network delivers it the way the post delivers a letter: without knowing what is inside. A big message, a photo or a page, is cut into small pieces, each travels with its own address, and at the recipient the pieces are put back together.\n\nNumbers are hard for people to remember, so computers also have names such as `shop.example`. When you type a name, your computer first asks the network which address belongs to it, much as you look up a phone number in your address book before calling.',
      ),
    },
    {
      id: 'internet',
      kind: 'text',
      step: 'explain',
      title: bi('Сеть из сетей', 'A network of networks'),
      body: bi(
        'Ваш роутер соединяет домашнюю сеть с сетью провайдера. Провайдер соединён с другими провайдерами, те — с третьими, и где-то в этой цепочке есть сеть, к которой подключены компьютеры магазина. Это и есть [[orient.internet|интернет]]: десятки тысяч сетей разных владельцев, которые договорились передавать сообщения друг друга. Хозяина у интернета нет, есть общие правила и договоры между соседями.\n\nСообщение идёт по этой цепочке прыжками: от ноутбука к роутеру, от роутера к провайдеру, от провайдера к следующему — пока не дойдёт до сети получателя. Каждый узел на пути смотрит только на адрес и решает, кому передать дальше. На каждый прыжок уходит время, и чем дальше получатель, тем больше прыжков и тем длиннее провода. Сообщение через страну идёт десятки миллисекунд, через океан — около сотни: даже свет в стекле быстрее не умеет.\n\nКак именно устроены адреса, прыжки и поиск адреса по имени, подробно разберёт блок «Сети». Пока достаточно картины: сеть доставляет сообщения по адресам, интернет — множество сетей, связанных договорами, а расстояние стоит времени.',
        'Your router connects the home network to the provider’s network. The provider is connected to other providers, those to others still, and somewhere along this chain is the network the shop’s computers are attached to. That is the [[orient.internet|internet]]: tens of thousands of networks with different owners that agreed to pass each other’s messages on. The internet has no owner; it has common rules and agreements between neighbours.\n\nA message travels along this chain in hops: from the laptop to the router, from the router to the provider, from the provider to the next one, until it reaches the recipient’s network. Each node on the way looks only at the address and decides whom to hand it to next. Each hop takes time, and the further away the recipient, the more hops and the longer the wires. A message crosses a country in tens of milliseconds and an ocean in about a hundred: even light in glass cannot go faster.\n\nHow exactly addresses, hops and finding an address by name work is taken apart in the Networks block. For now the picture is enough: a network delivers messages by address, the internet is many networks tied by agreements, and distance costs time.',
      ),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: laptop(),
      intro: bi('Теперь вы на учебном ноутбуке, подключённом к интернету курса. Где-то в нём есть магазин `shop.example`.', 'Now you are on a training laptop connected to the course’s internet. Somewhere in it is the shop `shop.example`.'),
      tasks: [
        {
          id: 'ping',
          prompt: bi('Отправьте магазину три коротких сообщения и посмотрите, сколько миллисекунд идёт ответ: `ping -c 3 shop.example`. Число после `time=` — время туда и обратно.', 'Send the shop three short messages and see how many milliseconds the answer takes: `ping -c 3 shop.example`. The number after `time=` is the time there and back.'),
          check: { stdout: /3 packets transmitted, 3 received/ },
          chips: 'ping -c 3 shop.example',
          docRef: { page: 'help/ping', anchor: 'OPTIONS', line: '-c' },
          concepts: ['orient.network', 'orient.internet'],
          hints: { H1: bi('`-c 3` значит «три раза»; без него `ping` будет посылать сообщения, пока его не остановят.', '`-c 3` means “three times”; without it `ping` keeps sending until it is stopped.') },
        },
        {
          id: 'address',
          prompt: bi('Посмотрите в первой строке ответа: какой числовой адрес у имени `shop.example`? Запишите его в файл: `echo <адрес> > shop-address.txt`.', 'Look at the first line of the answer: what numeric address does the name `shop.example` have? Write it into a file: `echo <address> > shop-address.txt`.'),
          check: { when: "files['/home/learner/shop-address.txt'].text~'198.51.100.20'" },
          concepts: ['orient.network'],
          hints: { H1: bi('Адрес стоит в скобках сразу после имени: `PING shop.example (…)`.', 'The address is in brackets right after the name: `PING shop.example (…)`.'), H2: bi('Это четыре числа через точку, начинаются с 198.', 'It is four numbers separated by dots, starting with 198.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: netQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Сеть доставляет сообщения между компьютерами по адресам, имена нужны людям и переводятся в адреса. Интернет — десятки тысяч сетей, связанных договорами; сообщение идёт по ним прыжками, и чем дальше получатель, тем дольше путь.',
        'A network delivers messages between computers by address; names are for people and are turned into addresses. The internet is tens of thousands of networks tied by agreements; a message travels across them in hops, and the further the recipient, the longer the trip.',
      ),
    },
  ],
};

// ── 5. Servers, clients and requests ───────────────────────────────────────

export const requestsQuiz: QuizItem[] = [
  {
    id: 'orient.q.who-starts',
    kind: 'mcq',
    key: true,
    concepts: ['orient.client-request', 'orient.server'],
    prompt: bi('Кто начинает разговор, когда вы открываете страницу магазина?', 'Who starts the conversation when you open a shop’s page?'),
    options: [
      { id: 'client', text: bi('Ваш браузер: он клиент и отправляет запрос', 'Your browser: it is the client and sends a request'), correct: true },
      { id: 'server', text: bi('Сервер магазина: он сам присылает страницы тем, кто к нему подключён', 'The shop’s server: it sends pages to whoever is connected'), why: bi('Сервер ждёт и отвечает, но первым не пишет. Без запроса он не знает, что кому-то нужна страница.', 'A server waits and answers but never writes first. Without a request it does not know anyone needs a page.') },
      { id: 'provider', text: bi('Провайдер интернета', 'The internet provider'), why: bi('Провайдер только везёт сообщения; разговор ведут клиент и сервер.', 'The provider only carries the messages; the conversation is between the client and the server.') },
    ],
    explain: bi('Клиент просит, сервер отвечает. Эта пара встречается везде: браузер и сайт, приложение банка и его серверы, ваша программа и база данных.', 'The client asks, the server answers. This pair is everywhere: a browser and a site, a banking app and its servers, your program and a database.'),
    refs: { explainer: 'orient.request' },
  },
  {
    id: 'orient.q.server-is',
    kind: 'mcq',
    concepts: ['orient.server'],
    prompt: bi('Чем сервер отличается от вашего ноутбука?', 'How does a server differ from your laptop?'),
    options: [
      { id: 'role', text: bi('Внутри то же самое, разница в работе: он без перерыва обслуживает других', 'Inside it is the same; the difference is the job: it serves others without a break'), correct: true },
      { id: 'magic', text: bi('Это особый вид компьютера без процессора и памяти', 'It is a special kind of computer without a processor or memory'), why: bi('У сервера те же процессор, память, диск и операционная система, просто их больше и они надёжнее.', 'A server has the same processor, memory, disk and operating system, just more of them and more reliable.') },
      { id: 'site', text: bi('Сервер — это сам сайт, а не машина', 'A server is the site itself, not a machine'), why: bi('Сайт — программа, которая работает на сервере. Сервер — машина, на которой она работает.', 'A site is a program running on a server. The server is the machine it runs on.') },
    ],
    explain: bi('Слово «сервер» говорят и про машину, и про программу, которая на ней отвечает на запросы. Различать их помогает вопрос: «машина включена, а программа запущена?»', 'The word “server” is used both for the machine and for the program on it that answers requests. Telling them apart is helped by the question: “is the machine on, and is the program running?”'),
  },
  {
    id: 'orient.q.overload',
    kind: 'mcq',
    concepts: ['orient.server', 'orient.client-request'],
    prompt: bi('Сервер успевает ответить на 200 запросов в секунду. В распродажу приходит 400. Что увидят покупатели?', 'A server can answer 200 requests a second. During a sale 400 arrive. What will the shoppers see?'),
    options: [
      { id: 'err', text: bi('Очередь переполнится, часть получит ошибку «сервер перегружен»', 'The queue overflows, and some get a “server overloaded” error'), correct: true },
      { id: 'half', text: bi('Все получат страницу, просто в два раза медленнее', 'Everyone gets the page, just twice as slowly'), why: bi('Если запросов приходит больше, чем сервер успевает обслужить, очередь растёт без конца; медленно становится задолго до 200, а после — ошибки.', 'If more requests arrive than the server can serve, the queue grows without end; it gets slow long before 200, and beyond it come errors.') },
      { id: 'none', text: bi('Ничего: сервер станет работать быстрее', 'Nothing: the server will work faster'), why: bi('Скорость одного сервера ограничена. Выручают второй сервер или лёгкие страницы.', 'One server’s speed is limited. A second server or lighter pages help.') },
    ],
    explain: bi('В объяснении это видно: ожидание растёт тем круче, чем ближе загрузка к 100%. Поэтому к распродажам готовятся заранее и добавляют серверы.', 'The explainer shows it: the wait rises more steeply the closer the load is to 100%. That is why sales are prepared for in advance by adding servers.'),
    refs: { explainer: 'orient.request' },
  },
  {
    id: 'orient.q.refused-timeout',
    kind: 'match',
    concepts: ['orient.server', 'orient.client-request'],
    prompt: bi('Сопоставьте, что сломалось, и что увидит браузер.', 'Match what broke with what the browser sees.'),
    pairs: [
      { id: 'prog', left: bi('Машина включена, программа магазина остановлена', 'The machine is on, the shop program is stopped'), right: bi('сразу ошибка «соединение отвергнуто»', 'an immediate “connection refused” error') },
      { id: 'net', left: bi('Кабель между городами перерублен', 'The cable between cities is cut'), right: bi('долгое ожидание, потом «время вышло»', 'a long wait, then “timed out”') },
      { id: 'load', left: bi('Покупателей больше, чем сервер успевает', 'More shoppers than the server can handle'), right: bi('ответ 503: «сервер перегружен»', 'answer 503: “server overloaded”') },
    ],
    explain: bi('По виду ошибки уже можно сказать, где искать: отказ — машина отвечает, но программа не слушает; тишина — сообщение не дошло; 503 — дошло, но сервер не справляется.', 'The kind of error already tells you where to look: a refusal means the machine answers but the program is not listening; silence means the message did not arrive; 503 means it arrived but the server cannot cope.'),
    refs: { explainer: 'orient.request' },
  },
  {
    id: 'orient.q.predict-curl',
    kind: 'predict-output',
    concepts: ['orient.client-request'],
    prompt: bi('Что напечатает эта команда на учебном ноутбуке?', 'What will this command print on the training laptop?'),
    command: 'curl https://nosuch.example/',
    setup: { hostname: 'laptop', ext: { net: { preset: 'home' } } },
    options: [
      { id: 'dns', text: 'curl: (6) Could not resolve host: nosuch.example', correct: true },
      { id: 'page', text: '<h1>Catalog</h1>', why: bi('Каталог отдаёт `shop.example`. Такого имени, как `nosuch.example`, в сети нет.', '`shop.example` serves the catalogue. There is no such name as `nosuch.example` on the network.') },
      { id: 'refused', text: "curl: (7) Failed to connect to nosuch.example port 443: Couldn't connect to server", why: bi('До подключения дело не дошло: клиент не нашёл адреса для этого имени.', 'It never got as far as connecting: the client found no address for this name.') },
    ],
    explain: bi('Прежде чем отправить запрос, клиент ищет адрес по имени. Опечатка в имени — и запрос никуда не уходит.', 'Before sending a request, the client looks up the address for the name. A typo in the name, and the request goes nowhere.'),
  },
];

export const requestsLesson: Lesson = {
  id: 'orient.requests',
  block: 'orient',
  title: bi('Сервер, клиент и запрос', 'Server, client and request'),
  summary: bi('Машина, которая круглые сутки обслуживает других; программа, которая просит; что происходит, когда просящих становится слишком много.', 'A machine that serves others around the clock; a program that asks; what happens when there are too many asking.'),
  introduces: ['orient.server', 'orient.client-request'],
  uses: ['orient.os', 'orient.network', 'orient.internet', 'orient.command'],
  tier: 'core',
  minutes: 30,
  sources: sources([EN.clientServer, EN.server, EN.mdnHttp], [RU.clientServer, RU.server, RU.mdnHttp]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Чайный магазин работает круглые сутки: в три часа ночи кто-то из Владивостока смотрит каталог, а в полдень его открывают тысячи людей сразу. Ваш ноутбук для этого не годится — его закрывают, увозят, выключают на ночь. Значит, где-то должна стоять машина, которая не выключается никогда и только тем и занята, что отвечает на чужие просьбы. Как она устроена и что с ней бывает, когда просящих слишком много?',
        'A tea shop works around the clock: at three in the morning someone in Vladivostok browses the catalogue, and at noon thousands open it at once. Your laptop will not do for that: it gets closed, carried off, switched off for the night. So somewhere there must be a machine that is never switched off and does nothing but answer other people’s requests. How does it work, and what happens to it when too many are asking?',
      ),
    },
    {
      id: 'server',
      kind: 'text',
      step: 'explain',
      title: bi('Сервер', 'A server'),
      body: bi(
        '[[orient.server|Сервер]] — компьютер, который работает без перерыва и обслуживает другие. Внутри у него всё то же: процессор, память, диск, операционная система (почти всегда Linux). Отличается работа. Сервер стоит в специальном здании с резервным питанием и охлаждением, обычно у него нет ни экрана, ни клавиатуры, а говорят с ним командами по сети. И на нём запущена программа, которая ждёт просьб и отвечает на них: отдаёт страницы, принимает заказы, хранит данные.\n\nСловом «сервер» называют и машину, и эту программу. Обычно из разговора понятно, о чём речь, а когда непонятно, помогает вопрос: «машина включена? а программа на ней запущена?» Это два разных ответа, и в объяснении ниже вы увидите, чем они отличаются.',
        'A [[orient.server|server]] is a computer that runs without a break and serves others. Inside it has all the same: a processor, memory, a disk, an operating system (almost always Linux). The job is what differs. A server stands in a special building with backup power and cooling, usually has no screen or keyboard, and is talked to with commands over the network. And a program runs on it that waits for requests and answers them: it hands out pages, takes orders, keeps data.\n\nThe word “server” names both the machine and that program. Usually the conversation makes clear which is meant, and when it does not, the question helps: “is the machine on? and is the program on it running?” These are two different answers, and in the explainer below you will see how they differ.',
      ),
    },
    {
      id: 'client',
      kind: 'text',
      step: 'explain',
      title: bi('Клиент просит, сервер отвечает', 'The client asks, the server answers'),
      body: bi(
        'Программа, которая обращается к серверу, называется [[orient.client-request|клиентом]], а её просьба — запросом. Ваш браузер — клиент: когда вы открываете каталог, он отправляет на сервер магазина несколько строк текста, смысл которых — «дайте, пожалуйста, страницу /catalog». Сервер находит нужные данные, составляет из них страницу и присылает ответ. Ответ начинается с числа, по которому клиент понимает, как прошло дело: 200 — всё в порядке, 404 — такой страницы нет, 503 — сервер перегружен.\n\nВажное правило: разговор всегда начинает клиент. Сервер сам никому не пишет — он даже не знает, что вы существуете, пока не придёт ваш запрос.\n\nОдин сервер обслуживает многих клиентов, и тут начинается самое интересное для эксплуатации. Если программа тратит на запрос пять миллисекунд, она успевает ответить на двести запросов в секунду. Пока приходит пятьдесят, никто не ждёт. Когда приходит сто девяносто, запросы выстраиваются в очередь, и ожидание растёт куда быстрее, чем число покупателей. А если приходит больше двухсот, очередь переполняется, и часть людей получает 503. Ниже это можно увидеть своими глазами и посмотреть, что помогает: второй сервер или сервер поближе.',
        'The program that turns to a server is called the [[orient.client-request|client]], and what it asks for is a request. Your browser is a client: when you open the catalogue, it sends the shop’s server a few lines of text meaning “please give me the page /catalog”. The server finds the data, puts the page together and sends an answer. The answer begins with a number that tells the client how things went: 200 means all is well, 404 no such page, 503 the server is overloaded.\n\nAn important rule: the client always starts the conversation. A server never writes to anyone by itself; it does not even know you exist until your request arrives.\n\nOne server serves many clients, and this is where it gets interesting for operations. If the program spends five milliseconds per request, it can answer two hundred requests a second. While fifty arrive, nobody waits. When a hundred and ninety arrive, requests line up in a queue, and the wait grows much faster than the number of shoppers. And if more than two hundred arrive, the queue overflows and some people get 503. Below you can see it with your own eyes and find out what helps: a second server or a server closer by.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.request', caption: bi('Справа от схемы — «водопад»: на что ушло время запроса. Приведите толпу покупателей, увезите сервер за океан, остановите программу.', 'To the right of the diagram is a waterfall: where the request’s time went. Bring a crowd of shoppers, move the server across the ocean, stop the program.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: laptop(),
      intro: bi('Учебный ноутбук. `curl` — клиент без окон: он отправляет запрос и печатает ответ сервера как есть, текстом.', 'The training laptop. `curl` is a client without windows: it sends a request and prints the server’s answer as it is, in text.'),
      tasks: [
        {
          id: 'page',
          prompt: bi('Попросите у сервера магазина главную страницу: `curl https://shop.example/`. Браузер нарисовал бы из этого текста страницу с заголовком Catalog.', 'Ask the shop’s server for the main page: `curl https://shop.example/`. A browser would draw a page headed Catalog from this text.'),
          check: { stdout: /<h1>Catalog<\/h1>/ },
          chips: 'curl https://shop.example/',
          docRef: man('curl.1'),
          concepts: ['orient.client-request', 'orient.server'],
          hints: { H1: bi('Адрес целиком, вместе с `https://` и косой чертой в конце.', 'The whole address, with `https://` and the slash at the end.') },
        },
        {
          id: 'status',
          prompt: bi('Теперь только начало ответа, без страницы: `curl -I https://shop.example/`. Найдите число в первой строке — что сервер сказал о запросе?', 'Now only the beginning of the answer, without the page: `curl -I https://shop.example/`. Find the number in the first line: what did the server say about the request?'),
          check: { stdout: /HTTP\/1\.1 200 OK/ },
          chips: 'curl -I https://shop.example/',
          docRef: man('curl.1', 'OPTIONS', '-I'),
          concepts: ['orient.client-request'],
          hints: { H1: bi('`-I` — заглавная i: «покажи только заголовки ответа».', '`-I` is a capital i: “show only the headers of the answer”.') },
        },
        {
          id: 'typo',
          prompt: bi('Ошибитесь нарочно: запросите `https://shop.exmaple/` — с опечаткой в имени. Какую ошибку напечатал клиент и почему до сервера дело не дошло?', 'Make a mistake on purpose: request `https://shop.exmaple/`, with a typo in the name. Which error did the client print, and why did it never reach the server?'),
          check: { stdout: /Could not resolve host/ },
          chips: 'curl https://shop.exmaple/',
          concepts: ['orient.client-request', 'orient.network'],
          hints: { H1: bi('Клиент сначала ищет адрес по имени. Такого имени нет — искать сервер негде.', 'The client first looks up the address for the name. There is no such name, so there is no server to find.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: requestsQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Сервер — машина, которая без перерыва обслуживает других, и программа на ней, которая отвечает. Клиент начинает разговор запросом, сервер отвечает числом и данными. Один сервер обслуживает многих; когда загрузка подходит к пределу, ожидание растёт резко, а за пределом приходят ошибки.',
        'A server is a machine that serves others without a break, plus the program on it that answers. The client starts the conversation with a request, the server answers with a number and data. One server serves many; as the load nears its limit the wait rises sharply, and beyond the limit come errors.',
      ),
    },
  ],
};
