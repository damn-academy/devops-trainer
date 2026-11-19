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
    prompt: bi('Вы три часа писали отчёт и ни разу его не сохранили. Свет моргнул, и ноутбук без батареи выключился. Что вы найдёте, когда включите его снова?', 'You wrote a report for three hours without saving it. The power flickered and the laptop, which has no battery, switched off. What will you find after switching on?'),
    options: [
      { id: 'prog', text: bi('Вы найдёте программу, но не отчёт', 'You will find the program, but not the report'), correct: true, why: bi('Программа хранится на диске, поэтому она уцелела. Несохранённый текст был только в памяти, а память пустеет, как только пропадает питание.', 'The program lives on the disk, while the unsaved text lived only in memory, which forgets everything without power.') },
      { id: 'all', text: bi('Вы найдёте и программу, и отчёт, потому что компьютер помнит всё', 'You will find both the program and the report, because the computer remembers everything'), why: bi('Диск помнит всё, что на него записали, но до нажатия «Сохранить» текст был только в памяти. При выключении память пустеет, и всё несохранённое пропадает.', 'The disk remembers, but until you press “Save” the text lay in memory. Memory is wiped at power-off.') },
      { id: 'none', text: bi('Вы не найдёте ни программы, ни отчёта', 'You will find neither the program nor the report'), why: bi('Программа записана на диск, а диску выключение не страшно.', 'The program is written on the disk, and the disk does not mind a power-off.') },
    ],
    explain: bi('Память работает быстро, но хранит данные, только пока есть питание. Диск работает медленнее, зато хранит данные годами. Кнопка «Сохранить» как раз и копирует текст из памяти на диск.', 'Memory is fast but holds data only while powered. The disk is slower but keeps data for years. The “Save” button is exactly a copy from memory to the disk.'),
    refs: { lesson: 'orient.inside', explainer: 'orient.run' },
  },
  {
    id: 'orient.q.match-parts',
    kind: 'match',
    concepts: ['orient.computer'],
    prompt: bi('Сопоставьте каждую часть компьютера с её работой.', 'Match each part of the computer with its job.'),
    pairs: [
      { id: 'cpu', left: bi('Процессор', 'Processor'), right: bi('выполняет инструкции одну за другой', 'carries out instructions one after another') },
      { id: 'ram', left: bi('Память', 'Memory'), right: bi('хранит то, с чем компьютер работает сейчас', 'holds what is being worked on right now') },
      { id: 'disk', left: bi('Диск', 'Disk'), right: bi('хранит программы и документы, пока их не удалят', 'keeps programs and documents until they are deleted') },
    ],
    explain: bi('Эти три роли есть в любой машине, от телефона до огромного компьютера в дата-центре.', 'Three roles that repeat in every machine, from a phone to a huge computer in a data centre.'),
  },
  {
    id: 'orient.q.start-order',
    kind: 'order',
    concepts: ['orient.program', 'orient.computer'],
    prompt: bi('Расставьте по порядку, что происходит после двойного щелчка по значку программы.', 'Put in order what happens after a double click on a program’s icon.'),
    steps: [
      { id: 'find', text: bi('по значку компьютер находит файл программы на диске', 'the icon leads to the program file on the disk') },
      { id: 'copy', text: bi('программу копируют с диска в память', 'the program is copied from the disk into memory') },
      { id: 'exec', text: bi('процессор берёт из памяти её инструкции и выполняет их', 'the processor carries out its instructions from memory') },
      { id: 'draw', text: bi('на экране появляется окно программы', 'a window appears on the screen') },
    ],
    explain: bi('Процессор не умеет выполнять программу с диска, поэтому всё, что он выполняет, сначала попадает в память. Поэтому большой программе на медленном диске нужно время, чтобы открыться.', 'The processor cannot work with the disk directly: everything it carries out first lands in memory. That is why a big program on a slow disk takes time to open.'),
    refs: { explainer: 'orient.run' },
  },
  {
    id: 'orient.q.slow-start',
    kind: 'multi',
    concepts: ['orient.computer', 'orient.program'],
    prompt: bi('Программа долго открывается. Что из перечисленного может быть причиной?', 'A program takes a long time to open. Which of these can be the reason?'),
    options: [
      { id: 'big', text: bi('программа большая, и копировать её в память долго', 'the program is big, copying it into memory takes long'), correct: true },
      { id: 'hdd', text: bi('в компьютере старый вращающийся диск (HDD), а не SSD', 'the disk is an old spinning one (HDD) rather than an SSD'), correct: true },
      { id: 'full', text: bi('память занята другими открытыми программами', 'memory is packed with other open programs'), correct: true },
      { id: 'screen', text: bi('экран слишком маленький', 'the screen is too small'), why: bi('Экран только показывает готовую картинку и на скорость запуска не влияет.', 'The screen only shows the finished picture; it does not affect how fast a program starts.') },
    ],
    explain: bi('Запустить программу значит скопировать её с диска в память. Запуск замедляют три вещи: большой размер программы, медленный диск и нехватка свободной памяти, при которой компьютеру приходится выгружать части других программ обратно на диск.', 'Starting is copying from the disk to memory. It is slowed by the size of the program, the speed of the disk and a lack of free memory, when pieces of other programs have to be pushed back out to the disk.'),
    refs: { explainer: 'orient.run' },
  },
  {
    id: 'orient.q.more-ram',
    kind: 'mcq',
    concepts: ['orient.computer'],
    prompt: bi('Коллега жалуется: «У меня открыто сорок вкладок, всё тормозит, а на диске ещё 300\u00A0ГБ свободно». Чего ему, скорее всего, не хватает?', 'A colleague complains: “Forty tabs open, everything is slow, and the disk still has 300 GB free.” What is most likely lacking?'),
    options: [
      { id: 'ram', text: bi('Ему не хватает памяти', 'He lacks memory'), correct: true },
      { id: 'disk', text: bi('Ему не хватает места на диске', 'He lacks disk space'), why: bi('Место на диске есть, а открытые вкладки занимают не диск, а память.', 'There is disk space; open tabs do not live there but in memory.') },
      { id: 'screen', text: bi('Ему нужен экран побольше', 'He needs a bigger screen'), why: bi('Размер экрана на скорость работы не влияет.', 'The screen has nothing to do with speed.') },
    ],
    explain: bi('Память и диск путают постоянно, даже в магазинах техники. Память занята тем, что открыто сейчас, а на диске лежит то, что хранится долго. Поэтому память кончается, когда открыто много программ, а диск — когда сохранено много файлов.', 'Memory and disk are mixed up all the time, even in electronics shops. Memory is what is in use now; the disk is what is kept. Memory runs out when much is open, the disk when much is saved.'),
  },
];

