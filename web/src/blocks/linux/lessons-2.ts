// Linux lessons 7–13: streams and text, the environment and PATH, processes
// and signals, bash scripts, packages, services and logs (with cron), disks
// and mounting (02 §5.3, М6–М13).

import { bi } from '../../core/i18n';
import type { Facts, Lesson, TerminalSetup } from '../../core/types';
import { BASH_MANUAL, DEBIAN_HANDBOOK, DEBIAN_HANDBOOK_RU, SYSTEMD_MAN, TLCL, arch, man7, opennet, ref, sources, wiki } from './shared';

const text = (f: Facts, p: string) => (f.files[p]?.text ?? '') as string;

// ── 7. Streams, pipelines, text ──

/** The access log of the streams lab: counts of 500s per client are 7, 5, 3, 2, 1. */
export const ACCESS_LOG = (() => {
  const plan: [string, number][] = [['10.0.0.7', 7], ['10.0.0.3', 5], ['10.0.0.12', 3], ['10.0.0.5', 2], ['10.0.0.9', 1]];
  const errs: string[] = [];
  for (let round = 0; round < 7; round++) for (const [ip, n] of plan) if (round < n) errs.push(ip);
  const lines: string[] = [];
  errs.forEach((ip, i) => {
    lines.push(`${plan[(i + 2) % plan.length][0]} GET /menu 200`);
    lines.push(`${ip} POST /orders 500`);
    if (i % 3 === 0) lines.push(`${plan[i % plan.length][0]} GET / 200`);
  });
  return lines.join('\n') + '\n';
})();

export const TOP3 = [
  [7, '10.0.0.7'],
  [5, '10.0.0.3'],
  [3, '10.0.0.12'],
] as const;

const streamsSetup: TerminalSetup = {
  files: [
    { path: '~/access.log', content: ACCESS_LOG },
    { path: '~/downloads/app-1.tar.gz', content: 'release one\n' },
    { path: '~/downloads/app-2.tar.gz', content: 'release two, damaged in transit\n' },
    { path: '~/downloads/app-3.tar.gz', content: 'release three\n' },
    {
      path: '~/downloads/SHA256SUMS',
      content:
        // sha256 of "release one\n", "release two\n", "release three\n"
        'a0b6c9fbf6e1a48e2a8a4bcb11ac0a0ec2e7a5df0c1d0a6cb2e6a1e6e8a3c6c1  app-1.tar.gz\n' +
        'f3b1e0c9d1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c  app-2.tar.gz\n' +
        '0d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e  app-3.tar.gz\n',
    },
  ],
  // the real sums of app-1 and app-3 are written by the setup script, so only app-2 fails
  script: ['cd /home/learner/downloads && sha256sum app-1.tar.gz app-3.tar.gz > /tmp/good.sums && grep app-2 SHA256SUMS >> /tmp/good.sums && cp /tmp/good.sums SHA256SUMS && chown learner:learner SHA256SUMS'],
};

const topOk = (f: Facts) => {
  const rows = text(f, '/home/learner/top.txt')
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((r) => r.length === 2);
  return rows.length === 3 && rows.every((r, i) => Number(r[0]) === TOP3[i][0] && r[1] === TOP3[i][1]);
};