export const insideLesson: Lesson = {
  id: 'orient.inside',
  block: 'orient',
  title: bi('Что внутри компьютера', 'What is inside a computer'),
  summary: bi('Из каких частей состоит компьютер, что делает каждая из них, когда вы запускаете программу, и почему несохранённый текст пропадает при выключении.', 'Processor, memory and disk: who does what when you start a program, and why unsaved work disappears.'),
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
        'Этот блок написан для тех, кто знает компьютер как пользователь: открывает программы и пишет письма, но ни разу не заглядывал внутрь. За десять коротких уроков вы освоите словарь, на котором говорит любая IT-команда, и сделаете первые шаги на учебной машине. Дальше по курсу эти слова встречаются почти в каждом абзаце, и после этого блока вам не придётся спотыкаться о каждое из них.',
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
        'Блок рассчитан на новичков. Если вы работали рядом с IT-командой и её повседневный словарь вам привычен, пройдите на странице блока проверку из трёх вопросов. Она отметит все понятия блока как уже известные, и следующие блоки будут считать, что вы их знаете.',
        'The block is meant for beginners. If you have worked next to an IT team and its everyday vocabulary is familiar, take the three-question check on the block page: it marks all the block’s ideas as known, and the following blocks will not stumble over them.',
      ),
    },
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы три часа писали отчёт. Свет на секунду моргнул, ноутбук без батареи погас, а когда вы включили его снова, программа оказалась на месте, а отчёт пропал. В описании того же ноутбука было написано «16\u00A0ГБ памяти, 512\u00A0ГБ диска», и продавец уверял, что память и диск — разные вещи. Обе истории объясняются тем, как устроен компьютер, и к концу урока вы сможете нарисовать это устройство сами.',
        'You spent three hours writing a report. The power flickered for a second, the laptop without a battery went dark, and after switching on the program is still there; only the report is gone. The same laptop was described as “16 GB of memory, 512 GB of disk”, and the shop assistant insisted these were quite different things. Both cases are explained by one and the same arrangement of a computer, and by the end of the lesson you will be able to draw it.',
      ),
    },
    {
      id: 'parts',
      kind: 'text',
      step: 'explain',
      title: bi('Три главные части компьютера', 'Three parts'),
      body: bi(
        'Внутри любого [[orient.computer|компьютера]], от телефона до огромной машины в дата-центре, работают три главные части, и у каждой из них своя роль.\n\n**Процессор** выполняет инструкции. Инструкцией называют крошечное действие: сложить два числа, сравнить их, перейти к другой инструкции. Сам процессор почти ничего не помнит, зато выполняет миллиарды таких действий в секунду. Когда о компьютере говорят «процессор на 3\u00A0ГГц с четырьмя ядрами», это значит, что внутри процессора четыре независимых исполнителя, которые называют ядрами, и каждый делает около трёх миллиардов шагов в секунду.\n\n**Память**, которую ещё называют оперативной, хранит то, с чем компьютер работает сейчас: открытые программы, страницу в браузере, ваш несохранённый текст. Память работает быстро, но хранит данные, только пока есть питание, и стоит выключить компьютер, как всё её содержимое пропадёт.\n\n**Диск** хранит всё остальное: программы, документы, фотографии. Он в сотни раз медленнее памяти, зато помнит записанное годами, и питание ему для этого не нужно. Старые диски, которые называют HDD, устроены как проигрыватель пластинок: внутри вращаются пластины, а над ними движется головка. Новые диски, SSD, собраны из микросхем и работают примерно в десять раз быстрее.\n\nТеперь история с отчётом понятна. Программа лежала на диске и потому уцелела. Отчёт до нажатия «Сохранить» существовал только в памяти и исчез вместе с питанием. А 16\u00A0ГБ памяти и 512\u00A0ГБ диска описывают разные вещи. Первое число говорит, сколько можно держать открытым одновременно, а второе — сколько можно хранить.',
        'Inside every [[orient.computer|computer]], from a phone to a huge machine in a data centre, three main parts are at work, each with its own role.\n\nThe **processor** carries out instructions. An instruction is a tiny action: add two numbers, compare them, jump to another instruction. The processor itself remembers nothing, but it carries out billions of such actions a second. When someone says “a 3 GHz processor with four cores”, they mean there are four independent workers inside, each making about three billion steps a second.\n\n**Memory** (also called main memory or RAM) holds what the computer is working on right now: open programs, the page in the browser, your unsaved text. It is fast, but it lives only while powered: switch off the power and memory is empty.\n\nThe **disk** keeps everything else: programs, documents, photos. It is hundreds of times slower than memory, but it remembers for years and without power. Old disks, HDDs, work like record players with a moving arm; new ones, SSDs, are made of chips and are about ten times faster.\n\nNow the report story makes sense. The program lay on the disk and survived. Until “Save” was pressed, the report was only in memory, and it vanished with the power. And 16 GB of memory and 512 GB of disk really are different things: how much can be open at once and how much can be kept.',
      ),
    },
    {
      id: 'program',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое программа и что значит её запустить', 'What a program is and what “start” means'),
      body: bi(
        '[[orient.program|Программа]] — это длинная последовательность инструкций для процессора, записанная на диск. Пока программу никто не запустил, она лежит на диске такими же данными, как фотография. Запустить программу значит скопировать её с диска в память и велеть процессору выполнять её инструкции. Дальше процессор берёт из памяти инструкцию за инструкцией и выполняет их, а программа рисует своё окно, ждёт ваших щелчков и отвечает на них.\n\nОдну и ту же программу можно запустить несколько раз. Если открыть два окна одного редактора, в памяти будут работать две копии программы, и у каждой копии будут свои данные. А значок на рабочем столе не программа, а ярлык, который указывает, где программа лежит на диске. Если удалить программу с диска, значок будет указывать в пустоту.',
        'A [[orient.program|program]] is a long sequence of instructions for the processor, written to the disk. Until someone starts it, it is just data, like a photo. Starting a program means copying it from the disk into memory and telling the processor: “begin here”. From then on the processor takes instruction after instruction from memory and carries them out, while the program draws its window, waits for your clicks and responds to them.\n\nOne program on the disk can be started several times: two windows of the same editor are two copies in memory, each with its own data. And the icon on the desktop is not the program at all, only a shortcut pointing to where it lies. Delete the program from the disk, and the icon points at nothing.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как запускается программа и куда пропадает несохранённое', 'How a program starts and where unsaved work goes'),
      body: bi(
        'Схема ниже в замедленном виде показывает, что происходит за доли секунды после того, как вы дважды щёлкнули по значку программы «Заметки», и что потом случается с письмом, которое вы в ней напечатали. Сначала на схеме только вы и диск, на котором лежит программа. Остальные части компьютера появляются, когда до них доходит дело: внизу память, наверху процессор и экран. Под диском и памятью написано, что в них сейчас лежит, а полоска внизу памяти показывает, сколько её занято.',
        'The diagram below replays in slow motion what happens in a fraction of a second after you double-click the “Notes” icon, and what then becomes of the letter you type in it. At first it shows only you and the disk with the program. The other parts appear when their turn comes: memory below, the processor and the screen above. Under the disk and memory you see what they hold; the bar under memory shows how much is used.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.run', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечена одна часть компьютера, та, которая работает сейчас, и облачко рядом с ней говорит, что она делает: «В память легла копия „Заметок“». По линиям движется карточка с тем, что одна часть передаёт другой: копия программы, инструкции, буквы письма, файл. Под схемой стоят два счётчика: первый показывает, сколько миллисекунд прошло от щелчка до появления окна, а второй — сколько памяти занято. Значки и цвета объяснены в легенде под счётчиками.\n\nКогда пройдёте запуск до сохранения письма, откройте над схемой «Параметры». Сделайте программу больше, поставьте медленный диск HDD или откройте побольше других программ и посмотрите, как меняется время запуска; перед первым изменением схема спросит, чего вы ждёте. Напоследок включите в блоке «Сломать» отключение питания до сохранения и проверьте, совпал ли результат с вашим предсказанием и с историей про отчёт из начала урока.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step one part is highlighted, the one working now, and the callout next to it says what it does. A card travels along the lines with what is handed on: the program, instructions, the letters, a file. Two counters under the diagram show the milliseconds from click to window and the memory in use. The legend explains the pictograms and colours.\n\nOnce you reach the save, open “Parameters” above the diagram: make the program bigger, choose the slow HDD or open more programs, and watch the start time; before the first change the diagram asks what you expect. Finally switch on the power cut in “Break it” and check the result against your prediction and the report story at the start of the lesson.'), caption: bi('Теперь посмотрите на те же три части на настоящей машине. На учебной машине ниже команда `nproc` покажет, сколько ядер у её процессора, `free -h` — сколько у неё памяти и сколько из неё свободно, а `df -h` — сколько места на диске.', 'Now look at the same three parts on a real machine. On the training machine below `nproc` shows the cores, `free -h` the memory and how much is free, and `df -h` the disk.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: desk(),
      intro: bi(
        'Перед вами учебная машина, которая работает в окне вашего браузера. У неё нет ни окон, ни значков, и разговаривают с ней текстом. Как это устроено, мы разберём через урок, а пока достаточно напечатать то, что написано в задании, нажать Enter и прочитать ответ. Сломать здесь ничего нельзя, потому что кнопка «Сбросить» в любой момент вернёт машину в исходное состояние.',
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
          prompt: bi('Сколько у машины памяти и сколько её свободно? Напечатайте `free -h`. В строке `Mem:` первое число показывает, сколько памяти всего, а число в столбце `available` — сколько её ещё можно занять.', 'How much memory does it have and how much is free? The command is `free -h`: in the `Mem:` line the first number is the total, and `available` is how much can still be taken.'),
          check: { stdout: /Mem:/ },
          chips: 'free -h',
          docRef: man('free.1', 'OPTIONS', '-h'),
          concepts: ['orient.computer'],
          hints: { H1: bi('Буквы `-h` после пробела просят показать числа в понятных единицах, и тогда Mi в ответе обозначает мегабайты, а Gi — гигабайты.', 'The letters `-h` after a space ask for numbers in readable units, and then Mi in the answer stands for megabytes and Gi for gigabytes.') },
        },
        {
          id: 'disk',
          prompt: bi('А сколько у машины места на диске? Напечатайте `df -h` и найдите строку, которая кончается знаком `/`. В этой строке видно, какого размера диск и сколько места на нём уже занято.', 'And how much disk does the machine have? The command is `df -h`: the line ending in `/` shows the size and how much is used.'),
          check: { stdout: /Filesystem/ },
          chips: 'df -h',
          docRef: man('df.1'),
          concepts: ['orient.computer'],
          hints: { H1: bi('Сравните ответ с ответом `free -h`. И память, и диск измеряются в гигабайтах, но гигабайтов диска у машины намного больше.', 'Compare with `free -h`: memory is in gigabytes, the disk too, but there are more of them.') },
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
        'Вся архитектура фон Неймана умещается в один абзац: программа и её данные лежат в одной общей памяти, а процессор по очереди выбирает из неё инструкции и выполняет их. Кэши, виртуальная память и подкачка уточняют эту картину, но не отменяют её. Выгрузка страниц памяти на диск при её нехватке и есть то замедление, которое показывает схема выше, когда открыто слишком много программ.',
        'This is the von Neumann architecture in one paragraph: the program and its data share one memory, the processor fetches and executes instructions. Caches, virtual memory and paging refine this picture rather than replace it: paging out to the disk when memory runs short is exactly the slowdown the diagram above shows when too many programs are open.',
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
        'Процессор выполняет инструкции, память хранит то, что нужно сейчас, а диск хранит всё остальное. Программа состоит из инструкций, записанных на диск, и запустить её значит скопировать эти инструкции в память и отдать процессору. Всё, что не сохранено на диск, исчезает вместе с питанием.',
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
      { id: 'text', text: bi('пишет за вас текст письма', 'writes the text of your letter for you'), why: bi('Текст пишете вы сами в программе-редакторе, а система только сохраняет его на диск, когда редактор её об этом попросит.', 'You write the text in an editor program. The system only saves it when the editor asks.') },
    ],
    explain: bi('Система стоит посредником между программами и железом. Программы обращаются к ней с просьбами, а она решает, кому что выдать, и следит, чтобы программы не мешали друг другу.', 'The system is the go-between for programs and hardware. Programs ask it, and it decides who gets what and makes sure they do not get in each other’s way.'),
    refs: { explainer: 'orient.system' },
  },
  {
    id: 'orient.q.one-core',
    kind: 'mcq',
    concepts: ['orient.os'],
    prompt: bi('У старого ноутбука процессор с одним ядром, а вы одновременно слушаете музыку, пишете письмо и скачиваете файл. Как это возможно?', 'An old laptop has one core, and you listen to music, write a letter and download a file at the same time. How is that possible?'),
    options: [
      { id: 'turns', text: bi('Система переключает процессор между программами сотни раз в секунду', 'The system switches the processor between programs hundreds of times a second'), correct: true },
      { id: 'magic', text: bi('Одно ядро умеет выполнять три программы сразу', 'One core can run three programs at once'), why: bi('В каждый момент одно ядро выполняет одну программу. Одновременность здесь только кажущаяся, и создают её переключения между программами, которые происходят сотни раз в секунду.', 'At any moment one core runs one program. The simultaneity only seems real, and it is created by switches between programs that happen hundreds of times a second.') },
      { id: 'queue', text: bi('Программы ждут, пока предыдущая закончит работу', 'The programs wait until the previous one finishes'), why: bi('Тогда музыка заиграла бы только после того, как вы допишете письмо.', 'Then the music would play only after you finished the letter.') },
    ],
    explain: bi('Каждой программе достаётся отрезок времени в несколько миллисекунд, после чего система отдаёт процессор следующей. Такие короткие перерывы не замечают ни глаз, ни ухо.', 'Each program gets a slice of a few milliseconds, then the system gives the processor to the next one. Neither eye nor ear can notice it.'),
    refs: { explainer: 'orient.system' },
  },
  {
    id: 'orient.q.path',
    kind: 'mcq',
    concepts: ['orient.file'],
    prompt: bi('Файл `todo.txt` лежит в папке `notes`, папка `notes` — в папке `learner`, а `learner` — в папке `home`. Как записать путь к этому файлу?', 'The file `todo.txt` lies in the folder `notes`, which is in the folder `learner`, which lies in `home`. How is its path written?'),
    options: [
      { id: 'ok', text: '/home/learner/notes/todo.txt', correct: true },
      { id: 'rev', text: '/todo.txt/notes/learner/home', why: bi('Путь читают от самой внешней папки к файлу, как почтовый адрес читают от страны к квартире.', 'A path reads from the outermost folder to the file, like an address from the country to the flat.') },
      { id: 'back', text: '\\home\\learner\\notes\\todo.txt', why: bi('Обратную косую черту использует Windows, а на машинах, с которыми работает этот курс, папки разделяют прямой чертой «/».', 'The backslash is used by Windows. On the machines this course works with the separator is “/”.') },
    ],
    explain: bi('Путь начинается со знака «/», которым обозначается самая верхняя папка, и перечисляет папки по очереди вплоть до самого файла.', 'A path starts with “/”, the topmost folder, and lists the folders in turn down to the file.'),
  },
  {
    id: 'orient.q.os-names',
    kind: 'mcq',
    concepts: ['orient.os'],
    prompt: bi('Какая операционная система работает на большинстве машин, за которыми следит инженер эксплуатации?', 'Which operating system runs on most machines an operations engineer manages?'),
    options: [
      { id: 'linux', text: 'Linux', correct: true },
      { id: 'win', text: 'Windows', why: bi('Windows стоит на многих рабочих компьютерах и встречается в части компаний, но машины, которые обслуживают сайты и приложения, в подавляющем большинстве работают на Linux.', 'Windows appears on desktops and in some companies, but the machines that serve sites and applications are overwhelmingly Linux.') },
      { id: 'mac', text: 'macOS', why: bi('macOS работает на ноутбуках и компьютерах Apple, а на машинах, которые обслуживают сайты, её почти не используют.', 'macOS is the system of Apple laptops and computers; it is hardly used for such machines.') },
    ],
    explain: bi('Поэтому следующий технический блок курса целиком посвящён Linux. Многое из этого урока вы встретите там снова, но уже изнутри.', 'That is why the course’s next technical block is entirely about Linux. Much of this lesson you will see there again, this time from the inside.'),
  },
  {
    id: 'orient.q.folders-label',
    kind: 'label',
    concepts: ['orient.file'],
    prompt: bi('Подпишите схему, то есть расставьте по местам папки и файл, из которых состоит путь `/home/learner/notes/todo.txt`.', 'Label the diagram, that is, put in place the folders and the file that make up the path `/home/learner/notes/todo.txt`.'),
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
    explain: bi('Каждый знак «/» в пути означает шаг на одну папку вглубь, а самая верхняя папка обозначается одним этим знаком.', 'Every “/” in a path is one step down into a folder. The topmost folder is called simply “/”.'),
  },
];

export const systemLesson: Lesson = {
  id: 'orient.system',
  block: 'orient',
  title: bi('Операционная система и файлы', 'The operating system and files'),
  summary: bi('Какую программу называют главной программой компьютера, как она делит процессор и память между остальными программами и хранит файлы в папках и какие такие программы бывают: Linux, Windows и macOS.', 'Which program is called the main program of the computer, how it shares the processor and memory among the other programs and keeps files in folders, and which such programs exist: Linux, Windows and macOS.'),
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
        'В прошлом уроке программу «копировали с диска в память», а процессор «брал из памяти инструкции». Но кто всё это делал? Процессор сам почти ничего не помнит, а программа ещё лежала на диске и ничего сделать не могла. Кроме того, на самом диске нет никаких файлов и папок, есть только миллиарды пронумерованных ячеек, которые называют блоками, и кто-то должен помнить, что блоки с 4711-го по 4713-й хранят ваш отчёт. Этим занимается главная программа компьютера, о которой и пойдёт речь в этом уроке.',
        'In the last lesson the program was “copied from the disk into memory” and the processor “took instructions”. But who did all that? The processor itself remembers nothing, and the program was still lying on the disk and could do nothing. Besides, a disk has no “files” or “folders”, only billions of numbered cells. Somebody has to remember that cells 4711 to 4713 are your report. That somebody is the main program of the computer.',
      ),
    },
    {
      id: 'os',
      kind: 'text',
      step: 'explain',
      title: bi('Посредник между программами и оборудованием', 'A go-between for programs and hardware'),
      body: bi(
        '[[orient.os|Операционная система]], сокращённо ОС, первой загружается при включении компьютера и последней завершает работу при выключении. Все остальные программы запускает она, и к оборудованию компьютера, то есть к процессору, памяти и диску, которые в разговоре называют железом, они обращаются только через неё.\n\nУ системы четыре главные обязанности. Во-первых, она **запускает программы**, то есть выполняет то самое копирование с диска в память. Во-вторых, она **делит процессор**. Программ запущено много, а ядер у процессора мало, поэтому система даёт каждой программе процессор на несколько миллисекунд и переключает его на следующую. Переключения происходят так часто, что вам кажется, будто все программы работают одновременно. В-третьих, она **раздаёт память**, то есть выделяет каждой программе отдельный участок и не пускает одну программу в участок другой. В-четвёртых, она **ведёт учёт диска**, то есть помнит, какие блоки свободны, какие заняты и каким файлам они принадлежат.\n\nСистемы бывают разные. На ноутбуках чаще всего работают Windows и macOS, на телефонах — Android и iOS. А на машинах, которые круглые сутки обслуживают сайты и приложения, почти всегда работает Linux, поэтому ему посвящён следующий технический блок курса.',
        'The [[orient.os|operating system]] (OS) is the first program to load when a computer is switched on and the last to finish when it is switched off. It starts all other programs, and they reach the hardware only through it.\n\nThe system has four main jobs. It **starts programs**: that copy from the disk into memory is made by its hands. It **shares the processor**: many programs are running and there are few cores, so the system gives each program the processor for a few milliseconds and moves on; the switches are so frequent that it seems to you everything runs at once. It **hands out memory**, a piece to each program, and keeps one program out of another’s. And it **keeps track of the disk**: which cells are free, which are taken and which files they belong to.\n\nSystems differ. Laptops most often run Windows and macOS, phones Android and iOS. But the machines that serve sites and applications around the clock almost always run Linux, which is why the course’s next technical block is devoted entirely to it.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как программы просят систему о помощи', 'How programs ask the system for help'),
      body: bi(
        'Схема ниже показывает три просьбы, с которыми программы обращаются к операционной системе каждую секунду. Редактор просит сохранить файл, браузер просит памяти для новой вкладки, а несколько программ сразу хотят процессор. Сначала на схеме только редактор и диск. Потом появляются остальные участники. Посередине лежит широкая полоса, которая изображает операционную систему, над ней стоят программы, а под ней железо, то есть диск, память и процессор. Обратите внимание, что ни одна линия не ведёт от программы к железу напрямую, потому что все просьбы проходят через систему.',
        'The diagram below shows three things programs ask of the operating system every second: the editor saves a file, the browser asks for memory for a new tab, and several programs want the processor. At first it shows only the editor and the disk. Then the others appear: in the middle a wide strip, the operating system, above it the programs, below it the hardware. No line goes from a program straight to the hardware: everything passes through the system.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.system', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен тот, кто работает сейчас, облачко рядом с ним говорит, что он делает, а по линии движется карточка с просьбой или ответом: «сохрани notes.txt», «блоки 4711–4713», «готово». Под схемой стоят два счётчика: первый показывает, какая доля времени процессора достаётся каждой программе, а второй — сколько раз в секунду система переключает процессор с одной программы на другую.\n\nКогда дойдёте до процессора, откройте «Параметры». Добавьте несколько программ, оставив процессору одно ядро, а потом дайте ему четыре ядра и сравните счётчики. Напоследок включите в блоке «Сломать» поломку, при которой программы пишут на диск сами, без системы, и посмотрите, что станет с файлом.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The one working is highlighted, the callout says what it does, and a card travels with what is asked or answered: “save notes.txt”, “blocks 4711–4713”, “done”. Two counters show each program’s share of the processor and how many times a second the system switches it.\n\nAt the processor, open “Parameters”: add programs with one core, then give four cores and compare the counters. Finally switch on the break in “Break it” where programs write to the disk themselves, and see what becomes of the file.'), caption: bi('Каждая команда, которую вы наберёте в заданиях этого урока, тоже станет просьбой к системе, как просьба редактора на схеме: показать, в какой папке вы находитесь, перечислить файлы, создать папку. Но сначала разберёмся, как система раскладывает файлы по папкам.', 'Every command you type in this lesson’s tasks also asks the system for something, like the editor’s in the diagram: show the folder, list files, make a folder. But first, how the system arranges files in folders.') },
    {
      id: 'files',
      kind: 'text',
      step: 'explain',
      title: bi('Файлы и папки', 'Files and folders'),
      body: bi(
        '[[orient.file|Файл]] — это кусок данных на диске, у которого есть имя: текст, фотография, программа. Имя придумано для людей, а для системы файл представляет собой список занятых блоков диска и запись о том, как файл называется и кому он принадлежит.\n\nФайлы лежат в папках, папки лежат в других папках, и вместе они образуют дерево. На машинах с Linux у этого дерева одна вершина, которая обозначается знаком `/`. Внутри неё есть папка `home`, а в ней у каждого человека своя папка; на учебной машине ваша папка называется `learner`. Чтобы назвать файл точно, перечисляют через косую черту все папки от вершины до него: `/home/learner/notes/todo.txt`. Такая запись называется путём, и читают её как почтовый адрес, от страны к квартире.\n\nВ Windows дерево устроено похоже, только вершин у него несколько (`C:`, `D:`), а черта в пути обратная: `C:\\Users\\learner\\notes\\todo.txt`. На машинах, с которыми работает этот курс, черта всегда прямая, `/`.',
        'A [[orient.file|file]] is a named piece of data on the disk: a text, a photo, a program. The name was invented for people; to the system a file is a list of occupied cells plus a record of what it is called and whom it belongs to.\n\nFiles lie in folders, folders in other folders, and together they form a tree. On Linux machines the tree has a single top, called simply `/`. Inside it is the folder `home`, where every person has a folder of their own: on the training machine yours is `learner`. To name a file exactly, you list all folders from the top down to it, separated by slashes: `/home/learner/notes/todo.txt`. This is called a path. You read it like a postal address, from the country down to the flat.\n\nIn Windows the tree is arranged in a similar way, except there are several tops (`C:`, `D:`) and the slash leans the other way: `C:\\Users\\learner\\notes\\todo.txt`. On the machines this course works with it is always the forward one, `/`.',
      ),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: desk(),
      intro: bi('Перед вами та же учебная машина. В вашей папке уже лежат папки `notes` и `photos`.', 'The same training machine. Your folder already holds the folders `notes` and `photos`.'),
      tasks: [
        {
          id: 'where',
          prompt: bi('В какой папке вы сейчас находитесь? Команда `pwd` напечатает путь к ней.', 'Which folder are you in now? The `pwd` command prints its path.'),
          check: { stdout: /^\/home\/learner\n?$/ },
          chips: 'pwd',
          docRef: man('pwd.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('Наберите три буквы: p, w, d. Имя команды сокращено от английских слов print working directory, «покажи рабочую папку».', 'Type three letters: p, w, d. The command’s name is short for the English words print working directory.') },
        },
        {
          id: 'list',
          prompt: bi('Что лежит в вашей папке? Посмотрите командой `ls`, а потом загляните внутрь папки `notes` командой `ls notes`.', 'What is in your folder? Look with `ls`, then look inside `notes`: `ls notes`.'),
          check: { stdout: /todo\.txt/ },
          chips: 'ls notes',
          docRef: man('ls.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('Команда `ls` без продолжения показывает содержимое текущей папки, а с именем папки после пробела — содержимое этой папки.', '`ls` on its own lists the current folder; with a folder name, its contents.') },
        },
        {
          id: 'read',
          prompt: bi('Прочитайте список дел командой `cat notes/todo.txt`.', 'Read the to-do list: `cat notes/todo.txt`.'),
          check: { stdout: /call the bank/ },
          chips: 'cat notes/todo.txt',
          docRef: man('cat.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('Запись `notes/todo.txt` задаёт путь к файлу от той папки, в которой вы сейчас находитесь.', 'The notation `notes/todo.txt` gives the path to the file from the folder you are in now.') },
        },
        {
          id: 'mkdir',
          prompt: bi('Заведите папку для документов командой `mkdir docs` и убедитесь командой `ls`, что она появилась.', 'Make a folder for documents: `mkdir docs`. Check with `ls` that it appeared.'),
          check: { when: "files['/home/learner/docs'].type=d" },
          chips: 'mkdir docs',
          docRef: man('mkdir.1'),
          concepts: ['orient.file'],
          hints: { H1: bi('Имя mkdir сокращено от английского make directory, «создай папку».', 'mkdir means “make directory”.') },
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
        'Главная программа компьютера называется операционной системой. Она запускает остальные программы, по очереди даёт им процессор, раздаёт память и ведёт учёт диска. Файлом называют данные на диске, у которых есть имя. Папки складываются в дерево, а путь вроде `/home/learner/notes/todo.txt` точно называет файл в этом дереве.',
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
    prompt: bi('Почему с машинами, которые обслуживают сайты, обычно разговаривают командами, а не мышью?', 'Why do people usually talk to the machines that serve sites in commands rather than with a mouse?'),
    options: [
      { id: 'far', text: bi('Машина стоит далеко и без экрана, а текст легко передать по сети, записать и повторить', 'The machine is far away and has no screen, and text is easy to send over a network, to write down and to repeat'), correct: true },
      { id: 'old', text: bi('Так работали, пока не изобрели мышь, и с тех пор это осталось по привычке', 'That is how people worked before the mouse was invented, and it has stayed out of habit since'), why: bi('Дело не в привычке. Строку можно сохранить, отправить коллеге и выполнить сразу на сотне машин, а щелчки мышью так не повторишь.', 'Commands survive not out of habit: a line can be saved, sent to a colleague and run on a hundred machines at once. Mouse clicks cannot do that.') },
      { id: 'secret', text: bi('Чтобы посторонние не поняли, что происходит', 'So that outsiders do not understand what is going on'), why: bi('Команды не шифр, они описаны в открытой справке, и выучить их может любой желающий.', 'Commands are no cipher: they are written in open documentation, and anyone can learn them.') },
    ],
    explain: bi('Сила текстовой команды в том, что её можно напечатать за тысячу километров от машины, вставить в инструкцию и выполнить снова через год.', 'The strength of a text command is that it can be typed a thousand kilometres from the machine, put into an instruction and run again a year later.'),
  },
  {
    id: 'orient.q.words',
    kind: 'mcq',
    concepts: ['orient.command'],
    prompt: bi('Что в строке `ls -l notes` говорит, что сделать, а что — с чем и как?', 'In the line `ls -l notes`, what is the action and what is it done with?'),
    options: [
      { id: 'ok', text: bi('`ls` говорит, что сделать (показать список), `-l` — как (подробно), а `notes` — с чем (с этой папкой)', '`ls` is what to do (list), `-l` is how (in detail), `notes` is with what (this folder)'), correct: true },
      { id: 'all', text: bi('Это одно слово, и его надо выучить целиком', 'It is one word to be learnt as a whole'), why: bi('Слова в строке разделены пробелами, и у каждого своя роль. Поэтому из нескольких знакомых слов можно составить новую строку.', 'The words are separated by spaces and each has its own role. That is why familiar words can be combined into a new line.') },
      { id: 'rev', text: bi('Командой здесь служит `notes`, а `ls` обозначает папку', 'Here `notes` is the command and `ls` names the folder'), why: bi('Первое слово строки всегда команда, а остальные слова уточняют её задачу.', 'The first word of a line is always the command; the rest refine its task.') },
    ],
    explain: bi('Слова, которые начинаются с дефиса, называют опциями или флагами, и они говорят, как выполнить команду. Учить их наизусть не нужно, их ищут в справке.', 'Words starting with a hyphen are called options or flags: they say “how”. Nobody learns them by heart; they are looked up in the documentation.'),
  },
  {
    id: 'orient.q.fill-echo',
    kind: 'fill-command',
    concepts: ['orient.command', 'orient.file'],
    prompt: bi('Запишите в файл `hello.txt` строку `hello`. Напечатайте всю строку команды целиком.', 'Write the line `hello` into the file `hello.txt`. Type the whole command line.'),
    setup: { hostname: 'trainer' },
    check: { when: "files['/home/learner/hello.txt'].text~'hello'" },
    misconceptions: [{ match: '^echo hello$', why: bi('Так строка напечатается на экране. Чтобы она попала в файл, после неё нужно поставить знак `>` и имя файла.', 'This prints the line on the screen. To send it to a file, add the `>` sign and the file name.') }],
    explain: bi('Команда `echo` печатает то, что ей передали, а знак `>` отправляет напечатанное не на экран, а в файл. Если такого файла ещё не было, он появится.', '`echo` prints what it is given, and the `>` sign sends the printout not to the screen but to a file. If the file did not exist, it appears.'),
  },
  {
    id: 'orient.q.help',
    kind: 'mcq',
    concepts: ['orient.command'],
    prompt: bi('Вы забыли, как заставить `ls` показать подробный список. Где это быстрее всего посмотреть?', 'You forgot how to make `ls` show a detailed list. Where is it fastest to look?'),
    options: [
      { id: 'help', text: bi('Команда `ls --help` на той же машине', '`ls --help` right on the machine'), correct: true },
      { id: 'ask', text: bi('Спросить коллегу в чате', 'Ask a colleague in the chat'), why: bi('Коллега ответит, но через несколько минут, а справка к каждой команде всегда под рукой.', 'A colleague will answer, but in minutes; every command’s help is at hand at once and always.') },
      { id: 'guess', text: bi('Перебирать буквы наугад', 'Try letters at random'), why: bi('Наугад можно случайно включить что-нибудь опасное, а заглянуть в справку быстрее и безопаснее.', 'At random you might switch on something dangerous. The help is cheaper.') },
    ],
    explain: bi('Почти у каждой команды есть справка. Короткую показывает опция `--help`, а подробную — команда `man` с именем команды. Дальше по курсу вы будете заглядывать в справку всё чаще.', 'Almost every command has help: `--help` is the short one, `man` plus the command name the detailed one. Further on in the course you will look there more and more.'),
  },
];

export const textLesson: Lesson = {
  id: 'orient.text',
  block: 'orient',
  title: bi('Как разговаривать с машиной командами', 'Talking in text: commands'),
  summary: bi('Почему с машинами разговаривают строками текста, из каких слов состоит такая строка и где у каждой команды справка.', 'Why people talk to machines in lines of text, which words a line is made of and where every command keeps its help.'),
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
        'Окна, значки и мышь удобны, когда компьютер стоит перед вами. Но машина, на которой работает сайт магазина, стоит в чужом здании за сотни километров, у неё нет ни монитора, ни мыши, а у крупной компании таких машин бывает тысяча. С такими машинами разговаривают иначе: человек печатает строку текста, машина выполняет её и отвечает тоже текстом. На учебной машине вы уже так делали, а теперь разберёмся, что вы печатали.',
        'Windows, icons and a mouse are a handy way to talk to the computer in front of you. But the machine that runs a shop’s site stands in someone else’s building hundreds of kilometres away; it has no monitor and no mouse, and sometimes a company has a thousand such machines. People talk to them differently: they type a line of text, and the machine carries it out and answers in text too. You have already done this on the training machine. Now let us see what exactly you were typing.',
      ),
    },
    {
      id: 'command',
      kind: 'text',
      step: 'explain',
      title: bi('Из каких слов состоит команда', 'A line is words'),
      body: bi(
        'Строка, которую вы печатаете машине и отправляете клавишей Enter, называется [[orient.command|командой]]. Машина делит её на слова по пробелам. Первое слово говорит, **что сделать**: `ls` показывает список файлов, `cat` выводит файл на экран, `mkdir` создаёт папку. Остальные слова уточняют, **с чем** это сделать и **как**:\n\n```\nls -l notes\n```\n\nЗдесь слово `ls` велит показать список, слово `notes` говорит, какой папки, а `-l` — как его показать, то есть подробно, с размерами файлов и датами. Слова, которые начинаются с дефиса, называют опциями. Учить их наизусть не нужно, потому что у каждой команды есть справка, и через пару блоков вы будете находить в ней нужную опцию быстрее, чем вспоминать её.\n\nИмена команд сокращены из английских слов: `ls` означает list, «список», `pwd` — print working directory, «покажи рабочую папку», `mkdir` — make directory, «создай папку», а `cat` — concatenate, «склеить», потому что эта команда умеет выводить подряд несколько файлов. Знать расшифровку полезно, потому что она подсказывает, что делает команда, и помогает её запомнить.\n\nЕщё одно правило пригодится сразу. Знак `>` после команды отправляет в файл то, что команда иначе напечатала бы на экране:\n\n```\necho "buy milk" > notes/shopping.txt\n```\n\nКоманда `echo` печатает свои слова без изменений, а знак `>` кладёт напечатанное в файл `shopping.txt`. Если такого файла не было, он появится, а если был, его прежнее содержимое заменится новым.',
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
        'Команду можно скопировать коллеге в чат, записать в инструкцию и через год выполнить снова с тем же результатом. Её можно отправить сразу на сто машин. Щелчок мышью нельзя ни переслать, ни в точности повторить, поэтому почти вся работа с машинами, которые обслуживают сайты, идёт текстом.',
        'A command can be copied to a colleague in a chat, written into an instruction and run again a year later with the same result. It can be sent to a hundred machines at once. A mouse click can be neither forwarded nor repeated exactly. That is why almost all work with the machines that serve sites is done in text.',
      ),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: desk(),
      intro: bi('Поработайте пять минут на учебной машине. Если вы ошибётесь в букве, машина ответит, что не знает такой команды; тогда исправьте строку и попробуйте снова. Клавиша со стрелкой вверх возвращает предыдущую строку, чтобы её не пришлось набирать заново.', 'Five minutes on the training machine. If you mistype a letter, the machine answers that it knows no such command: fix it and try again. The up arrow brings back the previous line.'),
      tasks: [
        {
          id: 'who',
          prompt: bi('Под каким именем вы работаете на этой машине? Ответ покажет команда `whoami`, от английского who am I, «кто я».', 'Which name are you working under on this machine? The command is `whoami`, “who am I”.'),
          check: { stdout: /^learner\n?$/ },
          chips: 'whoami',
          docRef: man('whoami.1'),
          concepts: ['orient.command'],
          hints: { H1: bi('Напечатайте одно слово, без пробелов.', 'One word, no spaces.') },
        },
        {
          id: 'detail',
          prompt: bi('Посмотрите на папку `notes` подробно, командой `ls -l notes`. Чем этот ответ отличается от ответа обычной команды `ls notes`?', 'Look at the folder `notes` in detail: `ls -l notes`. How does the answer differ from plain `ls notes`?'),
          check: { stdout: /todo\.txt/ },
          chips: 'ls -l notes',
          docRef: man('ls.1', 'OPTIONS', '-l'),
          concepts: ['orient.command'],
          hints: { H1: bi('Слова в строке разделяются пробелами, поэтому напечатайте `ls`, пробел, `-l`, пробел и `notes`.', 'The words in a line are separated by spaces, so type `ls`, a space, `-l`, a space and `notes`.') },
        },
        {
          id: 'write',
          prompt: bi('Запишите список покупок командой `echo "buy milk" > notes/shopping.txt`, а потом прочитайте его командой `cat`.', 'Write a shopping list: `echo "buy milk" > notes/shopping.txt`. Then read it with `cat`.'),
          check: { when: "files['/home/learner/notes/shopping.txt'].text~'buy milk'" },
          chips: 'echo "buy milk" > notes/shopping.txt',
          docRef: man('echo.1'),
          concepts: ['orient.command', 'orient.file'],
          hints: { H1: bi('Кавычки превращают два слова, buy и milk, в один кусок текста.', 'The quotes make the two words “buy milk” one piece of text.') },
        },
      ],
    },
    {
      id: 'doc',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('У каждой команды есть подробная справка. Откройте справку команды `ls` и нажмите на раздел, в котором перечислены опции, то есть слова с дефисом.', 'Every command has a detailed help page. Open the help for `ls` and click the section that lists the options, the very words with a hyphen.'),
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
        'Командой называют строку текста, в которой первое слово говорит, что сделать, а остальные уточняют, с чем и как. Слова с дефисом называются опциями, и нужную опцию ищут в справке. Знак `>` отправляет то, что напечатала команда, в файл. Текст можно переслать, записать и повторить, поэтому с удалёнными машинами и работают строками.',
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
      { id: 'one', text: bi('Одна большая сеть, которой владеет международная организация', 'One big network owned by an international organisation'), why: bi('Единого владельца у интернета нет. Есть домашние сети, сети провайдеров, компаний и университетов, а между ними договорённости о том, чтобы передавать сообщения друг друга.', 'The internet has no single owner. There are home networks, networks of providers, companies and universities, and agreements between them.') },
      { id: 'wifi', text: bi('Wi-Fi у вас дома', 'The Wi-Fi in your flat'), why: bi('Wi-Fi покрывает только последний участок пути, от ноутбука до домашнего роутера.', 'Wi-Fi is only the last piece of the path, from the laptop to the home router.') },
    ],
    explain: bi('Само слово «интернет» составлено из английских слов, которые означают «между сетями». Подробную карту интернета вы получите в блоке «Сети».', 'The word “internet” itself is made of English words meaning “between networks”. A detailed map of the internet comes in the Networks block.'),
  },
  {
    id: 'orient.q.address',
    kind: 'mcq',
    concepts: ['orient.network'],
    prompt: bi('Зачем у каждого компьютера в сети есть адрес?', 'Why does every computer on a network have an address?'),
    options: [
      { id: 'deliver', text: bi('Чтобы сеть могла доставить сообщение тому компьютеру, которому оно адресовано', 'So that a message for it can be delivered to it and nobody else'), correct: true },
      { id: 'name', text: bi('Чтобы владелец мог дать компьютеру красивое имя', 'So that the owner can give the computer a pretty name'), why: bi('Имена для людей у компьютеров тоже бывают, но доставляют сообщения по числовому адресу.', 'There are names for people too, but delivery goes by the numeric address.') },
      { id: 'speed', text: bi('Чтобы сеть работала быстрее', 'So that the network runs faster'), why: bi('Скорость от адреса не зависит. Адрес нужен, чтобы знать, куда доставить сообщение.', 'Speed does not depend on the address. The address says where to carry the message.') },
    ],
    explain: bi('Так же устроена обычная почта, которая без адреса на конверте не найдёт получателя письма.', 'The ordinary post works the same way: without an address on the envelope it cannot find the letter’s recipient.'),
  },
  {
    id: 'orient.q.far',
    kind: 'mcq',
    concepts: ['orient.network', 'orient.internet'],
    prompt: bi('Почему страница из соседнего города открывается быстрее, чем такая же страница с другого континента?', 'Why does a page from the next city open faster than the same page from another continent?'),
    options: [
      { id: 'dist', text: bi('Сообщению нужно пройти более длинный путь, а даже свету, чтобы пересечь океан, нужны десятки миллисекунд', 'The message has further to go: even light needs tens of milliseconds to cross an ocean'), correct: true },
      { id: 'lang', text: bi('Её приходится переводить на другой язык', 'It has to be translated into another language'), why: bi('Сеть ничего не переводит, она только доставляет сообщения.', 'The network translates nothing; it only delivers.') },
      { id: 'cust', text: bi('На границе страницу проверяет таможня', 'Customs checks it at the border'), why: bi('Таможни в сети нет. Настоящая причина в расстоянии, и сократить время в пути можно только одним способом, оказавшись ближе к получателю.', 'There is no customs in a network. The real reason is distance, and the travel time can be cut in only one way, by getting closer to the recipient.') },
    ],
    explain: bi('Поэтому крупные сайты держат копии своих страниц в разных частях света, поближе к людям.', 'That is why big sites keep copies of their pages in different parts of the world, closer to the people.'),
  },
];

export const netLesson: Lesson = {
  id: 'orient.net',
  block: 'orient',
  title: bi('Сеть и интернет', 'Networks and the internet'),
  summary: bi('Как компьютеры посылают друг другу сообщения по адресам и почему интернет — это сеть из сетей, у которой нет одного хозяина.', 'How computers send each other messages by address and why the internet is a network of networks with no single owner.'),
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
        'Вы нажимаете на ссылку, и через полсекунды на экране открывается страница магазина, хотя его компьютеры стоят в другом городе. Между вашим ноутбуком и ними лежат роутер в прихожей, провода провайдера, кабели под землёй, а может быть, и под океаном. Отдельного провода от вашей квартиры до магазина никто не прокладывал. Как же сообщение находит дорогу?',
        'You click a link, and half a second later the shop’s page is on the screen, though its computers stand in another city. Between your laptop and them lie the router in your hallway, the provider’s wires, cables under the ground and perhaps under the ocean. Nobody laid a separate wire from your flat to the shop. So how does a message find its way?',
      ),
    },
    {
      id: 'network',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое сеть', 'A network'),
      body: bi(
        '[[orient.network|Сеть]] — это компьютеры, соединённые проводами или радиоволнами так, что они могут посылать друг другу сообщения. Ваш ноутбук, телефон и телевизор, подключённые к одному роутеру, образуют маленькую домашнюю сеть. В офисе сеть побольше, а у провайдера огромная.\n\nЧтобы сообщение нашло получателя, у каждого компьютера в сети есть **адрес**, набор чисел вроде `198.51.100.20`. Отправитель пишет на сообщении адрес получателя, и сеть доставляет его так же, как почта доставляет письмо, не заглядывая внутрь. Большое сообщение, например фотографию или страницу, сеть режет на небольшие куски. Каждый кусок идёт со своим адресом, а у получателя куски собираются обратно.\n\nЛюдям числа запоминать неудобно, поэтому у компьютеров есть ещё и имена вроде `shop.example`. Когда вы пишете имя, ваш компьютер сначала спрашивает у сети, какой адрес этому имени соответствует, примерно так же, как вы ищете в записной книжке номер телефона, прежде чем позвонить.',
        'A [[orient.network|network]] is computers connected by wires or radio waves so that they can send each other messages. Your laptop, phone and TV, connected to one router, are a small home network. An office has a bigger network, a provider a huge one.\n\nFor a message to find its recipient, every computer on a network has an **address**, a set of numbers like `198.51.100.20`. The sender writes the recipient’s address on the message, and the network delivers it the way the post delivers a letter: without knowing what is inside. A big message, a photo or a page, is cut into small pieces, each travels with its own address, and at the recipient the pieces are put back together.\n\nNumbers are hard for people to remember, so computers also have names such as `shop.example`. When you type a name, your computer first asks the network which address belongs to it, much as you look up a phone number in your address book before calling.',
      ),
    },
    {
      id: 'internet',
      kind: 'text',
      step: 'explain',
      title: bi('Сеть из сетей', 'A network of networks'),
      body: bi(
        'Ваш роутер соединяет домашнюю сеть с сетью провайдера. Провайдер соединён с другими провайдерами, те с третьими, и где-то в этой цепочке есть сеть, к которой подключены компьютеры магазина. Вся эта цепочка и называется [[orient.internet|интернетом]], и в неё входят десятки тысяч сетей разных владельцев, которые договорились передавать сообщения друг друга. Хозяина у интернета нет, а есть общие правила и договоры между соседними сетями.\n\nСообщение идёт по этой цепочке прыжками: от ноутбука к роутеру, от роутера к провайдеру, от провайдера к следующему, пока не доберётся до сети получателя. Каждый узел на пути смотрит только на адрес и решает, кому передать сообщение дальше. На каждый прыжок уходит время, и чем дальше получатель, тем больше прыжков и тем длиннее провода. Через страну сообщение идёт десятки миллисекунд, а через океан около сотни, потому что даже свет в стеклянном кабеле быстрее не движется.\n\nКак устроены адреса, прыжки и поиск адреса по имени, подробно разберёт блок «Сети». Пока достаточно общей картины: сеть доставляет сообщения по адресам, интернет состоит из множества сетей, связанных договорами, а расстояние стоит времени.',
        'Your router connects the home network to the provider’s network. The provider is connected to other providers, those to others still, and somewhere along this chain is the network the shop’s computers are attached to. That is the [[orient.internet|internet]]: tens of thousands of networks with different owners that agreed to pass each other’s messages on. The internet has no owner; it has common rules and agreements between neighbours.\n\nA message travels along this chain in hops: from the laptop to the router, from the router to the provider, from the provider to the next one, until it reaches the recipient’s network. Each node on the way looks only at the address and decides whom to hand it to next. Each hop takes time, and the further away the recipient, the more hops and the longer the wires. A message crosses a country in tens of milliseconds and an ocean in about a hundred: even light in glass cannot go faster.\n\nHow exactly addresses, hops and finding an address by name work is taken apart in the Networks block. For now the picture is enough: a network delivers messages by address, the internet is many networks tied by agreements, and distance costs time.',
      ),
    },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: laptop(),
      intro: bi('Теперь вы на учебном ноутбуке, который подключён к учебному интернету курса. Где-то в этом интернете есть магазин `shop.example`.', 'Now you are on a training laptop connected to the course’s internet. Somewhere in it is the shop `shop.example`.'),
      tasks: [
        {
          id: 'ping',
          prompt: bi('Отправьте магазину три коротких сообщения и посмотрите, за сколько миллисекунд приходит ответ: `ping -c 3 shop.example`. Число после `time=` показывает время пути туда и обратно.', 'Send the shop three short messages and see how many milliseconds the answer takes: `ping -c 3 shop.example`. The number after `time=` is the time there and back.'),
          check: { stdout: /3 packets transmitted, 3 received/ },
          chips: 'ping -c 3 shop.example',
          docRef: { page: 'help/ping', anchor: 'OPTIONS', line: '-c' },
          concepts: ['orient.network', 'orient.internet'],
          hints: { H1: bi('Опция `-c 3` означает «три раза». Без неё `ping` будет посылать сообщения, пока его не остановят.', '`-c 3` means “three times”; without it `ping` keeps sending until it is stopped.') },
        },
        {
          id: 'address',
          prompt: bi('Посмотрите на первую строку ответа и найдите в ней числовой адрес, который соответствует имени `shop.example`. Запишите этот адрес в файл командой `echo <адрес> > shop-address.txt`.', 'Look at the first line of the answer: what numeric address does the name `shop.example` have? Write it into a file: `echo <address> > shop-address.txt`.'),
          check: { when: "files['/home/learner/shop-address.txt'].text~'198.51.100.20'" },
          concepts: ['orient.network'],
          hints: { H1: bi('Адрес стоит в скобках сразу после имени: `PING shop.example (…)`.', 'The address is in brackets right after the name: `PING shop.example (…)`.'), H2: bi('Адрес состоит из четырёх чисел, разделённых точками, и начинается с 198.', 'It is four numbers separated by dots, starting with 198.') },
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
        'Сеть доставляет сообщения между компьютерами по адресам, а имена нужны людям и переводятся в адреса. Интернет состоит из десятков тысяч сетей, связанных договорами. Сообщение идёт по ним прыжками, и чем дальше получатель, тем дольше путь.',
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
      { id: 'client', text: bi('Ваш браузер, потому что он клиент и отправляет запрос', 'Your browser, because it is the client and sends the request'), correct: true },
      { id: 'server', text: bi('Сервер магазина, который сам присылает страницы всем, кто к нему подключён', 'The shop’s server, which itself sends pages to everyone connected to it'), why: bi('Сервер ждёт и отвечает, но первым никому не пишет. Пока не придёт запрос, он не знает, что кому-то нужна страница.', 'A server waits and answers but never writes first. Without a request it does not know anyone needs a page.') },
      { id: 'provider', text: bi('Разговор начинает провайдер интернета', 'The internet provider starts it'), why: bi('Провайдер только доставляет сообщения, а разговор ведут клиент и сервер.', 'The provider only carries the messages; the conversation is between the client and the server.') },
    ],
    explain: bi('Клиент просит, а сервер отвечает, и такая пара встречается повсюду: браузер и сайт, приложение банка и его серверы, ваша программа и база данных.', 'The client asks, the server answers. This pair is everywhere: a browser and a site, a banking app and its servers, your program and a database.'),
    refs: { explainer: 'orient.request' },
  },
  {
    id: 'orient.q.server-is',
    kind: 'mcq',
    concepts: ['orient.server'],
    prompt: bi('Чем сервер отличается от вашего ноутбука?', 'How does a server differ from your laptop?'),
    options: [
      { id: 'role', text: bi('Внутри у них всё то же самое, а отличается работа: сервер без перерыва отвечает на чужие запросы', 'Inside it is the same; the difference is the job: it serves others without a break'), correct: true },
      { id: 'magic', text: bi('Это особый компьютер без процессора и памяти', 'It is a special kind of computer without a processor or memory'), why: bi('У сервера те же процессор, память, диск и операционная система, только их больше и они надёжнее.', 'A server has the same processor, memory, disk and operating system, just more of them and more reliable.') },
      { id: 'site', text: bi('Сервером называют сам сайт, а не машину', 'A server is the site itself, not a machine'), why: bi('Сайт представляет собой программу, которая работает на сервере, а сервером называют и машину, на которой эта программа запущена.', 'A site is a program running on a server. The server is the machine it runs on.') },
    ],
    explain: bi('Словом «сервер» называют и машину, и программу на ней, которая отвечает на запросы. Чтобы различить их, спросите себя, включена ли машина и запущена ли на ней программа.', 'The word “server” is used both for the machine and for the program on it that answers requests. To tell them apart, ask yourself whether the machine is on and whether the program on it is running.'),
  },
  {
    id: 'orient.q.overload',
    kind: 'mcq',
    concepts: ['orient.server', 'orient.client-request'],
    prompt: bi('Сервер успевает ответить на 200 запросов в секунду, а в распродажу их приходит 400. Что увидят покупатели?', 'A server can answer 200 requests a second. During a sale 400 arrive. What will the shoppers see?'),
    options: [
      { id: 'err', text: bi('Очередь переполнится, и часть покупателей получит ошибку «сервер перегружен»', 'The queue overflows, and some get a “server overloaded” error'), correct: true },
      { id: 'half', text: bi('Все получат страницу, только вдвое медленнее', 'Everyone gets the page, just twice as slowly'), why: bi('Если запросов приходит больше, чем сервер успевает обслужить, очередь растёт без конца. Страницы начинают грузиться медленно задолго до двухсот запросов в секунду, а за этим пределом появляются ошибки.', 'If more requests arrive than the server can serve, the queue grows without end; it gets slow long before 200, and beyond it come errors.') },
      { id: 'none', text: bi('Ничего не случится, потому что сервер сам начнёт работать быстрее', 'Nothing will happen, because the server will start working faster by itself'), why: bi('Скорость одного сервера ограничена, и справиться с наплывом покупателей помогает только второй сервер или более лёгкие страницы.', 'One server’s speed is limited, and only a second server or lighter pages help it cope with the rush of shoppers.') },
    ],
    explain: bi('На схеме урока хорошо видно, что ожидание растёт тем быстрее, чем ближе загрузка к ста процентам. Поэтому к распродажам готовятся заранее и добавляют серверы.', 'The explainer shows it: the wait rises more steeply the closer the load is to 100%. That is why sales are prepared for in advance by adding servers.'),
    refs: { explainer: 'orient.request' },
  },
  {
    id: 'orient.q.refused-timeout',
    kind: 'match',
    concepts: ['orient.server', 'orient.client-request'],
    prompt: bi('Сопоставьте, что сломалось и что при этом увидит браузер.', 'Match what broke with what the browser sees.'),
    pairs: [
      { id: 'prog', left: bi('Машина включена, а программа магазина остановлена', 'The machine is on, the shop program is stopped'), right: bi('браузер сразу получает ошибку «соединение отвергнуто»', 'the browser at once gets a “connection refused” error') },
      { id: 'net', left: bi('Кабель между городами перерублен', 'The cable between cities is cut'), right: bi('браузер долго ждёт, а потом сообщает, что время вышло', 'the browser waits a long time and then reports that the time ran out') },
      { id: 'load', left: bi('Покупателей больше, чем успевает обслужить сервер', 'More shoppers than the server can handle'), right: bi('сервер отвечает числом 503, которое означает «сервер перегружен»', 'the server answers with 503, which means “server overloaded”') },
    ],
    explain: bi('По виду ошибки уже понятно, где искать. Отказ означает, что машина отвечает, но программа на ней не слушает. Тишина означает, что сообщение не дошло. Ответ 503 означает, что сообщение дошло, но сервер не справляется.', 'The kind of error already tells you where to look: a refusal means the machine answers but the program is not listening; silence means the message did not arrive; 503 means it arrived but the server cannot cope.'),
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
      { id: 'page', text: '<h1>Catalog</h1>', why: bi('Каталог отдаёт сервер `shop.example`, а имени `nosuch.example` в сети нет.', '`shop.example` serves the catalogue. There is no such name as `nosuch.example` on the network.') },
      { id: 'refused', text: "curl: (7) Failed to connect to nosuch.example port 443: Couldn't connect to server", why: bi('До подключения дело не дошло, потому что клиент не нашёл адреса для этого имени.', 'It never got as far as connecting, because the client found no address for this name.') },
    ],
    explain: bi('Прежде чем отправить запрос, клиент ищет адрес по имени. Стоит ошибиться в имени, и запрос никуда не уйдёт.', 'Before sending a request, the client looks up the address for the name. A typo in the name, and the request goes nowhere.'),
  },
];