const streams: Lesson = {
  id: 'linux.streams',
  block: 'linux',
  title: bi('Потоки ввода и вывода, конвейеры и обработка текста', 'Input and output streams, pipelines and text processing'),
  summary: bi('Вывод команды можно отправить в файл, а можно передать на вход другой команде. Из нескольких маленьких программ-фильтров складывается ответ на вопрос, который вы задаёте журналу.', 'A command’s output can go to a file, or into the input of another command. A few small filter programs add up to the answer to a question you ask a log.'),
  introduces: ['linux.stream', 'linux.redirect', 'linux.pipe', 'linux.regex', 'linux.checksum'],
  uses: ['linux.argument', 'linux.man-page', 'linux.glob'],
  tier: 'core',
  minutes: 45,
  sources: sources([BASH_MANUAL, man7('regex', 7), man7('sha256sum', 1), TLCL], [wiki('Стандартные потоки', '%D0%A1%D1%82%D0%B0%D0%BD%D0%B4%D0%B0%D1%80%D1%82%D0%BD%D1%8B%D0%B5_%D0%BF%D0%BE%D1%82%D0%BE%D0%BA%D0%B8'), wiki('Конвейер (Unix)', '%D0%9A%D0%BE%D0%BD%D0%B2%D0%B5%D0%B9%D0%B5%D1%80_(Unix)'), wiki('Регулярные выражения', '%D0%A0%D0%B5%D0%B3%D1%83%D0%BB%D1%8F%D1%80%D0%BD%D1%8B%D0%B5_%D0%B2%D1%8B%D1%80%D0%B0%D0%B6%D0%B5%D0%BD%D0%B8%D1%8F')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Руководитель просит: «Посмотрите по журналу, с каких адресов чаще всего приходят ошибки 500». В журнале сорок тысяч строк, а программы, которая считает ошибки по адресам, на машине нет. Зато такую программу можно собрать в одну строку из пяти маленьких, и в этом уроке вы научитесь это делать.', 'Your lead asks: “Check the log and find which addresses get the most 500 errors.” The log has forty thousand lines, and there is no program on the machine that counts errors by address. But you can build one in a single line out of five small ones, and in this lesson you learn how.'),
    },
    {
      id: 'streams',
      kind: 'text',
      step: 'explain',
      title: bi('Три стандартных потока', 'Three standard streams'),
      body: bi(
        'У каждой команды есть три [[linux.stream|стандартных потока]]. Через поток ввода с номером 0 (stdin) команда получает данные, в поток вывода с номером 1 (stdout) она пишет результат, а в поток ошибок с номером 2 (stderr) пишет сообщения об ошибках. Обычно все три потока подключены к терминалу: вы печатаете, и команда читает напечатанное, команда пишет, и вы видите написанное. Ошибки идут отдельным потоком для того, чтобы вы видели их даже тогда, когда вывод отправлен куда-то ещё.\n\n[[linux.redirect|Перенаправление]] подключает поток не к терминалу, а к файлу. Его выполняет оболочка, и сама команда об этом даже не знает:\n\n- `ls /etc > list.txt` отправляет вывод в файл, причём файл создаётся заново или **перезаписывается**;\n- `echo line >> notes.txt` дописывает вывод в конец файла;\n- `wc -l < list.txt` берёт ввод из файла;\n- `cmd 2> errors.txt` отправляет в файл ошибки, а вывод по-прежнему идёт на экран;\n- `cmd > all.txt 2>&1` отправляет ошибки туда же, куда сейчас идёт вывод.',
        'Every command has three [[linux.stream|standard streams]]. Through the input stream, number 0 (stdin), the command gets data; into the output stream, number 1 (stdout), it writes its result; and into the error stream, number 2 (stderr), it writes error messages. Usually all three are connected to the terminal: you type and the command reads it, the command writes and you see it. Errors go in a separate stream so that you see them even when the output has been sent somewhere else.\n\n[[linux.redirect|Redirection]] connects a stream to a file instead of the terminal. The shell does it, and the command does not even know:\n\n- `ls /etc > list.txt` sends the output to a file, which is created anew or **overwritten**;\n- `echo line >> notes.txt` appends the output to the end of a file;\n- `wc -l < list.txt` takes the input from a file;\n- `cmd 2> errors.txt` sends the errors to a file while the output still goes to the screen;\n- `cmd > all.txt 2>&1` sends the errors to wherever the output goes now.',
      ),
    },
    {
      id: 'order',
      kind: 'text',
      step: 'explain',
      title: bi('Почему в записи 2>&1 важен порядок', 'Why the order matters in 2>&1'),
      body: bi(
        'Чаще всего вам хватит первых четырёх форм. Последняя форма нужна, когда вывод и ошибки должны попасть в один файл, и в ней есть тонкость, о которую спотыкаются даже опытные люди.\n\nЗапись `2>&1` означает «направить поток 2 туда, куда **в этот момент** направлен поток 1». Оболочка читает перенаправления слева направо, как список поручений:\n\n```\ncmd > all.txt 2>&1    # сначала 1 → файл, потом 2 → туда же, в файл\ncmd 2>&1 > all.txt    # сначала 2 → туда, где сейчас 1, то есть на экран, потом 1 → файл\n```\n\nВ первой строке к моменту записи `2>&1` поток 1 уже направлен в файл, поэтому оба потока попадут в файл. Во второй строке поток 2 скопировал прежнее направление потока 1, то есть терминал, и ошибки остались на экране.',
        'Most of the time the first four forms are enough. The last one is needed when the output and the errors must land in one file, and it has a subtlety that trips up even experienced people.\n\n`2>&1` means “send stream 2 where stream 1 points **at this moment**”. The shell reads redirections left to right, like a list of errands:\n\n```\ncmd > all.txt 2>&1    # first 1 → file, then 2 → the same place, the file\ncmd 2>&1 > all.txt    # first 2 → where 1 is now, the screen, then 1 → file\n```\n\nIn the first line stream 1 already points to the file by the time of `2>&1`, so both streams end up in the file. In the second line stream 2 copied the earlier direction of stream 1, the terminal, and the errors stayed on screen.',
      ),
    },
    {
      id: 'pipes',
      kind: 'text',
      step: 'explain',
      title: bi('Как работает конвейер команд', 'How a pipeline works'),
      body: bi(
        "Знак `|` соединяет вывод одной команды со вводом следующей, и такая цепочка называется [[linux.pipe|конвейером команд]]. Каждая команда в конвейере делает одно маленькое дело:\n\n- `grep образец` оставляет только строки, в которых есть образец; с флагом `-v` она оставляет строки, где образца нет, с `-c` считает подходящие строки, с `-i` не различает заглавные и строчные буквы, а с `-w` ищет образец только целым словом;\n- `cut -d' ' -f1` берёт из каждой строки первое поле, если поля разделены пробелом;\n- `sort` упорядочивает строки, с флагом `-n` сравнивает их как числа, а с флагом `-r` сортирует в обратном порядке;\n- `uniq -c` склеивает **соседние** одинаковые строки и пишет, сколько их было, поэтому перед ней почти всегда стоит `sort`;\n- `head -3` берёт первые три строки, а `wc -l` считает строки.\n\nТак вопрос «какие адреса чаще всего получают ответ 500» превращается в одну строку:\n\n```\ngrep ' 500' access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -3\n```\n\nЧитают её слева направо. Сначала остаются строки с кодом 500, из них берутся только адреса, адреса выстраиваются по порядку, одинаковые адреса подсчитываются, самые частые поднимаются наверх, и из них берутся первые три.\n\nОбразец для `grep` записывается [[linux.regex|регулярным выражением]], то есть шаблоном строки. Знак `^` обозначает начало строки, `$` обозначает её конец, точка `.` подходит к любому символу, звёздочка `*` разрешает повторить предыдущий символ сколько угодно раз, а `[0-9]` подходит к любой цифре. Поэтому `grep '^ERROR'` найдёт строки, которые начинаются с ERROR, а `grep -E '5[0-9]{2}$'` найдёт строки, которые оканчиваются любым кодом от 500 до 599.\n\nВ чужих конвейерах вам часто встретятся ещё две команды. Команда `sed 's/было/стало/g'` заменяет в каждой строке одно слово другим, а команда `awk '{print $1}'` печатает из каждой строки только первый столбец, как `cut`, но столбцы она отделяет любым числом пробелов. В заданиях этого урока они не понадобятся, и пока достаточно узнавать их в чужих строках.",
        'The `|` sign connects the output of one command to the input of the next, and such a chain is called a [[linux.pipe|shell pipeline]]. Each command in it does one small job:\n\n- `grep pattern` keeps only the lines that contain the pattern; with `-v` it keeps the lines without it, with `-c` it counts the matching lines, with `-i` it ignores case, and with `-w` it matches only whole words;\n- `cut -d\' \' -f1` takes the first field of each line when fields are separated by a space;\n- `sort` puts lines in order, with `-n` it compares them as numbers, and with `-r` it sorts in reverse;\n- `uniq -c` merges **adjacent** identical lines and writes how many there were, which is why `sort` almost always comes before it;\n- `head -3` takes the first three lines, and `wc -l` counts lines.\n\nSo the question “which addresses get the 500 answer most often” turns into a single line:\n\n```\ngrep \' 500\' access.log | cut -d\' \' -f1 | sort | uniq -c | sort -rn | head -3\n```\n\nRead it left to right. First the lines with 500 remain, then only their addresses are taken, the addresses are put in order, identical addresses are counted, the most frequent rise to the top, and the first three are taken.\n\nThe pattern for `grep` is written as a [[linux.regex|regular expression]], a pattern of a line. `^` marks the start of the line, `$` its end, a dot `.` matches any character, a star `*` lets the previous character repeat any number of times, and `[0-9]` matches any digit. So `grep \'^ERROR\'` finds lines that start with ERROR, and `grep -E \'5[0-9]{2}$\'` finds lines that end with any code from 500 to 599.\n\nIn other people’s pipelines you will often meet two more commands. `sed \'s/old/new/g\'` replaces one word with another in every line, and `awk \'{print $1}\'` prints only the first column of every line, like `cut`, but it separates columns by any number of spaces. The tasks of this lesson do not need them, and for now it is enough to recognise them in other people’s lines.',
      ),
    },
    {
      id: 'checksum',
      kind: 'text',
      step: 'explain',
      title: bi('Как проверить файл по контрольной сумме', 'How to check a file by its checksum'),
      body: bi(
        '[[linux.checksum|Контрольной суммой]] называют короткую строку, которую вычисляют по содержимому файла. Команда `sha256sum app.tar.gz` печатает такую строку из 64 шестнадцатеричных символов, то есть цифр от 0 до 9 и латинских букв от a до f. Если в файле изменится хотя бы один байт, сумма изменится целиком. Поэтому рядом со скачиваемыми файлами публикуют список их сумм, а команда `sha256sum -c SHA256SUMS` сверяет каждый файл со списком и пишет напротив него OK, если сумма совпала, или FAILED, если не совпала. Так проверяют, что файл скачался целым и что по дороге его никто не подменил.',
        'A [[linux.checksum|checksum]] is a short string computed from a file’s contents. `sha256sum app.tar.gz` prints such a string of 64 hexadecimal characters, that is, digits 0 to 9 and the Latin letters a to f. If even one byte of the file changes, the whole sum changes. That is why lists of sums are published next to downloadable files, and `sha256sum -c SHA256SUMS` checks every file against the list and writes OK next to it if the sum matches or FAILED if it does not. That is how you make sure a file arrived whole and nobody swapped it on the way.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: streamsSetup,
      tasks: [
        {
          id: 'top',
          prompt: bi('Запишите в файл `~/top.txt` три адреса, которые чаще всего получают ответ 500, вместе с числом таких ответов. Самый частый адрес должен стоять первым, а строки должны выглядеть так, как их печатает `uniq -c`.', 'Write into `~/top.txt` the three addresses that get the 500 answer most often, with their counts, the most frequent first — the way `uniq -c` prints them.'),
          check: {
            when: topOk,
            fail: [
              { if: (f) => /\b1 10\.0\.0\.7\b/.test(text(f, '/home/learner/top.txt')), say: bi('Один и тот же адрес попал в файл несколькими строками с маленькими счётчиками, потому что `uniq -c` склеивает только соседние одинаковые строки, а в журнале строки одного адреса стоят вперемешку с другими. Поставьте перед `uniq -c` команду `sort`, и одинаковые адреса окажутся рядом.', 'The same address got into the file as several lines with small counts, because `uniq -c` merges only adjacent identical lines, and in the log the lines of one address are mixed with others. Put `sort` in front of `uniq -c`, and identical addresses end up next to each other.') },
              { if: (f) => text(f, '/home/learner/top.txt').split('\n').filter(Boolean).length > 3, say: bi('В файле больше трёх строк. Оставьте первые три, добавив в конец конвейера `head -3`.', 'The file has more than three lines. Keep the first three by adding `head -3` to the end of the pipeline.') },
            ],
          },
          chips: "grep ' 500' access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -3 > ~/top.txt",
          docRef: ref('man/uniq.1', 'DESCRIPTION', 'does not detect repeated lines unless they are adjacent'),
          hints: {
            H1: bi('Разбейте вопрос на шаги: какие строки нужны, какое поле из них взять, как посчитать одинаковые и как упорядочить результат.', 'Break the question into steps: which lines you need, which field to take from them, how to count identical ones and how to order the result.'),
            H2: bi('Соедините знаком `|` команды `grep`, `cut`, `sort`, `uniq -c`, `sort -rn` и `head`, а результат отправьте в файл знаком `>`.', 'Join `grep`, `cut`, `sort`, `uniq -c`, `sort -rn` and `head` with `|`, and send the result into the file with `>`.'),
          },
        },
        {
          id: 'split',
          prompt: bi('Выполните команду `ls /etc/hostname /nosuch` так, чтобы обычный вывод попал в файл `~/out.txt`, а сообщение об ошибке попало в файл `~/err.txt`.', 'Run `ls /etc/hostname /nosuch` so that the normal output goes to `~/out.txt` and the error message to `~/err.txt`.'),
          check: {
            when: "files['/home/learner/out.txt'].text~'/etc/hostname' && files['/home/learner/err.txt'].text~'No such file' && !(files['/home/learner/out.txt'].text~'No such file')",
            fail: [{ if: "files['/home/learner/out.txt'].text~'No such file'", say: bi('Сообщение об ошибке попало в out.txt, потому что в команде стоит `2>&1`. Потоку 2 нужен собственный файл, и записывается это как `2> ~/err.txt`.', 'The error message got into out.txt because the command has `2>&1`. Stream 2 needs its own file, written as `2> ~/err.txt`.') }],
          },
          chips: 'ls /etc/hostname /nosuch > ~/out.txt 2> ~/err.txt',
          docRef: ref('man/bash.1', 'REDIRECTION', '2> file'),
          hints: { H1: bi('Поток вывода имеет номер 1, а поток ошибок номер 2, и у каждого из них может быть своё перенаправление.', 'The output stream is number 1 and the error stream number 2, and each may have its own redirection.') },
        },
        {
          id: 'sums',
          prompt: bi('В каталоге `~/downloads` лежат три архива и список их контрольных сумм `SHA256SUMS`. Проверьте архивы по этому списку и запишите имя испорченного файла в `~/bad.txt`.', 'The `~/downloads` directory holds three archives and the list of their checksums, `SHA256SUMS`. Check the archives against the list and write the name of the damaged file into `~/bad.txt`.'),
          check: { when: "files['/home/learner/bad.txt'].text~'app-2.tar.gz' && !(files['/home/learner/bad.txt'].text~'app-1') && !(files['/home/learner/bad.txt'].text~'app-3')" },
          chips: 'cd ~/downloads && sha256sum -c SHA256SUMS',
          docRef: ref('man/sha256sum.1', 'OPTIONS', '-c, --check'),
          hints: { H1: bi('У команды `sha256sum` есть режим, в котором она проверяет файлы по готовому списку сумм.', '`sha256sum` has a mode that checks against a list.'), H2: bi('Найдите в выводе строку со словом FAILED и запишите имя этого файла в `~/bad.txt`. Можно записать его и вручную, например командой `echo app-?.tar.gz > ~/bad.txt`.', 'Find the line with FAILED in the output and write that file’s name into `~/bad.txt`. You may also write it by hand, for example with `echo app-?.tar.gz > ~/bad.txt`.') },
        },
      ],
    },
    {
      id: 'word',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите на странице `grep(1)` флаг, с которым `grep` ищет `GET` только отдельным словом, и посчитайте одним числом, сколько таких строк в `~/access.log`.', 'Find on the page `grep(1)` the flag that makes `grep` look for `GET` only as a separate word, and count as a single number how many such lines `~/access.log` has.'),
      ref: ref('man/grep.1', 'OPTIONS', '-w, --word-regexp'),
      terminal: {
        setup: { files: [{ path: '~/access.log', content: 'GET /\nGETTER /x\nPOST /y\nGET /z\n' }] },
        task: {
          id: 'word',
          prompt: bi('Выведите одно число, равное количеству строк, в которых GET стоит отдельным словом.', 'Print one number: how many lines contain GET as a separate word.'),
          check: { stdout: /^2\n$/ },
          docStep: 2,
          chips: 'grep -cw GET ~/access.log',
          hints: { H1: bi('Вам понадобятся два флага: один велит искать целым словом, а другой велит посчитать строки.', 'You need two flags: one to match whole words and one to count the lines.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.redirect-order', 'linux.q.uniq', 'linux.q.regex', 'linux.q.pipe-bug'] },
  ],
};

// ── 8. The environment and PATH ──

const envSetup: TerminalSetup = {
  files: [{ path: '~/bin/hello', content: '#!/usr/bin/sim\n# hello: a lab program\n', mode: '0755' }],
};

const env: Lesson = {
  id: 'linux.env',
  block: 'linux',
  title: bi('Переменные оболочки, окружение и PATH', 'Shell variables, the environment and PATH'),
  summary: bi('В этом уроке вы узнаете, почему программа лежит на диске, а терминал пишет `command not found`, и как сделать так, чтобы настройка сохранялась дольше, чем открыто одно окно терминала.', 'In this lesson you learn why a program is on the disk while the terminal says `command not found`, and how to make a setting last longer than one terminal window.'),
  introduces: ['linux.variable', 'linux.env', 'linux.path-var'],
  uses: ['linux.home', 'linux.redirect', 'linux.builtin'],
  tier: 'core',
  minutes: 30,
  sources: sources([man7('environ', 7), BASH_MANUAL, man7('bash', 1)], [wiki('Переменная среды', '%D0%9F%D0%B5%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F_%D1%81%D1%80%D0%B5%D0%B4%D1%8B'), opennet('environ', 7)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Вы положили программу `hello` в каталог `~/bin`. Она лежит на месте и запускается, если набрать полный путь к ней. Но когда вы набираете одно имя `hello`, оболочка отвечает `command not found`, то есть «команда не найдена». Получается, что машина не видит файл в вашем собственном домашнем каталоге, и в этом уроке вы разберётесь, почему так происходит.', 'You put a program called `hello` into `~/bin`. It is there and runs if you type its full path. But when you type only the name `hello`, the shell answers `command not found`. It looks as if the machine cannot see a file in your own home directory, and in this lesson you find out why.'),
    },
    {
      id: 'vars',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое переменная оболочки', 'What a shell variable is'),
      body: bi(
        '[[linux.variable|Переменная оболочки]] связывает имя со значением, например `CITY=Almaty`, причём пробелов вокруг знака `=` быть не должно. Встретив в строке `$CITY`, оболочка заменяет его значением ещё до запуска команды, поэтому `echo "I live in $CITY"` напечатает название города. Будет ли замена, решают кавычки. В двойных кавычках оболочка подставляет значения переменных, а в одинарных нет, и команда `echo \'$CITY\'` напечатает сами символы `$CITY`.\n\nПеременная оболочки существует только в той оболочке, где её задали. Программы, которые вы запускаете, получают копию другого набора переменных, который называется [[linux.env|окружением]]. Чтобы переменная попала в окружение, её помечают командой `export`, например `export CITY`. Проверить, что видит запущенная программа, несложно. Команда `bash -c \'echo $CITY\'` запускает новую оболочку и печатает то значение, которое получила она. Весь набор переменных окружения показывает команда `env`.',
        'A [[linux.variable|shell variable]] ties a name to a value, for example `CITY=Almaty`, with no spaces around `=`. When the shell meets `$CITY` in a line, it replaces it with the value before the command starts, so `echo "I live in $CITY"` prints the name of the city. Quotes decide whether the replacement happens. Inside double quotes the shell substitutes variables, inside single quotes it does not, and `echo \'$CITY\'` prints the characters `$CITY` themselves.\n\nA shell variable exists only in the shell where it was set. The programs you start receive a copy of another set of variables, called the [[linux.env|environment]]. To get a variable into the environment, mark it with `export`, for example `export CITY`. Checking what a started program sees is easy. `bash -c \'echo $CITY\'` starts a new shell and prints the value that shell received. `env` shows the whole set of environment variables.',
      ),
    },
    {
      id: 'path',
      kind: 'text',
      step: 'explain',
      title: bi('Как оболочка ищет программы по списку PATH', 'How the shell finds programs through PATH'),
      body: bi(
        'Самая важная переменная окружения называется [[linux.path-var|PATH]]. В ней записан список каталогов, разделённых двоеточиями:\n\n```\n$ echo $PATH\n/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n```\n\nКогда вы набираете имя команды без знака `/`, оболочка по очереди заглядывает в эти каталоги и запускает первую найденную программу с таким именем. Ни текущего каталога, ни `~/bin` в этом списке нет, поэтому программу, которая лежит в `~/bin`, оболочка не находит и отвечает `command not found`. По той же причине программу из текущего каталога запускают как `./prog`: если в имени есть `/`, оболочка не ищет программу по PATH, а берёт её по указанному пути.\n\nНовый каталог добавляют к списку, а не записывают вместо него:\n\n```\nexport PATH="$HOME/bin:$PATH"\n```\n\nКоманда `export PATH=/opt/bin` без `$PATH` заменит весь список, и после неё оболочка перестанет находить `ls`, `cat` и все остальные программы из `/usr/bin`. В каком каталоге оболочка нашла команду, покажут `which hello` и `type hello`.\n\nВсё, что вы задали в оболочке, пропадает, когда терминал закрывается. Чтобы настройка действовала в каждой новой оболочке, нужную строку дописывают в файл `~/.bashrc`, который выполняется при запуске каждой интерактивной оболочки. Дописать строку в конец файла можно знаком `>>` из урока о потоках:\n\n```\necho \'export PATH="$HOME/bin:$PATH"\' >> ~/.bashrc\n```\n\nОдинарные кавычки здесь обязательны. В двойных кавычках оболочка подставила бы вместо `$PATH` его нынешнее значение, и в файл попал бы длинный готовый список каталогов. Такая строка тоже сработает, но навсегда закрепит сегодняшний список, и когда система добавит в PATH новый каталог, ваша настройка его затрёт. В одинарных кавычках в файл попадают сами символы `$HOME` и `$PATH`, и подставляются они заново при каждом запуске оболочки. В уже открытой оболочке файл можно выполнить заново командой `source ~/.bashrc`.',
        'The most important environment variable is [[linux.path-var|PATH]]. It holds a list of directories separated by colons:\n\n```\n$ echo $PATH\n/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n```\n\nWhen you type a command name without `/`, the shell looks into these directories in order and runs the first program with that name it finds. Neither the current directory nor `~/bin` is on the list, and that is the whole secret of `command not found`. For the same reason a program in the current directory is started as `./prog`: when the name has a `/`, the shell does not search PATH but takes the program at the given path.\n\nA new directory is added to the list, not written instead of it:\n\n```\nexport PATH="$HOME/bin:$PATH"\n```\n\n`export PATH=/opt/bin` without `$PATH` replaces the whole list, and after it the shell no longer finds `ls`, `cat` and every other program in `/usr/bin`. `which hello` and `type hello` show in which directory the shell found a command.\n\nEverything you set in a shell is gone when the terminal closes. To make a setting apply in every new shell, append the line to `~/.bashrc`, which runs whenever an interactive shell starts. You append a line to the end of a file with `>>` from the streams lesson:\n\n```\necho \'export PATH="$HOME/bin:$PATH"\' >> ~/.bashrc\n```\n\nThe single quotes are required here. Inside double quotes the shell would substitute the current value for `$PATH`, and the file would get a long ready-made list of directories. Such a line works too, but it freezes today’s list for good, and when the system adds a new directory to PATH, your setting overwrites it. Inside single quotes the characters `$HOME` and `$PATH` themselves go into the file, and they are substituted anew every time a shell starts. In a shell that is already open you can run the file again with `source ~/.bashrc`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: envSetup,
      tasks: [
        {
          id: 'run',
          prompt: bi('Сделайте так, чтобы программа запускалась по одному имени `hello`, и запустите её.', 'Make the program run by its name, `hello`, and run it.'),
          check: {
            when: "vars.PATH~'/home/learner/bin' && vars.PATH~'/usr/bin' && term['main'][last].exit=0",
            stdout: 'hello from',
            fail: [{ if: "!(vars.PATH~'/usr/bin')", say: bi('В PATH остался только ваш каталог, а `/usr/bin` из списка пропал, и теперь оболочка не найдёт другие команды. Добавляйте каталог к `$PATH`, а не записывайте его вместо списка.', 'Only your directory is left in PATH, `/usr/bin` is gone, and now the shell will not find other commands. Add the directory to `$PATH` instead of writing it in place of the list.') }],
          },
          chips: 'export PATH="$HOME/bin:$PATH" && hello',
          docRef: ref('man/bash.1', 'DESCRIPTION'),
          hints: { H1: bi('Оболочка ищет программы только в тех каталогах, которые перечислены в PATH.', 'The shell looks for programs only in the PATH directories.'), H2: bi('Добавьте `$HOME/bin` в начало PATH так, чтобы остальные каталоги в списке сохранились.', 'Put `$HOME/bin` at the start of PATH so that the other directories stay on the list.') },
        },
        {
          id: 'persist',
          prompt: bi('Сделайте эту настройку постоянной, чтобы каждая новая оболочка находила программу `hello`.', 'Make that setting permanent so that every new shell finds `hello`.'),
          check: {
            when: (f) => /PATH=.*(\$HOME|~|\/home\/learner)\/bin/.test(text(f, '/home/learner/.bashrc')) && /\$PATH|\$\{PATH\}/.test(text(f, '/home/learner/.bashrc')),
            fail: [
              { if: (f) => /PATH=.*\/home\/learner\/bin:\/usr/.test(text(f, '/home/learner/.bashrc')), say: bi('Строка дописана в `~/.bashrc`, но вместо `$PATH` в неё попал готовый список каталогов, потому что строка стояла в двойных кавычках и оболочка подставила значение заранее. Такая настройка навсегда закрепит сегодняшний список. Допишите строку ещё раз, взяв её в одинарные кавычки: `echo \'export PATH="$HOME/bin:$PATH"\' >> ~/.bashrc`.', 'The line is in `~/.bashrc`, but a ready list of directories got into it instead of `$PATH`, because the line was in double quotes and the shell substituted the value in advance. Such a setting freezes today’s list for good. Append the line again in single quotes: `echo \'export PATH="$HOME/bin:$PATH"\' >> ~/.bashrc`.') },
            ],
          },
          chips: `echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc`,
          hints: { H1: bi('Подумайте, какой файл выполняется при запуске каждой новой оболочки.', 'Think about which file runs when every new shell starts.'), H2: bi('Допишите строку в конец файла `~/.bashrc` с помощью `>>` и возьмите её в одинарные кавычки, чтобы `$PATH` записался в файл как есть, без подстановки.', 'Append the line to `~/.bashrc` with `>>` and put it in single quotes so that `$PATH` is written to the file as it is, without substitution.') },
        },
        {
          id: 'export',
          prompt: bi('Задайте переменную `GREETING` со значением `hi` так, чтобы её видела запущенная программа. Если всё сделано верно, команда `bash -c \'echo $GREETING\'` напечатает `hi`.', 'Set the variable `GREETING` to `hi` so that a started program sees it. Check the result: `bash -c \'echo $GREETING\'` must print `hi`.'),
          check: { when: "vars.GREETING=hi", stdout: /^hi\n$/, fail: [{ if: (f) => f.vars.GREETING === 'hi' && (f.term.main.at(-1)?.out ?? 'x').trim() === '', say: bi('Переменная задана в оболочке, но в окружение не попала, потому что без `export` запущенная программа её не получает.', 'The variable is set in the shell but did not get into the environment, because without `export` a started program does not receive it.') }] },
          chips: `export GREETING=hi && bash -c 'echo $GREETING'`,
          docRef: { url: 'https://man7.org/linux/man-pages/man7/environ.7.html', label: 'environ(7)' },
          hints: { H1: bi('Запущенные программы получают только те переменные, которые помечены командой `export`.', 'Started programs receive only the variables marked with `export`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.export', 'linux.q.path-replace', 'linux.q.quotes'] },
  ],
};

// ── 9. Processes, signals and the kernel ──

const procSetup: TerminalSetup = {
  ext: { linux: { procs: [{ argv: ['burner'], user: 'learner' }, { argv: ['sigdemo'], user: 'learner' }] } },
};

const memOk = (f: Facts) => {
  const lines = text(f, '/home/learner/mem.txt').trim().split('\n');
  if (lines.length < 3 || !/PID/.test(lines[0]) || !/RSS/.test(lines[0])) return false;
  const rss = lines.slice(1).map((l) => Number(l.trim().split(/\s+/)[1]));
  return rss.every((v, i) => Number.isFinite(v) && (i === 0 || v <= rss[i - 1]));
};

const processes: Lesson = {
  id: 'linux.processes',
  block: 'linux',
  title: bi('Процессы, сигналы и ядро', 'Processes, signals and the kernel'),
  summary: bi('Программа хранится на диске в виде файла, а процессом называют программу, которая выполняется. В этом уроке вы узнаете, как появляется процесс, как его найти, как вежливо его остановить и что сообщает код завершения.', 'A program is stored on disk as a file, and a process is a program that is running. In this lesson you learn how a process comes into being, how to find it, how to stop it politely and what its exit code tells you.'),
  introduces: ['linux.process', 'linux.fork-exec', 'linux.signal', 'linux.exit-code', 'linux.kernel', 'linux.syscall'],
  uses: ['linux.path-var', 'linux.pipe', 'linux.stream', 'linux.user'],
  tier: 'core',
  minutes: 45,
  sources: sources([man7('ps', 1), man7('signal', 7), man7('fork', 2), man7('execve', 2), TLCL], [wiki('Процесс (информатика)', '%D0%9F%D1%80%D0%BE%D1%86%D0%B5%D1%81%D1%81_(%D0%B8%D0%BD%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0)'), wiki('Сигнал (Unix)', '%D0%A1%D0%B8%D0%B3%D0%BD%D0%B0%D0%BB_(Unix)'), opennet('ps', 1), opennet('signal', 7)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Коллега пишет: «Сервер тормозит, посмотрите, что там занимает процессор». Искать нужно не файл и не каталог, а то, что работает на машине прямо сейчас. В этом уроке вы узнаете, как такие работающие программы называются, как их найти и как остановить.', 'A colleague writes: “The server is slow, see what is taking the CPU.” What you look for is not a file or a directory but something running on the machine right now. In this lesson you learn what these running programs are called, how to find them and how to stop them.'),
    },
    {
      id: 'process',
      kind: 'text',
      step: 'explain',
      title: bi('Чем программа отличается от процесса', 'How a program differs from a process'),
      body: bi(
        'Программа хранится на диске в виде файла, например `/usr/bin/ls`. [[linux.process|Процессом]] называют программу, которая выполняется. У процесса есть номер (PID), память, открытые файлы, пользователь, от имени которого он работает, и родитель, то есть процесс, который его запустил; номер родителя называется PPID. Одна и та же программа может выполняться сразу в нескольких процессах.\n\nВсем этим управляет [[linux.kernel|ядро]], та часть системы, которая распределяет между процессами процессор, память и устройства. Процессы не обращаются к диску или к сети сами, а просят ядро сделать это с помощью [[linux.syscall|системных вызовов]]. Например, чтобы прочитать файл, процесс сначала просит ядро открыть его вызовом `openat`. Ещё два вызова встретятся вам на схеме ниже: `clone` создаёт процесс, а `execve` загружает в него программу.\n\nПроцессы показывает команда `ps`. Без аргументов она перечисляет ваши процессы в этом терминале, а `ps aux` перечисляет все процессы машины вместе с пользователем, долей процессора и долей памяти. Команда `top` показывает те же процессы, отсортированные по нагрузке, а над ними печатает сводку о машине. Команда `pstree -p` рисует процессы деревом, потому что у каждого процесса, кроме самого первого, есть родитель.',
        'A program is stored on disk as a file, for example `/usr/bin/ls`. A [[linux.process|process]] is a program that is running. A process has a number (PID), memory, open files, a user it runs as, and a parent, the process that started it; the parent’s number is called the PPID. One program can run in several processes at once.\n\nAll of this is managed by the [[linux.kernel|kernel]], the part of the system that shares the CPU, memory and devices between processes. Processes do not touch the disk or the network themselves; they ask the kernel to do it with [[linux.syscall|system calls]]. For example, to read a file a process first asks the kernel to open it with the `openat` call. Two more calls appear in the diagram below: `clone` creates a process, and `execve` loads a program into it.\n\n`ps` shows processes. With no arguments it lists your processes in this terminal, and `ps aux` lists all processes of the machine with the user, the share of CPU and the share of memory. `top` shows the same processes sorted by load, with a summary of the machine above them. `pstree -p` draws processes as a tree, because every process except the very first has a parent.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что делает оболочка после нажатия Enter', 'What the shell does after you press Enter'),
      body: bi('Схема ниже в замедленном виде показывает, что происходит за несколько миллисекунд после того, как вы набрали `ls -l /etc > list.txt` и нажали Enter. В левой части схемы находятся набранная строка и процесс оболочки, вверху список каталогов PATH, по которому оболочка ищет программу, в середине копия оболочки, которая станет программой `ls`, справа файл `list.txt` и терминал, а внизу ядро, которое выполняет просьбы процессов. Под схемой счётчики показывают, сколько каталогов PATH оболочка проверила, сколько копий создала, сколько программ загрузила и какой код завершения получила.', 'The diagram below replays in slow motion what happens in the few milliseconds after you type `ls -l /etc > list.txt` and press Enter. On the left are the typed line and the shell process, at the top the PATH list the shell searches for the program, in the middle the copy of the shell that becomes `ls`, on the right the file `list.txt` and the terminal, and at the bottom the kernel, which carries out the processes’ requests. Under the diagram the counters show how many PATH directories the shell checked, how many copies it made, how many programs it loaded and which exit code it got.'),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.exec', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, а облачко рядом с ним полным предложением говорит, что он делает. По линиям движется карточка с тем, что передаётся дальше: имя программы, системный вызов, код завершения. Новые блоки появляются на схеме тогда, когда до них доходит очередь, а красная рамка отмечает место, где запуск остановился.\n\nКогда дойдёте до нового приглашения, выберите в группе «Что вы набираете» строку `cd /tmp` и посмотрите, какие шаги исчезнут. Потом в группе «Где оболочка ищет программы» выберите список, в котором остался один каталог `/opt/tools/bin`. Напоследок включите в блоке «Сломать» поломку, которая снимает бит x с программы, и сравните, на каком шаге остановится запуск и с каким кодом.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says in a full sentence what it does. A card moves along the lines with what is handed on: the program name, a system call, the exit code. New blocks appear when their turn comes, and a red outline marks where the start stopped.\n\nOnce you reach the new prompt, choose `cd /tmp` in “What you type” and see which steps disappear. Then in “Where the shell looks for programs” choose the list with the single directory `/opt/tools/bin`. Finally, switch on the break in “Break it” that removes the x bit from the program, and compare at which step the start stops and with which code.'), caption: bi('Всё, что вы видели на схеме, оболочка проделывает для каждой команды, которую вы набираете. Поэтому сообщения об ошибках теперь можно читать по этапам: `command not found` с кодом 127 означает, что программа не нашлась в PATH, код 126 означает, что программа найдена, но запустить её нельзя, а сообщение, которое начинается со слова `bash:` и называет файл перенаправления, означает, что программа даже не запускалась. В следующем разделе урока эти этапы разобраны подробнее.', 'Everything you saw in the diagram the shell does for every command you type. So you can now read error messages by stage: `command not found` with code 127 means the program was not found in PATH, code 126 means it was found but cannot be run, and a message that starts with `bash:` and names the redirection file means the program never even started. The next section of the lesson goes through these stages in more detail.') },
    {
      id: 'fork',
      kind: 'text',
      step: 'explain',
      title: bi('Как появляется новый процесс', 'How a new process comes into being'),
      body: bi(
        'Когда вы нажимаете Enter, оболочка находит программу по PATH и создаёт копию самой себя. Этот шаг называется [[linux.fork-exec|fork]]. У копии новый номер, но те же переменные окружения и те же открытые файлы, что у оболочки. Копия настраивает перенаправления, а потом просит ядро загрузить в неё нужную программу, и этот шаг называется exec. Номер процесса при этом не меняется. Сама оболочка всё это время ждёт, когда процесс завершится.\n\nИз этого устройства следует несколько правил, которые раньше казались правилами без причины. Запущенная программа видит экспортированные переменные, потому что она копия оболочки. Ошибка в перенаправлении возникает ещё до того, как программа запустится, потому что перенаправление выполняет копия до шага exec. А `cd` сделан встроенной командой, потому что смена каталога в копии не изменила бы каталог самой оболочки.\n\nЗавершаясь, процесс сообщает число, которое называется [[linux.exit-code|кодом завершения]]. Ноль означает успех, а любое другое число означает, что что-то пошло не так. Оболочка сохраняет этот код в переменной `$?`. Например, `grep` возвращает 1, если ничего не нашёл, `ls` возвращает 2, если файла нет, а код 127 означает, что команда не найдена. Пока родитель не забрал код завершения, завершившийся процесс остаётся строкой в таблице процессов. Такой процесс называют зомби, и в выводе `ps` он помечен буквой `Z`.',
        'When you press Enter, the shell finds the program in PATH and creates a copy of itself. This step is called [[linux.fork-exec|fork]]. The copy has a new number but the same environment variables and the same open files as the shell. The copy sets up the redirections and then asks the kernel to load the right program into it, and this step is called exec. The process number does not change. Meanwhile the shell waits for the process to finish.\n\nThis design explains several rules that used to look like rules without a reason. A started program sees the exported variables because it is a copy of the shell. An error in a redirection appears before the program starts, because the copy does the redirection before exec. And `cd` is a builtin, because changing the directory of a copy would not change the directory of the shell itself.\n\nWhen a process finishes, it reports a number called the [[linux.exit-code|exit code]]. Zero means success, and any other number means something went wrong. The shell keeps the code in `$?`. For example, `grep` returns 1 if it found nothing, `ls` returns 2 if the file is missing, and code 127 means the command was not found. Until the parent collects the exit code, the finished process stays a line in the process table. Such a process is called a zombie, and `ps` marks it with the letter `Z`.',
      ),
    },
    {
      id: 'signals',
      kind: 'text',
      step: 'explain',
      title: bi('Как остановить процесс сигналом', 'How to stop a process with a signal'),
      body: bi(
        'Остановить процесс можно только одним способом: попросить ядро передать ему [[linux.signal|сигнал]], то есть короткое сообщение с номером. Команда `kill PID` посылает сигнал TERM с номером 15, который означает «пожалуйста, завершись». Процесс может перехватить этот сигнал, сохранить данные и завершиться, а может и проигнорировать его. Сигнал KILL, который посылает `kill -9 PID`, процесс перехватить не может: ядро завершает процесс сразу, и прибраться за собой он не успевает. Поэтому сначала посылают TERM и только если он не помог, посылают KILL.\n\nСигналов много, но на практике вам понадобятся пять:\n\n- сигнал **TERM** (номер 15) посылает команда `kill PID`, и он вежливо просит процесс завершиться;\n- сигнал **KILL** (номер 9) посылает команда `kill -9 PID`, и ядро завершает процесс сразу, без возможности возразить;\n- сигнал **INT** посылает сочетание Ctrl+C в терминале, и он прерывает команду, которая сейчас работает;\n- сигнал **TSTP** посылает сочетание Ctrl+Z, и он приостанавливает процесс, который в выводе `ps` помечается буквой `T` и продолжает работу после команды `fg`;\n- сигнал **HUP** посылает команда `kill -HUP PID`, и многие службы понимают его как просьбу перечитать настройки.\n\nНомер процесса можно узнать из вывода `ps` или командой `pgrep имя`, а команда `pkill имя` посылает сигнал процессу по имени. Процесс, который завершён сигналом с номером N, получает код завершения 128 + N, поэтому после TERM код равен 143, а после KILL он равен 137.\n\nКоманду можно запустить в фоне, если добавить в конце знак `&`. Тогда оболочка не ждёт её завершения и сразу показывает приглашение. Команда `jobs` перечисляет фоновые задания, `fg` возвращает задание на передний план, а `kill %1` посылает сигнал первому заданию.',
        'There is only one way to stop a process: ask the kernel to deliver it a [[linux.signal|signal]], a short message with a number. `kill PID` sends TERM, number 15, which means “please finish”. The process may catch it, save its data and exit, or it may ignore it. KILL, sent by `kill -9 PID`, cannot be caught: the kernel ends the process at once, and it has no time to clean up. So you send TERM first, and KILL only if TERM did not help.\n\nThere are many signals, but in practice you need five:\n\n- **TERM** (number 15) is sent by `kill PID`, and it politely asks the process to finish;\n- **KILL** (number 9) is sent by `kill -9 PID`, and the kernel ends the process at once, with no chance to object;\n- **INT** is sent by Ctrl+C in the terminal, and it interrupts the command running now;\n- **TSTP** is sent by Ctrl+Z, and it pauses the process, which `ps` marks with `T` and which goes on after `fg`;\n- **HUP** is sent by `kill -HUP PID`, and many services take it as a request to re-read their settings.\n\nYou find a process number in the output of `ps` or with `pgrep name`, and `pkill name` sends a signal to a process by name. A process ended by signal number N gets the exit code 128 + N, so after TERM the code is 143 and after KILL it is 137.\n\nA command can run in the background if you add `&` at the end. Then the shell does not wait for it and shows the prompt at once. `jobs` lists the background jobs, `fg` brings a job back to the foreground, and `kill %1` sends a signal to job one.',
      ),
    },
    {
      id: 'pipe-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как конвейер выглядит изнутри', 'What a pipeline looks like inside'),
      body: bi('В уроке о потоках вы собирали конвейер из маленьких команд, а теперь, когда вы знаете, что такое процесс и ядро, можно посмотреть, как он устроен изнутри. Схема ниже показывает конвейер `grep \' 500 \' access.log | cut -d\' \' -f1 | sort | uniq -c`. Вверху стоят четыре процесса, по одному на каждую команду, слева журнал, который читает grep, справа терминал, куда попадает результат, а внизу, в полосе ядра, три трубы, то есть буферы в памяти ядра, через которые процессы передают друг другу строки. Под схемой счётчики показывают, сколько строк в журнале, сколько из них прошло через grep, сколько разных адресов нашлось и сколько строк напечатала uniq.', 'In the streams lesson you built a pipeline out of small commands, and now that you know what a process and the kernel are, you can see how it works inside. The diagram below shows the pipeline `grep \' 500 \' access.log | cut -d\' \' -f1 | sort | uniq -c`. At the top are four processes, one per command, on the left the log grep reads, on the right the terminal where the result lands, and at the bottom, in the kernel strip, three pipes, the kernel memory buffers through which the processes pass lines to each other. Under the diagram the counters show how many lines the log has, how many passed grep, how many distinct addresses were found and how many lines uniq printed.'),
    },
    { id: 'pipe-look', kind: 'explainer', step: 'review', explainer: 'linux.pipe', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен процесс, который сейчас обрабатывает строки, облачко рядом с ним говорит, что он с ними делает, а карточка на линии показывает, сколько строк уходит дальше. Шкала внутри каждой трубы показывает, насколько заполнен буфер, а бледный процесс уже завершился.\n\nКогда дойдёте до экрана, выключите в группе «Какие команды стоят в конвейере» переключатель «Перед uniq стоит команда sort» и сравните, сколько строк напечатает uniq. Потом поставьте в группе «Какой журнал читает конвейер» долю ошибок на ноль. Напоследок включите в блоке «Сломать» поломку, при которой последняя команда читает одну строку и завершается.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The process handling lines now is highlighted, the callout next to it says what it does with them, and the card on the line shows how many lines go on. The gauge inside each pipe shows how full the buffer is, and a pale process has already finished.\n\nOnce you reach the screen, switch off “sort comes before uniq” in “Which commands the pipeline has” and compare how many lines uniq prints. Then set the share of errors to zero in “Which log the pipeline reads”. Finally, switch on the break in “Break it” where the last command reads one line and exits.'), caption: bi('Схема объясняет два правила, которые иначе пришлось бы заучивать без объяснений. Перед `uniq` почти всегда ставят `sort`, потому что `uniq` склеивает только соседние строки. А код 141 у команды посреди конвейера означает не сбой, а сигнал SIGPIPE, который ядро послало ей, когда следующая команда перестала читать. В задании ниже вы найдёте процесс, который нагружает машину, и остановите его сигналом.', 'The diagram explains two rules you would otherwise have to memorise. `sort` almost always comes before `uniq`, because `uniq` merges only adjacent lines. And code 141 from a command in the middle of a pipeline means not a failure but SIGPIPE, which the kernel sent it when the next command stopped reading. In the task below you will find a process that loads the machine and stop it with a signal.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: procSetup,
      tasks: [
        {
          id: 'burner',
          prompt: bi('Какая-то программа сильно нагружает процессор. Найдите её и остановите вежливо, то есть сигналом TERM.', 'Some program is loading the CPU heavily. Find it and stop it politely, that is, with TERM.'),
          check: { when: "!procs[cmd=burner]", fail: [{ if: "procs[cmd=burner] && term['main'][last].line~'kill'", say: bi('Процесс всё ещё работает, а значит, номер оказался не тот или сигнал не дошёл. Возьмите PID из вывода `top` или команды `pgrep burner`.', 'The process is still running: either the number was wrong or the signal did not arrive. Take the PID from `top` or from `pgrep burner`.') }] },
          chips: 'top',
          docRef: ref('man/top.1', 'DESCRIPTION'),
          hints: { H1: bi('Команда `top` сортирует процессы по нагрузке на процессор.', '`top` sorts processes by CPU load.'), H2: bi('Передайте номер из колонки PID команде `kill`. Без флага `kill` посылает как раз сигнал TERM.', 'Pass the number from the PID column to `kill`. With no flag, `kill` sends TERM.') },
        },
        {
          id: 'sigdemo',
          prompt: bi('Программа `sigdemo` перехватывает сигнал TERM и не завершается. Всё равно остановите её.', 'The `sigdemo` program catches TERM and does not exit. Stop it anyway.'),
          check: { when: "!procs[cmd=sigdemo]", fail: [{ if: "procs[cmd=sigdemo]", say: bi('Сигнал, который процесс перехватывает, его не остановит. Нужен сигнал, который перехватить нельзя.', 'A signal the process catches will not stop it. You need one that cannot be caught.') }] },
          chips: 'pkill -KILL sigdemo',
          docRef: { url: 'https://man7.org/linux/man-pages/man7/signal.7.html', label: 'signal(7) · Standard signals' },
          hints: { H1: bi('Посмотрите, что `sigdemo` пишет в файл `/tmp/sigdemo.log` после команды `kill`.', 'Look at what `sigdemo` writes to `/tmp/sigdemo.log` after `kill`.'), H2: bi('Сигнал KILL перехватить нельзя, и послать его можно командой `kill -9 PID` или `pkill -KILL sigdemo`.', 'KILL cannot be caught, and you can send it with `kill -9 PID` or `pkill -KILL sigdemo`.') },
        },
        {
          id: 'exit',
          prompt: bi('Выясните, с каким кодом завершается команда `ls /nosuch`, и выведите только это число.', 'Find out the exit code of `ls /nosuch` and print only that number.'),
          check: { stdout: /(^|\n)2\n$/ },
          chips: 'ls /nosuch; echo $?',
          hints: { H1: bi('Код завершения последней команды хранится в переменной `$?`.', 'The code of the last command is in `$?`.') },
        },
      ],
    },
    {
      id: 'mem',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Сохраните в файл `~/mem.txt` список процессов машины, отсортированный по занятой памяти так, чтобы самые большие процессы стояли первыми. В списке должны быть только колонки pid, rss и comm. Как это сделать, написано на странице `ps(1)`.', 'Save into `~/mem.txt` the list of the machine’s processes sorted by memory so that the biggest come first. The list must have only the columns pid, rss and comm. How to do it is written on the page `ps(1)`.'),
      ref: ref('man/ps.1'),
      terminal: {
        setup: {},
        task: {
          id: 'mem',
          prompt: bi('Запишите в файл `~/mem.txt` колонки pid, rss и comm, отсортированные по убыванию памяти.', 'Write into `~/mem.txt` the columns pid, rss and comm, sorted by decreasing memory.'),
          check: { when: memOk },
          docStep: 3,
          docRef: ref('man/ps.1', 'STANDARD FORMAT SPECIFIERS'),
          chips: 'ps',
          hints: {
            H1: bi('Поищите на странице, как задать собственный набор колонок и как отсортировать по одной из них.', 'Look in the page for how to choose your own set of columns and how to sort by one of them.'),
            H2: bi('Понадобятся два флага. Флаг `-e` вместе с флагом `-o` и списком имён колонок через запятую выводит все процессы только с этими колонками, а флаг `--sort` упорядочивает строки по колонке, и знак минус перед её именем ставит самые большие значения первыми. Имена колонок перечислены в разделе STANDARD FORMAT SPECIFIERS.', 'You need two flags. `-e` with `-o` and a comma-separated list of column names prints every process with only those columns, and `--sort` orders the lines by a column, with a minus before its name putting the biggest values first. The column names are listed in STANDARD FORMAT SPECIFIERS.'),
          },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.signals', 'linux.q.zombie', 'linux.q.fork-order', 'linux.q.exit-128', 'linux.q.pipe-label'] },
  ],
};

// ── 10. Bash scripts ──

const scriptOk = (f: Facts) => {
  const s = f.files['/home/learner/bin/backup.sh'];
  return !!s && /x/.test(String((s as { perm?: { u: string } }).perm?.u ?? '')) && /^#!\s*\/(usr\/)?bin\/(env )?(ba)?sh/.test(text(f, '/home/learner/bin/backup.sh')) && /\$1|\$\{1\}|"\$@"/.test(text(f, '/home/learner/bin/backup.sh')) && f.files['/home/learner/backups/site.tar.gz']?.type === 'f';
};

const scripts: Lesson = {
  id: 'linux.scripts',
  block: 'linux',
  title: bi('Скрипты на bash', 'Bash scripts'),
  summary: bi('Если каждое утро вы набираете одни и те же пять команд, их пора записать в скрипт. В этом уроке вы узнаете, как скрипт получает аргументы, как в нём записывают условия и циклы, как он сообщает код завершения и как включить режим, в котором скрипт не скрывает ошибки.', 'If you type the same five commands every morning, it is time to write them into a script. In this lesson you learn how a script gets arguments, how conditions and loops are written in it, how it reports an exit code and how to turn on the mode in which a script does not hide errors.'),
  introduces: ['linux.script', 'linux.shebang'],
  uses: ['linux.exit-code', 'linux.mode', 'linux.path-var', 'linux.archive'],
  tier: 'core',
  minutes: 45,
  sources: sources([BASH_MANUAL, man7('bash', 1), { title: 'ShellCheck wiki', url: 'https://www.shellcheck.net/wiki/' }], [wiki('Shebang', 'Shebang_(Unix)'), wiki('Bash', 'Bash'), opennet('bash', 1)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Каждое утро вы упаковываете сайт в архив, кладёте архив в каталог с резервными копиями и проверяете, что всё получилось. Это пять команд каждый день, и однажды вы ошибётесь в одной из них. Поэтому команды пора записать в файл и запускать его.', 'Every morning you pack the site into an archive, put the archive into the backups directory and check that it worked. That is five commands every day, and one day you will get one of them wrong. So it is time to write the commands into a file and run that file.'),
    },
    {
      id: 'script',
      kind: 'text',
      step: 'explain',
      title: bi('Как устроен скрипт', 'How a script is built'),
      body: bi(
        '[[linux.script|Скриптом]] называют текстовый файл с командами оболочки, которые выполняются по очереди. Первая строка скрипта, которая называется [[linux.shebang|shebang]], выглядит как `#!/bin/bash` и сообщает ядру, какой программой выполнить файл, когда его запускают как программу. Дальше идут обычные команды, а строки, которые начинаются с `#`, служат комментариями.\n\n```bash\n#!/bin/bash\n# backup.sh: pack a directory into ~/backups\nset -euo pipefail\n\nif [ $# -ne 1 ]; then\n  echo "usage: backup.sh DIR" >&2\n  exit 1\nfi\n\nname=$(basename "$1")\nmkdir -p ~/backups\ntar -czf ~/backups/"$name".tar.gz -C "$(dirname "$1")" "$name"\necho "saved ~/backups/$name.tar.gz"\n```\n\nПройдём по скрипту сверху вниз:\n\n- строка `#!/bin/bash` говорит, что скрипт выполняет bash, а строка с `#` после неё служит комментарием для людей;\n- строка `set -euo pipefail` велит остановить скрипт при первой же ошибке, о ней рассказывает следующий раздел;\n- блок от `if` до `fi` проверяет, что скрипту передали ровно один аргумент, и если это не так, печатает подсказку в поток ошибок и завершает скрипт с кодом 1;\n- строка `name=$(basename "$1")` берёт из пути, например `/home/learner/site`, только последнее имя, `site`;\n- `mkdir -p ~/backups` создаёт каталог для архивов, если его ещё нет;\n- команда `tar` упаковывает каталог в архив с этим именем, а `echo` сообщает, куда архив положен.\n\nЧтобы файл можно было запустить как программу, ему нужен бит `x`, который ставит команда `chmod u+x backup.sh`. Запускают такой файл по пути, например `./backup.sh ~/site`, или кладут его в каталог из PATH. Команда `bash backup.sh ~/site` сработает и без бита `x`, потому что в ней запускается программа `bash`, а файл служит её аргументом.\n\nАргументы скрипта доступны как `$1`, `$2` и так далее. Переменная `$#` хранит их количество, а `"$@"` подставляет все аргументы, каждый отдельным словом. Запись `$(команда)` подставляет вывод команды, например `name=$(basename "$1")`. Кавычки вокруг `"$1"` нужны всегда, потому что без них путь с пробелом распадётся на два аргумента.',
        'A [[linux.script|script]] is a text file with shell commands that run in order. Its first line, called the [[linux.shebang|shebang]], looks like `#!/bin/bash` and tells the kernel which program runs the file when it is started as a program. Then come ordinary commands, and lines that start with `#` are comments.\n\n```bash\n#!/bin/bash\n# backup.sh: pack a directory into ~/backups\nset -euo pipefail\n\nif [ $# -ne 1 ]; then\n  echo "usage: backup.sh DIR" >&2\n  exit 1\nfi\n\nname=$(basename "$1")\nmkdir -p ~/backups\ntar -czf ~/backups/"$name".tar.gz -C "$(dirname "$1")" "$name"\necho "saved ~/backups/$name.tar.gz"\n```\n\nLet us walk through the script from top to bottom:\n\n- the line `#!/bin/bash` says bash runs the script, and the `#` line after it is a comment for people;\n- `set -euo pipefail` tells the script to stop at the very first error, and the next section explains it;\n- the block from `if` to `fi` checks that the script got exactly one argument, and if not, prints a hint into the error stream and ends the script with code 1;\n- `name=$(basename "$1")` takes only the last name from a path, for example `site` from `/home/learner/site`;\n- `mkdir -p ~/backups` creates the directory for archives if it does not exist yet;\n- `tar` packs the directory into an archive with that name, and `echo` reports where the archive went.\n\nTo run the file as a program it needs the `x` bit, set by `chmod u+x backup.sh`. Such a file is started by its path, for example `./backup.sh ~/site`, or put into a directory on PATH. `bash backup.sh ~/site` works even without the `x` bit, because the program started there is `bash` and the file is its argument.\n\nThe script’s arguments are available as `$1`, `$2` and so on. `$#` holds how many there are, and `"$@"` gives all of them, each as a separate word. `$(command)` substitutes a command’s output, for example `name=$(basename "$1")`. Quotes around `"$1"` are always needed, because without them a path with a space falls apart into two arguments.',
      ),
    },
    {
      id: 'logic',
      kind: 'text',
      step: 'explain',
      title: bi('Условия, циклы и обработка ошибок', 'Conditions, loops and error handling'),
      body: bi(
        'Условием в bash служит код завершения команды. Конструкция `if команда; then … fi` выполняет ветку, если команда вернула 0. Чаще всего в роли команды выступает `[ ]`, то же самое, что `test`. Проверка `[ -f file ]` истинна, если файл существует, `[ -d dir ]` истинна, если существует каталог, `[ "$a" = "$b" ]` истинна, если строки равны, а `[ $n -gt 5 ]` истинна, если число больше пяти. Пробелы внутри скобок обязательны, потому что `[` сама работает как команда, а `]` служит её последним аргументом. Есть и короткие формы: `команда && другая` выполняет вторую команду, если первая завершилась успешно, а `команда || другая` выполняет вторую, если первая не удалась.\n\nЦикл `for f in *.log; do gzip "$f"; done` проходит по списку имён, а цикл `while read line; do …; done < file` проходит по строкам файла.\n\nПо умолчанию скрипт, в котором одна из команд завершилась ошибкой, спокойно выполняется дальше, и следующая команда работает уже с испорченными данными. Поэтому в серьёзных скриптах сразу после shebang пишут строку `set -euo pipefail`. Флаг `-e` останавливает скрипт на первой ошибке, флаг `-u` считает ошибкой обращение к незаданной переменной, например опечатку в её имени, а `pipefail` считает ошибкой сбой любой команды конвейера, а не только последней. Команда `exit N` завершает скрипт с нужным кодом, и так скрипт сообщает тому, кто его запустил, удалась ли его работа.',
        'A condition in bash is the exit code of a command. `if command; then … fi` runs the branch if the command returned 0. Most often the command is `[ ]`, the same as `test`. `[ -f file ]` is true if the file exists, `[ -d dir ]` if the directory exists, `[ "$a" = "$b" ]` if the strings are equal, and `[ $n -gt 5 ]` if the number is greater than five. The spaces inside the brackets are required, because `[` is itself a command and `]` is its last argument. There are short forms too: `command && other` runs the second command if the first succeeded, and `command || other` runs it if the first failed.\n\nThe loop `for f in *.log; do gzip "$f"; done` goes through a list of names, and `while read line; do …; done < file` goes through the lines of a file.\n\nBy default a script in which a command failed calmly goes on, and the next command works with spoiled data. So serious scripts put `set -euo pipefail` right after the shebang. `-e` stops the script at the first error, `-u` treats a reference to an unset variable, such as a typo in its name, as an error, and `pipefail` treats the failure of any command in a pipeline as an error, not just of the last one. `exit N` ends the script with the code you choose, and that is how a script tells whoever started it whether its work succeeded.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { files: [{ path: '~/site/index.html', content: '<h1>Edu Cafe</h1>\n' }, { path: '~/site/menu.html', content: '<h1>Menu</h1>\n' }, { path: '~/bin', type: 'd' }], env: { PATH: '/home/learner/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' } },
      intro: bi("Файл удобно написать командой `cat > файл <<'EOF'`, после которой вы набираете строки файла и заканчиваете строкой `EOF`. Все строки между ними попадут в файл в том виде, в каком вы их набрали.", "A file is easy to write with `cat > file <<'EOF'`: after it you type the lines of the file and finish with a line `EOF`. All lines between them go into the file exactly as you typed them."),
      tasks: [
        {
          id: 'backup',
          prompt: bi('Напишите скрипт `~/bin/backup.sh`, который упаковывает каталог, указанный первым аргументом, в архив `~/backups/<имя каталога>.tar.gz`. Затем сохраните этим скриптом каталог `~/site`. Скрипт должен запускаться по имени `backup.sh`.', 'Write a script `~/bin/backup.sh` that packs the directory given as its first argument into the archive `~/backups/<directory name>.tar.gz`. Then back up `~/site` with it. The script must run by its name, `backup.sh`.'),
          check: {
            when: scriptOk,
            fail: [
              { if: (f) => !!f.files['/home/learner/bin/backup.sh'] && !/x/.test(String((f.files['/home/learner/bin/backup.sh'] as { perm?: { u: string } }).perm?.u ?? '')), say: bi('У файла нет бита x, поэтому запустить его как программу нельзя. Поставьте бит командой `chmod u+x ~/bin/backup.sh`.', 'The file has no x bit, so it cannot run as a program. Set the bit with `chmod u+x ~/bin/backup.sh`.') },
              { if: (f) => !!f.files['/home/learner/bin/backup.sh'] && !/^#!/.test(text(f, '/home/learner/bin/backup.sh')), say: bi('Первая строка скрипта должна сообщать, какой программой его выполнять, и для bash она выглядит так: `#!/bin/bash`.', 'The first line of the script must say which program runs it, and for bash it reads `#!/bin/bash`.') },
            ],
          },
          chips: "cat > ~/bin/backup.sh <<'EOF'",
          hints: {
            H1: bi('В скрипте должно быть три части: строка shebang, проверка аргумента и команда `tar`.', 'The script needs three parts: the shebang line, a check of the argument and the `tar` command.'),
            H2: bi('Возьмите за основу скрипт из текста урока и не забудьте поставить ему бит x командой `chmod u+x`.', 'Start from the script in the lesson text and do not forget to set its x bit with `chmod u+x`.'),
            H3: bi('Выполните `chmod u+x ~/bin/backup.sh`, а затем `backup.sh ~/site`.', 'Run `chmod u+x ~/bin/backup.sh`, then `backup.sh ~/site`.'),
          },
        },
        {
          id: 'usage',
          prompt: bi('Запустите `backup.sh` без аргументов. Скрипт должен завершиться с кодом 1 и объяснить, как им пользоваться.', 'Run `backup.sh` with no arguments. The script must exit with code 1 and explain how to use it.'),
          check: {
            when: "term['main'][last].exit=1",
            stdout: /usage/i,
            fail: [{ if: "term['main'][last].line~'backup.sh;' && term['main'][last].out~'usage'", say: bi('Скрипт напечатал подсказку, но проверка смотрит на код завершения всей строки, а он равен коду последней команды в ней, то есть `echo`. Запустите `backup.sh` отдельной строкой, а его код посмотрите следующей командой `echo $?`.', 'The script printed the hint, but the check looks at the exit code of the whole line, and that is the code of its last command, `echo`. Run `backup.sh` on a line of its own and look at its code with the next command, `echo $?`.') }],
          },
          chips: 'backup.sh',
          hints: { H1: bi('Число аргументов хранится в переменной `$#`, а завершить скрипт с кодом 1 можно командой `exit 1`.', 'The number of arguments is in `$#`, and `exit 1` ends the script with code 1.') },
        },
      ],
    },
    {
      id: 'xtrace',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Сделайте так, чтобы скрипт `~/bin/backup.sh` при каждом запуске печатал каждую команду перед тем, как её выполнить. В уроке об этом не рассказывалось, но искать по огромной странице `bash(1)` не нужно: режимы оболочки включает встроенная команда `set`, и её короткую справку показывает `help set`. Найдите там нужный режим и допишите его включение в скрипт.', 'Make `~/bin/backup.sh` print every command before running it, on every run. The lesson did not cover this, but you need not search the huge `bash(1)` page: the shell’s modes are turned on by the builtin `set`, and `help set` shows its short reference. Find the right mode there and add the line that turns it on to the script.'),
      ref: ref('help/set'),
      terminal: {
        setup: { files: [{ path: '~/bin/backup.sh', content: '#!/bin/bash\nname=$(basename "$1")\nmkdir -p ~/backups\ntar -czf ~/backups/"$name".tar.gz -C "$(dirname "$1")" "$name"\n', mode: '0755' }, { path: '~/site/index.html', content: 'x\n' }] },
        task: {
          id: 'xtrace',
          prompt: bi('Скрипт печатает каждую команду, которую выполняет.', 'The script prints every command it runs.'),
          check: { when: (f) => /^\s*set\s+-[a-z]*x|set\s+-o\s+xtrace|^#!.*bash\s+-[a-z]*x/m.test(text(f, '/home/learner/bin/backup.sh')) },
          docStep: 4,
          beyond: true,
          solutionTokens: ['set -x', 'xtrace', '-x', 'bash -x'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.args', 'linux.q.test-spaces', 'linux.q.script-bug', 'linux.q.pipefail'] },
  ],
};

// ── 11. Packages ──

const pkgFilesOk = (f: Facts) => /\/usr\/bin\/jq/.test(text(f, '/home/learner/jq-files.txt'));

const packages: Lesson = {
  id: 'linux.packages',
  block: 'linux',
  title: bi('Как устанавливать программы из пакетов', 'How to install programs from packages'),
  summary: bi('Программы устанавливают не скачиванием файлов вручную, а менеджером пакетов. Он знает, какие ещё программы нужны для работы, и помнит, какой файл из какого пакета появился на машине.', 'Programs are installed not by downloading files by hand but with a package manager. It knows which other programs are needed and remembers which file on the machine came from which package.'),
  introduces: ['linux.package', 'linux.repo'],
  uses: ['linux.sudo', 'linux.redirect', 'linux.man-page'],
  tier: 'core',
  minutes: 25,
  sources: sources([{ title: 'apt(8) — Debian manpages', url: 'https://manpages.debian.org/trixie/apt/apt.8.en.html' }, { title: 'dpkg(1) — Debian manpages', url: 'https://manpages.debian.org/trixie/dpkg/dpkg.1.en.html' }, DEBIAN_HANDBOOK], [wiki('Система управления пакетами', '%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0_%D1%83%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F_%D0%BF%D0%B0%D0%BA%D0%B5%D1%82%D0%B0%D0%BC%D0%B8'), wiki('APT', 'APT'), DEBIAN_HANDBOOK_RU]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Вас просят поставить на сервер программу jq. Скачивать файл с сайта и класть его в `/usr/bin` для этого не нужно и даже опасно: потом никто не вспомнит, откуда этот файл взялся, какой он версии и что ему нужно для работы. В этом уроке вы узнаете, как устанавливают программы на сервере правильно.', 'You are asked to install jq on the server. Downloading a file from a website and putting it into `/usr/bin` is not needed and even dangerous: later nobody will remember where the file came from, which version it is and what it needs to work. In this lesson you learn the right way to install programs on a server.'),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое пакеты и репозитории', 'What packages and repositories are'),
      body: bi(
        '[[linux.package|Пакетом]] называют архив программы вместе с описанием. В описании указаны имя, версия, какие файлы куда положить и какие ещё пакеты нужны для работы; эти пакеты называют зависимостями. Менеджер пакетов устанавливает программу вместе со всеми зависимостями и записывает, какие файлы он установил. В Debian и Ubuntu менеджером служит `apt`, который работает поверх `dpkg`, в семействе Red Hat это `dnf`, а в Alpine это `apk`. Устроены они по-разному, но идея у всех одна.\n\nПакеты хранятся на серверах, которые называют [[linux.repo|репозиториями пакетов]], а их адреса перечислены в файле `/etc/apt/sources.list`. Установка проходит в два шага:\n\n```\nsudo apt update          # скачать свежий список пакетов\nsudo apt install jq      # поставить пакет и его зависимости\n```\n\nПока вы не выполнили `apt update`, машина не знает, какие пакеты существуют, и на просьбу установить пакет отвечает `Unable to locate package`, то есть «не удаётся найти пакет». Команда `apt show jq` описывает пакет, `apt search слово` ищет пакеты по слову, `apt remove` удаляет пакет, но оставляет его настройки в `/etc`, а `apt purge` удаляет пакет вместе с настройками.\n\nПрограмма `dpkg` помнит каждый установленный файл. Команда `dpkg -L jq` перечисляет файлы, которые поставил пакет, а `dpkg -S /usr/bin/tree` сообщает, какому пакету принадлежит файл. Это первое, что стоит спросить у системы, когда на сервере нашёлся непонятный файл.\n\nЕсли пакет содержит службу, то есть программу, которая работает в фоне, Debian запускает её сразу после установки. О службах подробно рассказывает урок после следующего.',
        'A [[linux.package|package]] is an archive of a program together with a description. The description gives the name, the version, which files go where and which other packages it needs to work; those packages are called dependencies. The package manager installs the program with all its dependencies and records exactly what it installed. On Debian and Ubuntu the manager is `apt`, which works on top of `dpkg`, in the Red Hat family it is `dnf`, and on Alpine it is `apk`. They are built differently, but the idea is the same.\n\nPackages are kept on servers called [[linux.repo|package repositories]], whose addresses are listed in `/etc/apt/sources.list`. Installation takes two steps:\n\n```\nsudo apt update          # download a fresh list of packages\nsudo apt install jq      # install the package and its dependencies\n```\n\nUntil you run `apt update`, the machine does not know which packages exist, and to a request to install one it answers `Unable to locate package`. `apt show jq` describes a package, `apt search word` searches packages by a word, `apt remove` removes a package but leaves its settings in `/etc`, and `apt purge` removes the package with its settings.\n\n`dpkg` remembers every installed file. `dpkg -L jq` lists the files a package installed, and `dpkg -S /usr/bin/tree` tells which package a file belongs to. That is the first thing to ask the system when you find an unclear file on a server.\n\nIf a package contains a service, a program that runs in the background, Debian starts it right after installation. Services are covered in detail in the lesson after next.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { files: [{ path: '~/orders.json', content: '{"items":[{"name":"espresso","price":2.5},{"name":"latte","price":3.2},{"name":"tea","price":1.8}]}\n' }] },
      tasks: [
        {
          id: 'install',
          prompt: bi('Установите пакет `jq`.', 'Install the `jq` package.'),
          check: { when: "files['/usr/bin/jq'].type=f", fail: [{ if: "term['main'][last].out~'Unable to locate'", say: bi('Машина не знает такого пакета, потому что у неё ещё нет списка пакетов. Сначала скачайте этот список командой `apt update`.', 'The machine does not know the package because it has no package list yet. Download the list first with `apt update`.') }] },
          chips: 'sudo apt update && sudo apt install jq',
          docRef: { url: 'https://manpages.debian.org/trixie/apt/apt.8.en.html', label: 'apt(8)' },
          hints: { H1: bi('Установка проходит в два шага: сначала нужно скачать список пакетов, а потом установить пакет.', 'Installation takes two steps: first download the package list, then install the package.') },
        },
        {
          id: 'names',
          prompt: bi('В файле `~/orders.json` лежит заказ в формате JSON, то есть в виде текста, где у каждого значения есть имя: в списке `items` перечислены позиции заказа, и у каждой есть поле `name` с названием. Программа `jq` умеет доставать из такого текста нужные поля. Выведите названия всех позиций заказа, по одному названию в строке и без кавычек.', 'The file `~/orders.json` holds an order in JSON, text in which every value has a name: the list `items` holds the order items, and each has a `name` field with its title. The `jq` program can pull the fields you need out of such text. Print the names of all order items, one name per line and without quotes.'),
          check: { stdout: /^espresso\nlatte\ntea\n$/ },
          chips: "jq -r '.items[].name' ~/orders.json",
          docRef: { url: 'https://jqlang.org/manual/', label: 'jq manual' },
          hints: { H1: bi('Запись `.items[]` перебирает каждый элемент массива, `.name` берёт из элемента поле с названием, а флаг `-r` убирает кавычки.', '`.items[]` goes through every element of the array, `.name` takes the name field of an element, and the `-r` flag removes the quotes.') },
        },
      ],
    },
    {
      id: 'files',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Запишите в файл `~/jq-files.txt` список файлов, которые поставил пакет `jq`. Как это сделать, написано на странице `dpkg(1)`.', 'Write into `~/jq-files.txt` the list of files the `jq` package installed. How to do it is written on the page `dpkg(1)`.'),
      ref: ref('man/dpkg.1'),
      terminal: {
        setup: { ext: { linux: { packages: ['jq'] } } },
        task: { id: 'jq-files', prompt: bi('Запишите в файл `~/jq-files.txt` список файлов пакета jq.', 'Write the list of the jq package’s files into `~/jq-files.txt`.'), check: { when: pkgFilesOk }, docStep: 3, chips: 'dpkg', hints: { H1: bi('Поищите в разделе OPTIONS действие, которое перечисляет файлы пакета.', 'Look in OPTIONS for the action that lists a package’s files.') } },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.apt-update', 'linux.q.dpkg-S'] },
  ],
};

// ── 12. Services, logs and schedules ──

const REPORT_SCRIPT = '#!/bin/bash\n# report: renders the nightly sales report\nif [ ! -f /etc/report.conf ]; then\n  echo "report: cannot open /etc/report.conf: No such file or directory" >&2\n  exit 1\nfi\necho "report: config loaded, waiting for orders"\nexec sleep infinity\n';
const REPORT_UNIT = '[Unit]\nDescription=Nightly sales report\n\n[Service]\nExecStart=/usr/local/bin/report\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n';

const servicesSetup: TerminalSetup = {
  files: [
    { path: '/usr/local/bin/report', content: REPORT_SCRIPT, owner: 'root', mode: '0755' },
    { path: '/usr/local/bin/web-demo', content: '#!/usr/bin/sim\n# web-demo: the lab web server\n', owner: 'root', mode: '0755' },
    { path: '/etc/systemd/system/report.service', content: REPORT_UNIT, owner: 'root' },
    { path: '~/bin/backup.sh', content: '#!/bin/bash\ntar -czf ~/backups/site-$(date +%F).tar.gz -C ~ site\n', mode: '0755' },
  ],
  script: ['systemctl enable report', 'systemctl start report'],
};

const units = (f: Facts) => (f.units ?? {}) as Record<string, { active: string; enabled: string; stale: boolean; restarts: number; props: Record<string, string> }>;

const services: Lesson = {
  id: 'linux.services',
  block: 'linux',
  title: bi('Службы, журналы и запуск по расписанию', 'Services, logs and scheduled jobs'),
  summary: bi('Программа systemd запускает службы, следит за ними и перезапускает их после сбоя. В этом уроке вы узнаете, как устроен unit-файл, чем команда start отличается от enable, как найти в журнале причину сбоя службы и как запускать задачи по расписанию с помощью cron.', 'systemd starts services, watches them and restarts them after a failure. In this lesson you learn how a unit file is built, how start differs from enable, how to find in the journal why a service failed, and how to run jobs on a schedule with cron.'),
  introduces: ['linux.daemon', 'linux.systemd', 'linux.unit', 'linux.journal', 'linux.cron'],
  uses: ['linux.process', 'linux.signal', 'linux.exit-code', 'linux.sudo', 'linux.script'],
  tier: 'core',
  minutes: 50,
  sources: sources([SYSTEMD_MAN('systemd.service'), SYSTEMD_MAN('systemd.unit'), SYSTEMD_MAN('journalctl'), man7('crontab', 5)], [wiki('systemd', 'Systemd'), arch('systemd (Русский)', 'Systemd_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)'), wiki('cron', 'Cron')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Утром коллега сообщает: «После перезагрузки сайт не запустился». Вчера программу сайта запускали вручную, и всё работало. Чтобы понять, что случилось, нужно знать, кто запускает программы, когда машина включается, и куда они пишут сообщения, когда ночью завершаются с ошибкой.', 'In the morning a colleague reports: “After the reboot the site did not start.” Yesterday the site’s program was started by hand and everything worked. To understand what happened, you need to know who starts programs when the machine powers on, and where they write their messages when they fail at night.'),
    },
    {
      id: 'systemd',
      kind: 'text',
      step: 'explain',
      title: bi('Кто запускает службы', 'Who starts the services'),
      body: bi(
        '[[linux.daemon|Службой]], или демоном, называют программу, которая работает в фоне без терминала, например веб-сервер, базу данных или cron. Запускать такие программы вручную после каждой загрузки было бы неразумно, и эту работу выполняет [[linux.systemd|systemd]]. Программа systemd работает самым первым процессом системы, у которого номер PID 1. Ядро запускает его сразу после загрузки, а дальше systemd запускает все остальные службы, следит за ними и перезапускает те, которые завершились аварийно.\n\nКакие программы и как запускать, systemd узнаёт из [[linux.unit|unit-файлов]]. Свои unit-файлы кладут в каталог `/etc/systemd/system/`, а файлы из пакетов лежат в `/usr/lib/systemd/system/`:\n\n```ini\n[Unit]\nDescription=Web demo\nAfter=network-online.target\n\n[Service]\nExecStart=/usr/local/bin/web-demo --port 8080\nUser=learner\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n```\n\nВ разделе `[Unit]` записаны описание службы и порядок её запуска. В разделе `[Service]` указано, какую программу запускать (`ExecStart=`, причём путь пишется полностью), от имени какого пользователя (`User=`) и что делать, если программа завершилась аварийно (`Restart=`). Раздел `[Install]` говорит, к какой цели загрузки подключить службу.',
        'A [[linux.daemon|service]], or daemon, is a program that runs in the background without a terminal, such as a web server, a database or cron. Starting such programs by hand after every boot would be unreasonable, and [[linux.systemd|systemd]] does this work. It is the very first process of the system, PID 1. The kernel starts it right after booting, and from then on systemd starts all the other services, watches them and restarts those that fail.\n\nWhich programs to start and how, systemd learns from [[linux.unit|unit files]]. Your own unit files go into `/etc/systemd/system/`, and those from packages are in `/usr/lib/systemd/system/`:\n\n```ini\n[Unit]\nDescription=Web demo\nAfter=network-online.target\n\n[Service]\nExecStart=/usr/local/bin/web-demo --port 8080\nUser=learner\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n```\n\nThe `[Unit]` section holds the description and the start order. The `[Service]` section says which program to run (`ExecStart=`, with the full path), as which user (`User=`) and what to do if the program fails (`Restart=`). The `[Install]` section says which boot target to attach the service to.',
      ),
    },
    {
      id: 'boot-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как машина загружается до приглашения оболочки', 'How a machine boots up to the shell prompt'),
      body: bi('Теперь, когда вы знаете, что systemd запускает службы, можно проследить всю загрузку машины целиком, от нажатия кнопки питания до приглашения оболочки. Схема ниже показывает эту цепочку. В верхнем ряду по очереди работают четыре участника. Первой получает управление прошивка, то есть программа, которая записана в саму плату компьютера. Она передаёт управление загрузчику, маленькой программе на диске, которая находит и запускает ядро. Ядро запускает systemd, а systemd проходит две цели загрузки: local-fs.target означает, что диски подключены, а multi-user.target означает обычную работу сервера. Какие диски подключать при загрузке, systemd узнаёт из файла `/etc/fstab`, списка дисков и каталогов, куда их подключить. Подробно этот файл разбирает урок о дисках, а здесь достаточно знать, что ошибка в нём останавливает загрузку. Во втором ряду стоят три службы, которые запускает systemd, в третьем ряду программа входа и ваша оболочка, а внизу ядро. Под схемой счётчики показывают, сколько служб запущено и сколько секунд прошло с момента запуска systemd.', 'Now that you know systemd starts services, you can follow the whole boot of a machine, from pressing the power button to the shell prompt. The diagram below shows this chain. In the top row work in turn the firmware, the program written into the computer’s board itself that gets control first at power-on, then the boot loader, a small program on the disk that finds and starts the kernel, then systemd and two boot targets: local-fs.target, which means the disks are attached, and multi-user.target, which means the ordinary work of a server. Which disks to attach at boot systemd learns from `/etc/fstab`, a list of disks and the directories to attach them to. The disks lesson covers this file in detail, and here it is enough to know that a mistake in it stops the boot. The second row holds three services systemd starts, the third row the login program and your shell, and at the bottom is the kernel. Under the diagram the counters show how many services have started and how many seconds have passed since systemd started.'),
    },
    { id: 'boot', kind: 'explainer', step: 'look', explainer: 'linux.boot', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен тот участник загрузки, который работает сейчас, облачко рядом говорит, что он делает, а карточка на линии показывает, что он передаёт следующему. Новые блоки появляются по мере того, как до них доходит управление, а пунктирная рамка отмечает службу, которая ещё запускается.\n\nКогда дойдёте до оболочки, выберите в группе «Как загружается машина» режим восстановления rescue.target и посмотрите, какие службы не запустятся. Потом в группе «Как запускаются службы» увеличьте время запуска slow.service и проследите, чью готовность это задержит. Напоследок включите в блоке «Сломать» поломку с неверным UUID в /etc/fstab.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The participant of the boot working now is highlighted, the callout next to it says what it does, and the card on the line shows what it hands on. New blocks appear as control reaches them, and a dashed outline marks a service that is still starting.\n\nOnce you reach the shell, choose rescue.target in “How the machine boots” and see which services do not start. Then in “How the services start” increase the start time of slow.service and see whose readiness it delays. Finally, switch on the break in “Break it” with a wrong UUID in /etc/fstab.'), caption: bi('Сообщения, которые вы видели при поломках, понадобятся, когда настоящий сервер не загрузится. Kernel panic означает, что ядро не нашло первую программу, «You are in emergency mode» означает ошибку в /etc/fstab, а служба в состоянии disabled означает, что её запустили командой start, но не включили командой enable. Эту разницу между start и enable разбирает следующий раздел урока.', 'The messages you saw in the breaks will help when a server really fails to boot. A kernel panic means the kernel did not find the first program, “You are in emergency mode” means a mistake in /etc/fstab, and a service shown as disabled was started with start but not enabled with enable. The next section of the lesson goes through exactly this difference between start and enable.') },
    {
      id: 'not-everywhere',
      kind: 'callout',
      tone: 'note',
      title: bi('systemd установлен не во всех системах', 'Not every system uses systemd'),
      body: bi(
        'Программа systemd работает в Debian, Ubuntu, RHEL и на большинстве серверов, поэтому этот урок посвящён ей. Но systemd не единственная система запуска служб. В конце блока вы будете работать на настоящих машинах с Alpine Linux, где службы запускает другая, более простая система. Задачи у неё те же: запустить службу, включить её запуск при загрузке и перезапустить после сбоя. Меняются только команды и файлы настроек.',
        'systemd runs on Debian, Ubuntu, RHEL and most servers, which is why this lesson is about it. But it is not the only service manager. At the end of the block you will work on real machines with Alpine Linux, where a different, simpler system starts the services. Its jobs are the same: start a service, enable it at boot and restart it after a failure. Only the commands and the settings files change.',
      ),
    },
    {
      id: 'systemctl',
      kind: 'text',
      step: 'explain',
      title: bi('Чем команда start отличается от enable', 'How start differs from enable'),
      body: bi(
        'Службами управляет команда `systemctl`:\n\n- `systemctl start web` запускает службу сейчас, `stop` останавливает её, а `restart` перезапускает;\n- `systemctl enable web` включает запуск службы при загрузке, создавая ссылку в каталоге `multi-user.target.wants/`, `disable` выключает этот запуск, а `enable --now` сразу и включает запуск при загрузке, и запускает службу;\n- `systemctl status web` показывает состояние службы, номер её главного процесса и последние строки журнала;\n- `systemctl daemon-reload` заставляет systemd перечитать unit-файлы после правки, а до этого systemd продолжает работать со старой версией файла и предупреждает об этом;\n- `systemctl reset-failed web` обнуляет счётчик неудачных запусков. Если служба много раз подряд завершилась с ошибкой, systemd перестаёт её перезапускать, пишет в журнал «Start request repeated too quickly», а в `status` показывает `failed (Result: start-limit-hit)`. Тогда даже после того, как вы устранили причину, команда `restart` не поможет, пока вы не выполните `reset-failed`.\n\nТеперь понятно, что случилось с сайтом после перезагрузки: команда `start` без `enable` действует только до следующей перезагрузки.\n\nВсё, что служба пишет в поток вывода и поток ошибок, systemd собирает в [[linux.journal|журнал]], и настраивать для этого ничего не нужно. Команда `journalctl -u web` показывает журнал одной службы. Флаг `-n 20` оставляет последние 20 строк, `-f` показывает новые строки по мере появления, `-p err` оставляет только ошибки, а `-b` показывает записи с последней загрузки. Когда служба завершилась с ошибкой, сначала выполняют `systemctl status`, а затем `journalctl -u`.',
        'Services are managed with `systemctl`:\n\n- `systemctl start web` starts the service now, `stop` stops it and `restart` restarts it;\n- `systemctl enable web` turns on starting at boot by creating a link in `multi-user.target.wants/`, `disable` turns it off, and `enable --now` both turns it on and starts the service;\n- `systemctl status web` shows the state, the number of the main process and the last lines of the journal;\n- `systemctl daemon-reload` makes systemd re-read the unit files after an edit, and until then systemd keeps working with the old version and warns about it;\n- `systemctl reset-failed web` clears the counter of failed starts. If a service failed many times in a row, systemd stops restarting it, writes “Start request repeated too quickly” to the journal and shows `failed (Result: start-limit-hit)` in `status`. Then even after you have removed the cause, `restart` does not help until you run `reset-failed`.\n\nNow it is clear what happened to the site after the reboot: `start` without `enable` lasts only until the next reboot.\n\nEverything a service writes to its output and error streams, systemd collects into the [[linux.journal|journal]], and nothing needs to be configured for that. `journalctl -u web` shows the journal of one service. `-n 20` keeps the last 20 lines, `-f` shows new lines as they appear, `-p err` keeps only errors, and `-b` shows entries since the last boot. When a service has failed, run `systemctl status` first and `journalctl -u` next.',
      ),
    },
    {
      id: 'restart-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как systemd решает, перезапускать ли службу', 'How systemd decides whether to restart a service'),
      body: bi('Служба, которая завершилась с ошибкой ночью, не должна ждать администратора до утра, и для этого в unit-файле есть настройки перезапуска. Схема ниже показывает, как systemd ими пользуется. В верхнем ряду стоят состояния службы при запуске: inactive, activating и active, а справа главный процесс службы. Во втором ряду стоят состояния после сбоя: auto-restart, когда systemd ждёт паузу перед новой попыткой, и failed, когда systemd прекратил попытки, а справа счётчик попыток за последние 10 секунд. Внизу находятся журнал службы и сам systemd. Под схемой счётчики показывают число перезапусков, число запусков за последние 10 секунд и время с начала опыта.', 'A service that fails at night should not wait for an administrator until morning, and the unit file has restart settings for that. The diagram below shows how systemd uses them. The top row holds the start states of the service, inactive, activating and active, with the service’s main process on the right. The second row holds the states after a failure: auto-restart, when systemd waits before a new attempt, and failed, when systemd has stopped trying, with the counter of attempts in the last 10 seconds on the right. At the bottom are the service journal and systemd itself. Under the diagram the counters show the number of restarts, the starts in the last 10 seconds and the time since the experiment began.'),
    },
    { id: 'restart', kind: 'explainer', step: 'look', explainer: 'linux.restart', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечено состояние, в котором служба находится сейчас, а облачко рядом объясняет, что делает systemd. Карточка на линии называет событие, которое переводит службу в новое состояние, а шкала счётчика попыток заполняется с каждым новым запуском.\n\nКогда служба окажется в состоянии failed, поменяйте в группе «Настройки unit-файла» значение Restart= и паузу RestartSec= и проследите, после какой попытки systemd прекратит перезапуски. Потом в группе «Как ведёт себя программа» выберите другую причину завершения или увеличьте время работы программы. Напоследок включите в блоке «Сломать» остановку службы командой systemctl stop.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The state the service is in now is highlighted, and the callout next to it explains what systemd does. The card on the line names the event that moves the service to a new state, and the gauge of the attempt counter fills with every new start.\n\nOnce the service is failed, change Restart= and the RestartSec= pause in “Unit file settings” and see after which attempt systemd stops restarting. Then in “How the program behaves” choose another reason for the end or increase how long the program runs. Finally, switch on the break in “Break it” that stops the service with systemctl stop.'), caption: bi('В первом задании ниже служба `report` завершается с ошибкой и перезапускается. Вспомните, что на схеме происходило со счётчиком попыток, и посмотрите, что о той же службе пишут `systemctl status report` и `journalctl -u report`: строки журнала будут те же, что вы видели в облачках.', 'In the first task below the `report` service fails and restarts. Remember what happened to the attempt counter in the diagram, and look at what `systemctl status report` and `journalctl -u report` say about the same service: the journal lines will be the ones you saw in the callouts.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: servicesSetup,
      tasks: [
        {
          id: 'fix-report',
          prompt: bi('Служба `report` не работает. Выясните по журналу, почему так произошло, устраните причину и добейтесь, чтобы служба перешла в состояние active. Содержимое файла, который вы при этом создадите, значения не имеет.', 'The `report` service is not working. Find out from the journal why, remove the cause and get the service into the active state. The contents of the file you create on the way do not matter.'),
          check: {
            when: (f) => units(f)['report.service']?.active === 'active',
            fail: [{ if: (f) => !!f.files['/etc/report.conf'] && units(f)['report.service']?.active === 'failed', say: bi('Причину вы устранили, но systemd уже прекратил попытки, потому что служба слишком часто завершалась с ошибкой. Сбросьте счётчик неудач командой `systemctl reset-failed report` и запустите службу снова.', 'You removed the cause, but systemd has already stopped trying, because the service failed too often. Reset the failure counter with `systemctl reset-failed report` and start the service again.') }],
          },
          chips: 'systemctl status report; journalctl -u report',
          docRef: ref('man/journalctl.1', 'OPTIONS', '-u, --unit'),
          hints: {
            H1: bi('Сначала выполните `systemctl status report`, а потом посмотрите журнал службы.', 'First run `systemctl status report`, then look at the service’s journal.'),
            H2: bi('В журнале написано, какого файла не хватает службе. Создайте этот файл через sudo.', 'The journal says which file the service is missing. Create that file with sudo.'),
            H3: bi('Выполните `sudo touch /etc/report.conf`, а затем `sudo systemctl reset-failed report && sudo systemctl start report`.', '`sudo touch /etc/report.conf`, then `sudo systemctl reset-failed report && sudo systemctl start report`.'),
          },
        },
        {
          id: 'web',
          prompt: bi('Сделайте из программы `/usr/local/bin/web-demo --port 8080` службу `web`. Служба должна работать от имени пользователя `learner`, перезапускаться после сбоя, работать уже сейчас и запускаться при каждой загрузке.', 'Make a `web` service out of the program `/usr/local/bin/web-demo --port 8080`. It must run as `learner`, restart after a failure, run right now and start at every boot.'),
          check: {
            when: (f) => {
              const u = units(f)['web.service'];
              return !!u && u.active === 'active' && u.enabled === 'enabled' && u.props.User === 'learner' && /on-failure|always/.test(u.props.Restart ?? '') && !u.stale;
            },
            fail: [
              { if: (f) => units(f)['web.service']?.active === 'active' && units(f)['web.service']?.enabled !== 'enabled', say: bi('Служба работает, но после перезагрузки она не запустится, потому что не хватает команды `enable`.', 'The service runs, but after a reboot it will not start, because `enable` is missing.') },
              { if: (f) => !!units(f)['web.service']?.stale, say: bi('Вы изменили файл, а systemd помнит его старую версию. Выполните `sudo systemctl daemon-reload`.', 'You changed the file, but systemd remembers its old version. Run `sudo systemctl daemon-reload`.') },
              { if: (f) => !!units(f)['web.service'] && units(f)['web.service'].props.User !== 'learner', say: bi('Служба работает от имени root. Добавьте строку `User=learner` в раздел `[Service]`.', 'The service runs as root. Add the line `User=learner` to the `[Service]` section.') },
            ],
          },
          chips: "sudo tee /etc/systemd/system/web.service <<'EOF'",
          docRef: { url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html', label: 'systemd.service(5)' },
          hints: {
            H1: bi('Unit-файл из текста урока подходит почти без изменений.', 'The unit file from the lesson text fits almost as it is.'),
            H2: bi('Запишите файл в `/etc/systemd/system/web.service` командой `sudo tee`, а затем выполните `daemon-reload` и `enable --now`.', 'Write the file to `/etc/systemd/system/web.service` with `sudo tee`, then run `daemon-reload` and `enable --now`.'),
          },
        },
        {
          id: 'cron',
          prompt: bi('Поставьте скрипт `~/bin/backup.sh` в расписание так, чтобы он запускался каждую ночь в 02:30.', 'Schedule `~/bin/backup.sh` to run every night at 02:30.'),
          check: { when: (f) => /^\s*30\s+0?2\s+\*\s+\*\s+\*\s+\S*backup\.sh/m.test(text(f, '/var/spool/cron/crontabs/learner')) },
          chips: "echo '30 2 * * * /home/learner/bin/backup.sh' | crontab -",
          docRef: ref('man/crontab.1', 'DESCRIPTION', 'minute hour day-of-month month day-of-week'),
          hints: { H1: bi('В строке расписания пять полей: минута, час, день месяца, месяц и день недели. Звёздочка в поле означает «любое значение».', 'A schedule line has five fields: minute, hour, day of month, month and day of week. A star in a field means “any value”.'), H2: bi('Команда `crontab -` читает таблицу расписания со стандартного ввода.', '`crontab -` reads the schedule table from standard input.') },
        },
      ],
    },
    {
      id: 'cron-text',
      kind: 'text',
      step: 'explain',
      title: bi('Как запускать задачи по расписанию', 'How to run jobs on a schedule'),
      body: bi(
        '[[linux.cron|cron]] называется служба, которая каждую минуту просматривает таблицы расписаний (crontab) и выполняет те задачи, время которых наступило. Каждая строка таблицы состоит из пяти полей времени и команды:\n\n```\n# минута час день месяц день-недели  команда\n30 2 * * *   /home/learner/bin/backup.sh >> /home/learner/backup.log 2>&1\n*/15 9-18 * * 1-5   /usr/local/bin/check-queue\n```\n\nПервая строка запускает скрипт каждую ночь в 02:30, а вторая запускает проверку каждые 15 минут с 9 до 18 часов по будним дням. Свою таблицу показывает команда `crontab -l`, а установить таблицу из файла можно командой `crontab файл`. Главная ловушка в том, что команда из cron работает без вашего окружения: у неё короткий PATH, и файл `~/.bashrc` для неё не выполняется. Поэтому в таблице расписания пишут полные пути к программам и перенаправляют вывод в файл, иначе сообщения об ошибках никто не увидит.',
        '[[linux.cron|cron]] is the service that looks through the schedule tables (crontabs) every minute and runs the jobs whose time has come. Each line of a table has five time fields and a command:\n\n```\n# minute hour day month weekday  command\n30 2 * * *   /home/learner/bin/backup.sh >> /home/learner/backup.log 2>&1\n*/15 9-18 * * 1-5   /usr/local/bin/check-queue\n```\n\nThe first line runs the script every night at 02:30, and the second runs a check every 15 minutes from 9 to 18 on weekdays. `crontab -l` shows your table, and `crontab file` installs a table from a file. The main trap is that a command from cron runs without your environment: it has a short PATH, and `~/.bashrc` does not run for it. So schedule tables use full paths to programs and redirect the output to a file; otherwise nobody sees the error messages.',
      ),
    },
    {
      id: 'limit',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Служба `flappy` завершается с ошибкой и перезапускается без конца. Сделайте так, чтобы systemd перезапускал её не больше трёх раз за минуту, а после этого оставлял в состоянии failed. Нужных директив в уроке не было, поэтому найдите их сами на странице `systemd.unit(5)`: они записываются в раздел `[Unit]`, а их имена начинаются со слов StartLimit. После правки файла не забудьте `sudo systemctl daemon-reload`.', 'The `flappy` service fails and restarts endlessly. Make systemd restart it at most three times a minute and then leave it in the failed state. The lesson had no directives for this, so find them yourself on the page `systemd.unit(5)`: they go into the `[Unit]` section, and their names start with StartLimit. After editing the file, do not forget `sudo systemctl daemon-reload`.'),
      ref: { url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html', label: 'systemd.unit(5)' },
      terminal: {
        setup: {
          files: [
            { path: '/usr/local/bin/flappy', content: '#!/bin/bash\necho "flappy: crashing on purpose" >&2\nexit 1\n', owner: 'root', mode: '0755' },
            { path: '/etc/systemd/system/flappy.service', content: '[Unit]\nDescription=A service that keeps dying\n\n[Service]\nExecStart=/usr/local/bin/flappy\nRestart=always\nRestartSec=5\n', owner: 'root' },
          ],
        },
        task: {
          id: 'limit',
          prompt: bi('Служба flappy должна запускаться не больше трёх раз за 60 секунд.', 'The flappy service must start at most three times in 60 seconds.'),
          check: {
            when: (f) => {
              const u = units(f)['flappy.service'];
              const iv = u?.props.StartLimitIntervalSec ?? u?.props.StartLimitInterval ?? '';
              return !!u && u.props.StartLimitBurst === '3' && /^(60|60s|1min|1m)$/.test(iv.trim()) && !u.stale;
            },
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['StartLimitBurst', 'StartLimitIntervalSec', 'StartLimitInterval'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.enable', 'linux.q.journal-echo', 'linux.q.cron-when', 'linux.q.unit-bug', 'linux.q.restart-abnormal'] },
  ],
};

// ── 13. Disks, file systems, mounting ──

const disks: Lesson = {
  id: 'linux.disks',
  block: 'linux',
  title: bi('Диски, файловые системы и монтирование', 'Disks, file systems and mounting'),
  summary: bi('Чтобы диск появился в дереве файлов, на нём создают раздел и файловую систему, а потом подключают её в каталог дерева. В этом уроке вы пройдёте эту цепочку, узнаете, что такое inode и ссылки, и поймёте, почему команды `df` и `du` иногда показывают разное.', 'For a disk to appear in the tree of files, you create a partition and a file system on it and then attach it to a directory of the tree. In this lesson you walk this chain, learn what inodes and links are, and see why `df` and `du` sometimes disagree.'),
  introduces: ['linux.block-device', 'linux.filesystem', 'linux.mount', 'linux.inode'],
  uses: ['linux.root-dir', 'linux.sudo', 'linux.process'],
  tier: 'core',
  minutes: 45,
  sources: sources([man7('mount', 8), man7('fstab', 5), man7('df', 1), man7('ln', 1)], [wiki('Inode', 'Inode'), wiki('Ext4', 'Ext4'), wiki('tmpfs', 'Tmpfs'), opennet('mount', 8), opennet('fstab', 5)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Коллега жалуется: «Добавили серверу диск на 64 гигабайта, а места не прибавилось». Диск подключён, и система его видит, но в дереве файлов его нет. Чтобы диск появился в дереве, нужно выполнить три отдельных шага, и любой из них легко забыть.', 'A colleague complains: “We added a 64 GB disk to the server and got no more space.” The disk is connected and the system sees it, but it is not in the tree of files. Getting a disk into the tree takes three separate steps, and any of them is easy to forget.'),
    },
    {
      id: 'chain',
      kind: 'text',
      step: 'explain',
      title: bi('Как диск становится частью дерева файлов', 'How a disk becomes part of the tree of files'),
      body: bi(
        '[[linux.block-device|Блочным устройством]] называют диск целиком, например `/dev/sdb`, или его раздел, например `/dev/sdb1`, то есть часть диска, описанную в таблице разделов. Сам по себе диск хранит только ряд пронумерованных блоков. Чтобы на нём можно было хранить файлы, на нём создают [[linux.filesystem|файловую систему]], то есть способ хранить имена, права и данные. Создаёт её команда `sudo mkfs.ext4 /dev/sdb`, и при этом всё, что было на устройстве, стирается.\n\nПотом файловую систему подключают в один из каталогов дерева, и это действие называется [[linux.mount|монтированием]]:\n\n```\nsudo mkdir /data\nsudo mount /dev/sdb /data\n```\n\nТеперь всё, что лежит в `/data`, на самом деле хранится на новом диске. Если в `/data` раньше были файлы, они не удалены, а только скрыты под новой файловой системой и появятся снова после команды `umount /data`. Команда `lsblk` показывает диски и разделы, `findmnt` и `mount` без аргументов показывают, что куда смонтировано, а `df -h` показывает, сколько места свободно на каждой файловой системе.\n\nМонтирование, сделанное вручную, действует до перезагрузки. Чтобы диск подключался всегда, нужную строку записывают в файл `/etc/fstab`:\n\n```\nUUID=6d1f…  /data  ext4  defaults  0  2\n```\n\nUUID служит номером самой файловой системы, и показывает его команда `sudo blkid`. Файл `/etc/fstab` принадлежит root, поэтому строку в него дописывают приёмом из урока о правах, через `sudo tee -a`, где флаг `-a` велит дописать строку в конец, а не перезаписать файл. Набирать длинный UUID по буквам не нужно: выделите его в выводе `sudo blkid /dev/sdb` и вставьте в строку, а остальную часть строки наберите сами:\n\n```\necho \'UUID=6d1f… /data ext4 defaults 0 2\' | sudo tee -a /etc/fstab\n```\n\nИмя `/dev/sdb` в fstab лучше не записывать, потому что после подключения ещё одного диска имена устройств могут сдвинуться. Ошибка в fstab относится к тем немногим ошибкам, из-за которых сервер не загружается вовсе, поэтому после правки файла его проверяют командой `sudo mount -a`.\n\nБывают и файловые системы без диска. Файловая система tmpfs хранится в памяти и очищается при перезагрузке, и так устроен каталог `/tmp`. А команда `mount --bind каталог другое-место` показывает один и тот же каталог ещё в одном месте дерева.',
        'A [[linux.block-device|block device]] is a whole disk, for example `/dev/sdb`, or a partition of it, for example `/dev/sdb1`, that is, a part of the disk described in the partition table. A disk by itself is a row of blocks. To keep files on it, you create a [[linux.filesystem|file system]] on it, a way to store names, modes and data. `sudo mkfs.ext4 /dev/sdb` creates one, and it wipes whatever was on the device.\n\nThen the file system is attached to one of the directories of the tree, and this is called [[linux.mount|mounting]]:\n\n```\nsudo mkdir /data\nsudo mount /dev/sdb /data\n```\n\nNow everything in `/data` is actually stored on the new disk. If `/data` had files before, they are not deleted but only hidden under the new file system, and they reappear after `umount /data`. `lsblk` shows disks and partitions, `findmnt` and `mount` without arguments show what is mounted where, and `df -h` shows how much space is free on each file system.\n\nA mount made by hand lasts until the reboot. To attach the disk always, the line is written into `/etc/fstab`:\n\n```\nUUID=6d1f…  /data  ext4  defaults  0  2\n```\n\nThe UUID is the number of the file system itself, and `sudo blkid` shows it. `/etc/fstab` belongs to root, so the line is appended with the trick from the permissions lesson, `sudo tee -a`, where `-a` tells it to append rather than overwrite the file. You need not type the long UUID letter by letter: select it in the output of `sudo blkid /dev/sdb` and paste it into the line, and type the rest of the line yourself:\n\n```\necho \'UUID=6d1f… /data ext4 defaults 0 2\' | sudo tee -a /etc/fstab\n```\n\nThe name `/dev/sdb` is better not used for this, because after another disk is attached the device names may shift. A mistake in fstab is one of the few mistakes that stop a server from booting at all, so after editing the file you check it with `sudo mount -a`.\n\nThere are file systems without a disk too. tmpfs is kept in memory and emptied at reboot, and that is how `/tmp` works. And `mount --bind dir other-place` shows the same directory at one more place in the tree.',
      ),
    },
    {
      id: 'inode',
      kind: 'text',
      step: 'explain',
      title: bi('Чем имя файла отличается от inode', 'How a file name differs from an inode'),
      body: bi(
        'Файловая система знает файл не по имени, а по [[linux.inode|inode]], то есть по записи, в которой хранятся владелец, права, размер и адрес данных; номер этой записи показывает команда `ls -i`. Имя в каталоге служит только ссылкой на inode. Поэтому команда `mv` внутри одной файловой системы срабатывает мгновенно: меняется только ссылка, а данные остаются на месте.\n\nЖёсткая ссылка, которую создаёт команда `ln файл второе-имя`, даёт тому же inode второе имя. Если изменить файл через одно имя, изменение будет видно и через другое, а данные хранятся, пока существует хотя бы одна ссылка. Символическая ссылка, которую создаёт команда `ln -s куда имя`, устроена как маленький файл, в котором записан путь. Если удалить файл, на который она указывает, ссылка останется, но будет вести в никуда. С помощью символических ссылок обычно отмечают текущую версию программы, например `current -> releases/v2`.\n\nИз этого устройства следует разгадка ситуации, которая ставит в тупик даже опытных администраторов. Команда `df` показывает, что диск заполнен, а `du`, пройдя по всем каталогам, насчитывает намного меньше. Это значит, что на диске есть удалённый файл, который до сих пор держит открытым какой-то процесс: имени у файла уже нет, но inode и данные сохраняются, пока процесс не закроет файл. Команда `du` считает файлы по именам, а `df` считает занятые блоки.',
        'To a file system a file is not a name but an [[linux.inode|inode]], a record that keeps the owner, mode, size and the address of the data; `ls -i` shows its number. A name in a directory is only a link to an inode. That is why `mv` within one file system is instant: only the link changes, and the data stays where it is.\n\nA hard link, created by `ln file second-name`, gives the same inode a second name. If you change the file through one name, the change shows through the other, and the data is kept while at least one link exists. A symbolic link, created by `ln -s target name`, is a small file that holds a path. If you delete the file it points to, the link stays but leads nowhere. Symbolic links are commonly used to mark the current version of a program, for example `current -> releases/v2`.\n\nThis design explains a situation that puzzles even experienced administrators. `df` says the disk is full, while `du`, walking all directories, counts far less. It means the disk holds a deleted file that some process still keeps open: the file has no name any more, but the inode and the data are kept until the process closes it. `du` counts files by their names, and `df` counts used blocks.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { files: [{ path: '/data/README', content: 'this directory is empty until the new disk is mounted\n', owner: 'root' }, { path: '~/releases/v1/app', content: 'v1\n' }, { path: '~/releases/v2/app', content: 'v2\n' }] },
      tasks: [
        {
          id: 'mount',
          prompt: bi('На машину добавили пустой диск `/dev/sdb`. Создайте на нём файловую систему ext4 и смонтируйте её в каталог `/data`.', 'An empty disk `/dev/sdb` was added to the machine. Create an ext4 file system on it and mount it at `/data`.'),
          check: {
            when: "mounts[target='/data'].source='/dev/sdb'",
            fail: [{ if: "term['main'][last].out~'wrong fs type'", say: bi('На диске ещё нет файловой системы. Создайте её командой `mkfs.ext4`.', 'The disk has no file system yet. Create one with `mkfs.ext4`.') }],
          },
          chips: 'sudo mkfs.ext4 /dev/sdb && sudo mount /dev/sdb /data',
          docRef: ref('man/mount.8', 'DESCRIPTION'),
          hints: { H1: bi('Сделать нужно два шага: сначала создать файловую систему, а потом смонтировать её.', 'You need two steps: first create the file system, then mount it.'), H2: bi('Посмотрите на вывод `ls /data` до монтирования и после него. Куда исчез файл README?', 'Look at `ls /data` before and after mounting. Where did the README go?') },
        },
        {
          id: 'fstab',
          prompt: bi('Сделайте так, чтобы диск монтировался в `/data` при каждой загрузке, причём по UUID, а не по имени устройства.', 'Make the disk mount at `/data` at every boot, by UUID rather than by the device name.'),
          check: {
            when: (f) => /^\s*UUID=[0-9a-f-]{36}\s+\/data\s+ext4\s+\S+/m.test(text(f, '/etc/fstab')),
            fail: [{ if: "term['main'][last].out~'Permission denied'", say: bi('Файл `/etc/fstab` принадлежит root, и запись знаком `>>` выполняет ваша оболочка от вашего имени. Дописывайте строку через `sudo tee -a /etc/fstab`, как показано в тексте урока.', '`/etc/fstab` belongs to root, and a `>>` write is done by your shell as you. Append the line with `sudo tee -a /etc/fstab`, as the lesson text shows.') }, { if: (f) => /^\s*\/dev\/sdb\s+\/data/m.test(text(f, '/etc/fstab')), say: bi('Строка с именем устройства будет работать, только пока не подключат ещё один диск. Возьмите UUID из вывода `sudo blkid`.', 'A line with the device name works only until another disk is attached. Take the UUID from `sudo blkid`.') }],
          },
          chips: 'sudo blkid',
          docRef: ref('man/mount.8', 'THE FILES /ETC/FSTAB'),
          hints: { H1: bi('В строке fstab указывают, что монтировать, куда, тип файловой системы, параметры и два числа.', 'An fstab line gives what to mount, where, the file system type, the options and two numbers.'), H2: bi("`echo 'UUID=… /data ext4 defaults 0 2' | sudo tee -a /etc/fstab`", "`echo 'UUID=… /data ext4 defaults 0 2' | sudo tee -a /etc/fstab`") },
        },
        {
          id: 'link',
          prompt: bi('Создайте в домашнем каталоге символическую ссылку `current`, которая ведёт на каталог `releases/v2`.', 'Create a symbolic link `current` in your home directory that leads to `releases/v2`.'),
          check: { when: "files['/home/learner/current'].type=l && files['/home/learner/current'].target~'releases/v2'" },
          chips: 'ln -s releases/v2 ~/current',
          docRef: ref('man/ln.1', 'OPTIONS', '-s, --symbolic'),
          hints: { H1: bi('Символическую ссылку создаёт команда `ln -s куда имя`.', '`ln -s target name` creates a symbolic link.') },
        },
        {
          id: 'tmpfs',
          prompt: bi('Смонтируйте в каталог `/mnt/scratch` файловую систему в памяти размером 16 мегабайт.', 'Mount an in-memory file system of 16 megabytes at `/mnt/scratch`.'),
          check: { when: "mounts[target='/mnt/scratch'].type=tmpfs && mounts[target='/mnt/scratch'].options~'size=16384k'" },
          chips: 'sudo mkdir -p /mnt/scratch && sudo mount -t tmpfs -o size=16m tmpfs /mnt/scratch',
          docRef: ref('man/mount.8', 'OPTIONS', '-o, --options'),
          hints: { H1: bi('Файловая система в памяти называется tmpfs, а размер задаётся параметром `-o size=…`.', 'The in-memory file system is called tmpfs, and the size is set with the option `-o size=…`.') },
        },
      ],
    },
    {
      id: 'inodes',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Место на диске может кончиться не только в байтах, потому что число inode на файловой системе тоже ограничено. Узнайте, сколько свободных inode осталось на `/`, и запишите одно это число в файл `~/inodes.txt`. Команда, которая показывает свободное место, вам знакома, а флаг, который велит ей считать inode вместо байтов, найдите на её странице `df(1)`.', 'A disk can run out not only of bytes, because the number of inodes on a file system is limited too. Find out how many free inodes are left on `/` and write just that number into `~/inodes.txt`. You know the command that shows free space, and the flag that makes it count inodes instead of bytes is on its page, `df(1)`.'),
      ref: ref('man/df.1'),
      terminal: {
        setup: {},
        task: {
          id: 'inodes',
          prompt: bi('Запишите в файл `~/inodes.txt` число свободных inode на `/`.', 'Write the number of free inodes on `/` into `~/inodes.txt`.'),
          check: { when: (f) => /^\s*\d{5,7}\s*$/.test(text(f, '/home/learner/inodes.txt')) && Number(text(f, '/home/learner/inodes.txt')) > 400000 },
          docStep: 4,
          beyond: true,
          solutionTokens: ['df -i', '--inodes', 'IFree', 'iavail'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.uuid', 'linux.q.mount-hide', 'linux.q.df-du', 'linux.q.links'] },
  ],
};

export const LESSONS_2: Lesson[] = [streams, env, processes, scripts, packages, services, disks];