export const requestsLesson: Lesson = {
  id: 'orient.requests',
  block: 'orient',
  title: bi('Сервер, клиент и запрос', 'Server, client and request'),
  summary: bi('Что такое сервер, который круглые сутки отвечает на чужие запросы, и клиент, который его о чём-то просит, и что происходит, когда просящих становится слишком много.', 'A machine that serves others around the clock; a program that asks; what happens when there are too many asking.'),
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
        'Чайный магазин работает круглые сутки: в три часа ночи кто-то во Владивостоке листает каталог, а в полдень его открывают тысячи людей одновременно. Ваш ноутбук для такой работы не годится, потому что его закрывают, уносят и выключают на ночь. Значит, где-то должна стоять машина, которую не выключают никогда и которая только тем и занята, что отвечает на чужие просьбы. Как она устроена и что с ней происходит, когда просящих становится слишком много?',
        'A tea shop works around the clock: at three in the morning someone in Vladivostok browses the catalogue, and at noon thousands open it at once. Your laptop will not do for that: it gets closed, carried off, switched off for the night. So somewhere there must be a machine that is never switched off and does nothing but answer other people’s requests. How does it work, and what happens to it when too many are asking?',
      ),
    },
    {
      id: 'server',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое сервер', 'A server'),
      body: bi(
        '[[orient.server|Сервер]] — это компьютер, который работает без перерыва и обслуживает другие компьютеры. Внутри у него всё то же самое, что у ноутбука: процессор, память, диск и операционная система, почти всегда Linux. Отличается не начинка, а работа. Сервер стоит в специальном здании с резервным питанием и охлаждением, экрана и клавиатуры у него обычно нет, и разговаривают с ним командами по сети. На сервере запущена программа, которая ждёт просьб и отвечает на них: отдаёт страницы, принимает заказы, хранит данные.\n\nСловом «сервер» называют и саму машину, и эту программу. Обычно из разговора понятно, о чём речь, а когда непонятно, помогают два вопроса: включена ли машина и запущена ли на ней программа. Ответы на них могут быть разными, и на схеме ниже вы увидите, чем один случай отличается от другого.',
        'A [[orient.server|server]] is a computer that runs without a break and serves others. Inside it has all the same: a processor, memory, a disk, an operating system (almost always Linux). The job is what differs. A server stands in a special building with backup power and cooling, usually has no screen or keyboard, and is talked to with commands over the network. And a program runs on it that waits for requests and answers them: it hands out pages, takes orders, keeps data.\n\nThe word “server” names both the machine and that program. Usually the conversation makes clear which is meant, and when it does not, the question helps: “is the machine on? and is the program on it running?” These are two different answers, and in the explainer below you will see how they differ.',
      ),
    },
    {
      id: 'client',
      kind: 'text',
      step: 'explain',
      title: bi('Клиент просит, сервер отвечает', 'The client asks, the server answers'),
      body: bi(
        'Программа, которая обращается к серверу, называется [[orient.client-request|клиентом]], а её просьба — запросом. Ваш браузер тоже клиент: когда вы открываете каталог, он отправляет серверу магазина несколько строк текста, смысл которых сводится к просьбе «дайте, пожалуйста, страницу /catalog». Сервер находит нужные данные, составляет из них страницу и присылает ответ. Ответ начинается с числа, по которому клиент понимает, чем закончилось дело: 200 означает, что всё в порядке, 404 — что такой страницы нет, а 503 — что сервер перегружен.\n\nЗапомните, что разговор всегда начинает клиент. Сервер сам никому не пишет и даже не знает о вашем существовании, пока не придёт ваш запрос.\n\nОдин сервер обслуживает многих клиентов, и отсюда вырастает главная забота инженеров эксплуатации. Если программа тратит на запрос пять миллисекунд, за секунду она успевает ответить на двести запросов. Пока в секунду приходит пятьдесят запросов, никто не ждёт. Когда их приходит сто девяносто, запросы выстраиваются в очередь, и ожидание растёт гораздо быстрее, чем число покупателей. А если приходит больше двухсот, очередь переполняется, и часть людей получает ответ 503.',
        'The program that turns to a server is called the [[orient.client-request|client]], and what it asks for is a request. Your browser is a client: when you open the catalogue, it sends the shop’s server a few lines of text meaning “please give me the page /catalog”. The server finds the data, puts the page together and sends an answer. The answer begins with a number that tells the client how things went: 200 means all is well, 404 no such page, 503 the server is overloaded.\n\nAn important rule: the client always starts the conversation. A server never writes to anyone by itself; it does not even know you exist until your request arrives.\n\nOne server serves many clients, and this is where it gets interesting for operations. If the program spends five milliseconds per request, it can answer two hundred requests a second. While fifty arrive, nobody waits. When a hundred and ninety arrive, requests line up in a queue, and the wait grows much faster than the number of shoppers. And if more than two hundred arrive, the queue overflows and some people get 503.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Путь запроса от браузера до сервера и обратно', 'The path of a request to the server and back'),
      body: bi(
        'Схема ниже показывает один запрос: вы открываете каталог чайного магазина, и браузер просит у сервера страницу /catalog. Сначала на схеме только ваш браузер. Остальные участники появляются, когда до них доходит запрос: сеть провайдеров, другие покупатели, которые в ту же секунду открывают тот же каталог, и сервер магазина, обведённый пунктиром. На сервере работают три части: очередь, в которой запросы ждут, пока программа освободится, сама программа магазина и каталог с ценами.',
        'The diagram below shows one request: you open the tea shop’s catalogue, and the browser asks the server for /catalog. At first it shows only your browser. The others appear when the request reaches them: the providers’ network, other shoppers opening the same catalogue that second, and the shop’s server, outlined with a dashed line, with its queue, its program and the catalogue.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.request', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен тот, кто работает сейчас, облачко рядом с ним говорит, что он делает, а по линии движется карточка: сначала запрос `GET /catalog`, потом цены из каталога, а в конце ответ «200 OK» со страницей. Под схемой растёт водопад, такой же, как во вкладке Network в инструментах разработчика браузера: каждому шагу, который занял время, в нём соответствует своя полоса.\n\nКогда пройдёте запрос до конца, откройте «Параметры». Приведите в магазин толпу покупателей, сначала сто девяносто в секунду, потом больше двухсот, и следите за полосой очереди в водопаде. Перенесите сервер за океан и посмотрите, какая полоса выросла теперь, а потом добавьте второй сервер. Напоследок включите по очереди обе поломки в блоке «Сломать», остановленную программу и перерубленный кабель, и сравните, как быстро браузер узнаёт о беде в каждом случае и какое сообщение при этом печатает.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The one working is highlighted, the callout says what it does, a card travels on the line: the request `GET /catalog`, the prices, the answer “200 OK” with the page. Under the diagram a waterfall grows, as in the browser’s Network tab: one bar per step that took time.\n\nOnce through, open “Parameters”. Bring a crowd, first 190 a second, then over 200, and watch the queue bar. Move the server across the ocean and see which bar grew, then add a second server. Finally switch on both breaks in “Break it” in turn and compare how fast the browser learns of the trouble and what it prints.'), caption: bi('Сообщения, которые вы видели при поломках, пригодятся сразу. В заданиях ниже вы сами отправите запрос командой `curl` и увидите ответ сервера таким, каким его получает браузер. А когда нарочно ошибётесь в имени, `curl` напечатает третье сообщение, которого на схеме не было, потому что запрос не дойдёт даже до сети магазина.', 'The messages you saw with the breaks are useful right away. Below you send a request with `curl` and see the answer as the browser gets it. And when you mistype the name on purpose, `curl` prints a third message the diagram did not have: the request does not even leave.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: laptop(),
      intro: bi('Перед вами учебный ноутбук. Команда `curl` работает как клиент без окон, то есть отправляет запрос и печатает ответ сервера как есть, текстом.', 'The training laptop. `curl` is a client without windows: it sends a request and prints the server’s answer as it is, in text.'),
      tasks: [
        {
          id: 'page',
          prompt: bi('Попросите у сервера магазина главную страницу командой `curl https://shop.example/`. Браузер нарисовал бы из этого текста страницу с заголовком Catalog.', 'Ask the shop’s server for the main page: `curl https://shop.example/`. A browser would draw a page headed Catalog from this text.'),
          check: { stdout: /<h1>Catalog<\/h1>/ },
          chips: 'curl https://shop.example/',
          docRef: man('curl.1'),
          concepts: ['orient.client-request', 'orient.server'],
          hints: { H1: bi('Напечатайте адрес целиком, вместе с `https://` и косой чертой в конце.', 'The whole address, with `https://` and the slash at the end.') },
        },
        {
          id: 'status',
          prompt: bi('Теперь попросите только начало ответа, без самой страницы, командой `curl -I https://shop.example/`. Найдите число в первой строке. Что сервер сообщил о вашем запросе?', 'Now only the beginning of the answer, without the page: `curl -I https://shop.example/`. Find the number in the first line: what did the server say about the request?'),
          check: { stdout: /HTTP\/1\.1 200 OK/ },
          chips: 'curl -I https://shop.example/',
          docRef: man('curl.1', 'OPTIONS', '-I'),
          concepts: ['orient.client-request'],
          hints: { H1: bi('В `-I` стоит заглавная буква i. Эта опция просит показать только заголовки ответа.', '`-I` is a capital i: “show only the headers of the answer”.') },
        },
        {
          id: 'typo',
          prompt: bi('Ошибитесь нарочно и запросите `https://shop.exmaple/` с опечаткой в имени. Какую ошибку напечатал клиент и почему запрос так и не дошёл до сервера?', 'Make a mistake on purpose: request `https://shop.exmaple/`, with a typo in the name. Which error did the client print, and why did it never reach the server?'),
          check: { stdout: /Could not resolve host/ },
          chips: 'curl https://shop.exmaple/',
          concepts: ['orient.client-request', 'orient.network'],
          hints: { H1: bi('Клиент сначала ищет адрес по имени. Такого имени нет, а значит, нет и адреса, по которому можно найти сервер.', 'The client first looks up the address for the name. There is no such name, so there is no server to find.') },
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
        'Сервером называют и машину, которая без перерыва обслуживает другие компьютеры, и программу на ней, которая отвечает на их запросы. Разговор начинает клиент своим запросом, а сервер отвечает числом и данными. Один сервер обслуживает многих клиентов. Когда загрузка подходит к пределу, ожидание резко растёт, а за пределом начинаются ошибки.',
        'A server is a machine that serves others without a break, plus the program on it that answers. The client starts the conversation with a request, the server answers with a number and data. One server serves many; as the load nears its limit the wait rises sharply, and beyond the limit come errors.',
      ),
    },
  ],
};
