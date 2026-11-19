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
  title: bi('Потоки, конвейеры и текст', 'Streams, pipelines and text'),
  summary: bi('Вывод можно отправить в файл, а можно — на вход другой команде. Из маленьких фильтров собирается ответ на вопрос к журналу.', 'Output can go to a file, or into the input of another command. Small filters add up to an answer to a question about a log.'),
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
      body: bi('«Посмотрите по журналу, с каких адресов чаще всего прилетают ошибки 500». В журнале сорок тысяч строк. Программы «посчитай ошибки по адресам» не существует — но её можно собрать из пяти маленьких за одну строку.', '“Check the log: which addresses get the most 500 errors?” The log has forty thousand lines. There is no program called “count errors by address” — but you can build one out of five small ones in a single line.'),
    },
    {
      id: 'streams',
      kind: 'text',
      step: 'explain',
      title: bi('Три потока', 'Three streams'),
      body: bi(
        'У каждой команды три [[linux.stream|стандартных потока]]: ввод (номер 0, stdin), вывод (1, stdout) и ошибки (2, stderr). Обычно все три подключены к терминалу: вы печатаете — команда читает, команда пишет — вы видите. Ошибки идут отдельным потоком, чтобы их было видно, даже когда вывод ушёл куда-то ещё.\n\n[[linux.redirect|Перенаправление]] подключает поток к файлу вместо терминала. Его делает оболочка, команда об этом даже не знает:\n\n- `ls /etc > list.txt` — вывод в файл; файл создаётся или **перезаписывается**;\n- `echo line >> notes.txt` — дописать в конец;\n- `wc -l < list.txt` — взять ввод из файла;\n- `cmd 2> errors.txt` — ошибки в файл, вывод по-прежнему на экран;\n- `cmd > all.txt 2>&1` — ошибки туда же, куда сейчас идёт вывод.\n\nУ последнего важен порядок. `2>&1` значит «поток 2 — туда, куда **в этот момент** смотрит поток 1». В `cmd > all.txt 2>&1` поток 1 уже смотрит в файл — оба потока в файле. В `cmd 2>&1 > all.txt` поток 2 скопировал старое направление — терминал, — и ошибки остались на экране.',
        'Every command has three [[linux.stream|standard streams]]: input (number 0, stdin), output (1, stdout) and errors (2, stderr). Usually all three are connected to the terminal: you type and the command reads, the command writes and you see. Errors go in a separate stream so that you see them even when the output has gone somewhere else.\n\n[[linux.redirect|Redirection]] connects a stream to a file instead of the terminal. The shell does it; the command does not even know:\n\n- `ls /etc > list.txt` — output to a file; the file is created or **overwritten**;\n- `echo line >> notes.txt` — append to the end;\n- `wc -l < list.txt` — take the input from a file;\n- `cmd 2> errors.txt` — errors to a file, output still to the screen;\n- `cmd > all.txt 2>&1` — errors to wherever the output goes now.\n\nIn the last one the order matters. `2>&1` means “stream 2 goes where stream 1 points **at this moment**”. In `cmd > all.txt 2>&1` stream 1 already points to the file — both streams are in the file. In `cmd 2>&1 > all.txt` stream 2 copied the old direction, the terminal, and the errors stayed on screen.',
      ),
    },
    {
      id: 'pipes',
      kind: 'text',
      step: 'explain',
      title: bi('Конвейер', 'A pipeline'),
      body: bi(
        "Знак `|` соединяет вывод одной команды со вводом следующей — это [[linux.pipe|конвейер команд]]. Каждая команда в нём делает одно маленькое дело:\n\n- `grep образец` оставляет строки, где он есть (`-v` — где его нет, `-c` — считает, `-i` — без учёта регистра, `-w` — целым словом);\n- `cut -d' ' -f1` берёт первое поле, если поля разделены пробелом;\n- `sort` упорядочивает строки (`-n` — как числа, `-r` — наоборот);\n- `uniq -c` склеивает **соседние** одинаковые строки и пишет, сколько их было — поэтому перед ним почти всегда `sort`;\n- `head -3` берёт первые три строки, `wc -l` считает строки.\n\nТак вопрос «какие адреса чаще всего получают 500» превращается в строку:\n\n```\ngrep ' 500' access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -3\n```\n\nЧитается слева направо: строки с 500 → только адреса → по порядку → посчитать одинаковые → самые частые сверху → первые три.\n\nОбразец для `grep` — это [[linux.regex|регулярное выражение]]: шаблон строки. `^` — начало строки, `$` — конец, `.` — любой символ, `*` — «предыдущее сколько угодно раз», `[0-9]` — любая цифра. `grep '^ERROR'` найдёт строки, которые начинаются с ERROR, а `grep -E '5[0-9]{2}$'` — любые коды 5xx в конце строки.\n\nДля замены в тексте есть `sed 's/было/стало/g'`, для работы со столбцами — `awk '{print $1, $4}'`.",
        'The `|` sign connects the output of one command to the input of the next — that is a [[linux.pipe|shell pipeline]]. Each command in it does one small job:\n\n- `grep pattern` keeps the lines that contain it (`-v` — those that do not, `-c` — counts, `-i` — ignoring case, `-w` — as a whole word);\n- `cut -d\' \' -f1` takes the first field when fields are separated by a space;\n- `sort` puts lines in order (`-n` — as numbers, `-r` — reversed);\n- `uniq -c` merges **adjacent** identical lines and writes how many there were — which is why `sort` almost always comes before it;\n- `head -3` takes the first three lines, `wc -l` counts lines.\n\nSo the question “which addresses get the most 500s” turns into a line:\n\n```\ngrep \' 500\' access.log | cut -d\' \' -f1 | sort | uniq -c | sort -rn | head -3\n```\n\nRead it left to right: lines with 500 → only the addresses → in order → count the identical ones → the most frequent on top → the first three.\n\nThe pattern for `grep` is a [[linux.regex|regular expression]]: a pattern of a line. `^` is the start of the line, `$` the end, `.` any character, `*` “the previous thing any number of times”, `[0-9]` any digit. `grep \'^ERROR\'` finds lines that start with ERROR, and `grep -E \'5[0-9]{2}$\'` any 5xx code at the end of a line.\n\nFor replacing text there is `sed \'s/old/new/g\'`, for working with columns — `awk \'{print $1, $4}\'`.',
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
          prompt: bi('Запишите в `~/top.txt` три адреса, которые чаще всего получают ответ 500, со счётчиками, самый частый первым — так, как печатает `uniq -c`.', 'Write into `~/top.txt` the three addresses that get the 500 answer most often, with their counts, the most frequent first — the way `uniq -c` prints them.'),
          check: {
            when: topOk,
            fail: [
              { if: (f) => /\b1 10\.0\.0\.7\b/.test(text(f, '/home/learner/top.txt')), say: bi('Счётчики единичные: `uniq -c` склеивает только соседние строки — перед ним нужен `sort`.', 'The counts are all ones: `uniq -c` merges only adjacent lines — it needs `sort` in front of it.') },
              { if: (f) => text(f, '/home/learner/top.txt').split('\n').filter(Boolean).length > 3, say: bi('Строк больше трёх: оставьте первые три через `head -3`.', 'There are more than three lines: keep the first three with `head -3`.') },
            ],
          },
          chips: "grep ' 500' access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -3 > ~/top.txt",
          docRef: ref('man/uniq.1', 'DESCRIPTION', 'does not detect repeated lines unless they are adjacent'),
          hints: {
            H1: bi('Разбейте вопрос на шаги: какие строки, какое поле, как посчитать, как упорядочить.', 'Break the question into steps: which lines, which field, how to count, how to order.'),
            H2: bi('`grep` → `cut` → `sort` → `uniq -c` → `sort -rn` → `head`, и `>` в файл.', '`grep` → `cut` → `sort` → `uniq -c` → `sort -rn` → `head`, and `>` into the file.'),
          },
        },
        {
          id: 'split',
          prompt: bi('Выполните `ls /etc/hostname /nosuch` так, чтобы обычный вывод попал в `~/out.txt`, а сообщение об ошибке — в `~/err.txt`.', 'Run `ls /etc/hostname /nosuch` so that the normal output goes to `~/out.txt` and the error message to `~/err.txt`.'),
          check: {
            when: "files['/home/learner/out.txt'].text~'/etc/hostname' && files['/home/learner/err.txt'].text~'No such file' && !(files['/home/learner/out.txt'].text~'No such file')",
            fail: [{ if: "files['/home/learner/out.txt'].text~'No such file'", say: bi('Ошибка попала в out.txt: у вас стоит `2>&1`. Потоку 2 нужен свой файл: `2> ~/err.txt`.', 'The error got into out.txt: you have `2>&1`. Stream 2 needs its own file: `2> ~/err.txt`.') }],
          },
          chips: 'ls /etc/hostname /nosuch > ~/out.txt 2> ~/err.txt',
          docRef: ref('man/bash.1', 'REDIRECTION', '2> file'),
          hints: { H1: bi('У вывода номер 1, у ошибок — 2; у каждого может быть своё перенаправление.', 'Output is 1, errors are 2; each may have its own redirection.') },
        },
        {
          id: 'sums',
          prompt: bi('В `~/downloads` три архива и список их контрольных сумм `SHA256SUMS`. Проверьте их и запишите имя испорченного файла в `~/bad.txt`.', 'In `~/downloads` there are three archives and the list of their checksums, `SHA256SUMS`. Verify them and write the name of the damaged file into `~/bad.txt`.'),
          check: { when: "files['/home/learner/bad.txt'].text~'app-2.tar.gz' && !(files['/home/learner/bad.txt'].text~'app-1') && !(files['/home/learner/bad.txt'].text~'app-3')" },
          chips: 'cd ~/downloads && sha256sum -c SHA256SUMS',
          docRef: ref('man/sha256sum.1', 'OPTIONS', '-c, --check'),
          hints: { H1: bi('У `sha256sum` есть режим проверки по списку.', '`sha256sum` has a mode that checks against a list.'), H2: bi('Найдите в выводе строку с FAILED и запишите имя (можно руками: `echo app-?.tar.gz > ~/bad.txt`).', 'Find the line with FAILED in the output and write the name (by hand is fine: `echo app-?.tar.gz > ~/bad.txt`).') },
        },
      ],
    },
    {
      id: 'checksum',
      kind: 'text',
      step: 'explain',
      title: bi('Отпечаток файла', 'A fingerprint of a file'),
      body: bi(
        '[[linux.checksum|Контрольная сумма]] — короткая строка, вычисленная по содержимому файла: `sha256sum app.tar.gz` печатает 64 шестнадцатеричных символа. Изменился один байт — сумма другая целиком. Поэтому рядом со скачиваемыми файлами публикуют список сумм, и `sha256sum -c SHA256SUMS` сверяет каждый файл со списком: OK или FAILED. Так проверяют, что файл скачался целым и что его никто не подменил по дороге.',
        'A [[linux.checksum|checksum]] is a short string computed from a file’s contents: `sha256sum app.tar.gz` prints 64 hexadecimal characters. Change one byte and the whole sum is different. That is why lists of sums are published next to downloadable files, and `sha256sum -c SHA256SUMS` checks every file against the list: OK or FAILED. That is how you make sure a file arrived whole and nobody swapped it on the way.',
      ),
    },
    {
      id: 'word',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('В `~/access.log` найдите в `grep(1)` способ искать `GET` только как отдельное слово и посчитайте такие строки одним числом.', 'In `grep(1)` find how to search for `GET` only as a separate word, and count such lines as a single number.'),
      ref: ref('man/grep.1', 'OPTIONS', '-w, --word-regexp'),
      terminal: {
        setup: { files: [{ path: '~/access.log', content: 'GET /\nGETTER /x\nPOST /y\nGET /z\n' }] },
        task: {
          id: 'word',
          prompt: bi('Выведите одно число: сколько строк содержат GET отдельным словом.', 'Print one number: how many lines contain GET as a separate word.'),
          check: { stdout: /^2\n$/ },
          docStep: 2,
          chips: 'grep -cw GET ~/access.log',
          hints: { H1: bi('Нужны два флага: «целым словом» и «посчитать».', 'You need two flags: “as a whole word” and “count”.') },
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
  title: bi('Переменные, окружение и PATH', 'Variables, the environment and PATH'),
  summary: bi('Почему программа есть, а терминал пишет `command not found`, и как сделать, чтобы настройка жила дольше одного окна.', 'Why a program is there but the terminal says `command not found`, and how to make a setting outlive one window.'),
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
      body: bi('Вы положили программу `hello` в `~/bin`, она на месте и запускается по полному пути. Набираете просто `hello` — `command not found`. Машина не видит то, что лежит у вас в домашнем каталоге?', 'You put a program called `hello` into `~/bin`; it is there and runs by its full path. You type just `hello` — `command not found`. The machine cannot see what lies in your home directory?'),
    },
    {
      id: 'vars',
      kind: 'text',
      step: 'explain',
      title: bi('Переменные', 'Variables'),
      body: bi(
        '[[linux.variable|Переменная оболочки]] — имя со значением: `CITY=Almaty` (без пробелов вокруг `=`). `$CITY` в строке оболочка заменяет значением ещё до запуска команды: `echo "I live in $CITY"`. Кавычки решают, будет ли замена: в двойных переменные подставляются, в одинарных — нет, `echo \'$CITY\'` напечатает `$CITY` буквально.\n\nПеременная оболочки живёт только в этой оболочке. Программы, которые вы запускаете, получают копию другого набора — [[linux.env|переменных окружения]]. Чтобы переменная попала туда, её помечают `export`: `export CITY`. Проверить, что видит запущенная программа, легко: `bash -c \'echo $CITY\'` запускает новую оболочку и печатает, что получила она. Весь набор показывает `env`.',
        'A [[linux.variable|shell variable]] is a name with a value: `CITY=Almaty` (no spaces around `=`). The shell replaces `$CITY` in a line with the value before the command even starts: `echo "I live in $CITY"`. Quotes decide whether the replacement happens: inside double quotes variables are substituted, inside single quotes not — `echo \'$CITY\'` prints `$CITY` literally.\n\nA shell variable lives only in that shell. The programs you start receive a copy of another set — the [[linux.env|environment variables]]. To get a variable into it, mark it with `export`: `export CITY`. Checking what a started program sees is easy: `bash -c \'echo $CITY\'` starts a new shell and prints what that shell received. `env` shows the whole set.',
      ),
    },
    {
      id: 'path',
      kind: 'text',
      step: 'explain',
      title: bi('PATH', 'PATH'),
      body: bi(
        'Самая важная переменная окружения — [[linux.path-var|PATH]]: список каталогов через двоеточие.\n\n```\n$ echo $PATH\n/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n```\n\nКогда вы набираете имя без `/`, оболочка проверяет эти каталоги по очереди и запускает первую найденную программу с таким именем. Текущего каталога и `~/bin` в списке нет — вот и весь секрет `command not found`. Поэтому программу рядом с собой запускают как `./prog`: путь с `/` поиск по PATH не включает.\n\nКаталог добавляют к списку, а не вместо него:\n\n```\nexport PATH="$HOME/bin:$PATH"\n```\n\n`export PATH=/opt/bin` без `$PATH` заменит список целиком — и пропадут `ls`, `cat` и всё остальное из `/usr/bin`. Где оболочка нашла команду, покажут `which hello` и `type hello`.\n\nВсё это живёт до закрытия терминала. Чтобы настройка была в каждой новой оболочке, строку дописывают в `~/.bashrc` — этот файл выполняется при запуске каждой интерактивной оболочки. В уже открытой оболочке его можно выполнить заново: `source ~/.bashrc`.',
        'The most important environment variable is [[linux.path-var|PATH]]: a list of directories separated by colons.\n\n```\n$ echo $PATH\n/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n```\n\nWhen you type a name without `/`, the shell checks these directories in order and runs the first program with that name it finds. Neither the current directory nor `~/bin` is on the list — that is the whole secret of `command not found`. That is why a program next to you is started as `./prog`: a path with `/` skips the PATH lookup.\n\nA directory is added to the list, not instead of it:\n\n```\nexport PATH="$HOME/bin:$PATH"\n```\n\n`export PATH=/opt/bin` without `$PATH` replaces the whole list — and `ls`, `cat` and everything else in `/usr/bin` disappears. `which hello` and `type hello` show where the shell found a command.\n\nAll of this lives until the terminal closes. To have a setting in every new shell, append the line to `~/.bashrc` — the file runs when every interactive shell starts. In a shell that is already open you can run it again: `source ~/.bashrc`.',
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
          prompt: bi('Сделайте так, чтобы программа запускалась просто по имени `hello`, и запустите её.', 'Make the program run by its name, `hello`, and run it.'),
          check: {
            when: "vars.PATH~'/home/learner/bin' && vars.PATH~'/usr/bin' && term['main'][last].exit=0",
            stdout: 'hello from',
            fail: [{ if: "!(vars.PATH~'/usr/bin')", say: bi('В PATH остался только ваш каталог: `/usr/bin` пропал, и теперь не найдутся другие команды. Добавляйте к `$PATH`, а не вместо.', 'Only your directory is left in PATH: `/usr/bin` is gone and other commands will not be found. Add to `$PATH`, not instead of it.') }],
          },
          chips: 'export PATH="$HOME/bin:$PATH" && hello',
          docRef: ref('man/bash.1', 'DESCRIPTION'),
          hints: { H1: bi('Оболочка ищет программы только в каталогах из PATH.', 'The shell looks for programs only in the PATH directories.'), H2: bi('Добавьте `$HOME/bin` в начало PATH, не потеряв остальное.', 'Put `$HOME/bin` at the start of PATH without losing the rest.') },
        },
        {
          id: 'persist',
          prompt: bi('Сделайте эту настройку постоянной: чтобы каждая новая оболочка находила `hello`.', 'Make that setting permanent: every new shell must find `hello`.'),
          check: { when: (f) => /PATH=.*(\$HOME|~|\/home\/learner)\/bin/.test(text(f, '/home/learner/.bashrc')) && /\$PATH|\$\{PATH\}/.test(text(f, '/home/learner/.bashrc')) },
          chips: `echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc`,
          hints: { H1: bi('Какой файл выполняется при старте каждой оболочки?', 'Which file runs when every shell starts?'), H2: bi('Допишите строку в конец `~/.bashrc` через `>>` — одинарные кавычки сохранят `$PATH` как есть.', 'Append the line to `~/.bashrc` with `>>` — single quotes keep `$PATH` as it is.') },
        },
        {
          id: 'export',
          prompt: bi('Задайте переменную `GREETING` со значением `hi`, так чтобы её видела запущенная программа: `bash -c \'echo $GREETING\'` должна напечатать `hi`.', 'Set the variable `GREETING` to `hi` so that a started program sees it: `bash -c \'echo $GREETING\'` must print `hi`.'),
          check: { when: "vars.GREETING=hi", stdout: /^hi\n$/, fail: [{ if: (f) => f.vars.GREETING === 'hi' && (f.term.main.at(-1)?.out ?? 'x').trim() === '', say: bi('Переменная есть в оболочке, но не в окружении: без `export` запущенная программа её не получает.', 'The variable is in the shell but not in the environment: without `export` a started program does not get it.') }] },
          chips: `export GREETING=hi && bash -c 'echo $GREETING'`,
          docRef: { url: 'https://man7.org/linux/man-pages/man7/environ.7.html', label: 'environ(7)' },
          hints: { H1: bi('Запущенные программы получают только экспортированные переменные.', 'Started programs receive only exported variables.') },
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
  summary: bi('Программа — файл, процесс — её работа. Как рождается процесс, как его найти, вежливо остановить и что такое код завершения.', 'A program is a file, a process is it at work. How a process is born, how to find it, stop it politely, and what an exit code is.'),
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
      body: bi('«Сервер тормозит, гляньте, что там жрёт процессор». Где это «что»? Не файл и не каталог — что-то, что работает прямо сейчас.', '“The server is slow, see what is eating the CPU.” Where is that “what”? Not a file, not a directory — something that is running right now.'),
    },
    {
      id: 'process',
      kind: 'text',
      step: 'explain',
      title: bi('Программа и процесс', 'A program and a process'),
      body: bi(
        'Программа — это файл на диске, `/usr/bin/ls`. [[linux.process|Процесс]] — программа за работой: у него есть номер (PID), память, открытые файлы, пользователь, от имени которого он работает, и родитель — процесс, который его запустил (PPID). Одна программа может работать сразу во многих процессах.\n\nВсем этим управляет [[linux.kernel|ядро]] — часть системы, которая распределяет процессор, память и устройства. Процессы не трогают диск или сеть сами — они просят ядро [[linux.syscall|системными вызовами]]: «открой файл» (`openat`), «запиши» (`write`), «создай процесс» (`clone`), «запусти программу» (`execve`).\n\n`ps` показывает процессы: просто `ps` — ваши в этом терминале, `ps aux` — все на машине, с пользователем, долей процессора и памяти. `top` — то же, отсортированное по нагрузке, со сводкой машины сверху. `pstree -p` рисует их деревом: у каждого процесса, кроме самого первого, есть родитель.',
        'A program is a file on a disk, `/usr/bin/ls`. A [[linux.process|process]] is a program at work: it has a number (PID), memory, open files, a user it runs as, and a parent — the process that started it (PPID). One program can run in many processes at once.\n\nAll of this is managed by the [[linux.kernel|kernel]] — the part of the system that hands out the CPU, memory and devices. Processes do not touch the disk or the network themselves — they ask the kernel with [[linux.syscall|system calls]]: “open a file” (`openat`), “write” (`write`), “create a process” (`clone`), “run a program” (`execve`).\n\n`ps` shows processes: plain `ps` — yours in this terminal, `ps aux` — all on the machine, with the user, the share of CPU and memory. `top` is the same sorted by load, with a summary of the machine on top. `pstree -p` draws them as a tree: every process except the very first has a parent.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.exec', caption: bi('Пройдите шаги; поменяйте команду на `cd /tmp` и PATH на сломанный.', 'Step through; change the command to `cd /tmp` and PATH to the broken one.') },
    {
      id: 'fork',
      kind: 'text',
      step: 'explain',
      title: bi('Как рождается процесс', 'How a process is born'),
      body: bi(
        'Когда вы нажимаете Enter, оболочка находит программу по PATH и делает копию самой себя — [[linux.fork-exec|fork]]. У копии новый номер, но те же переменные окружения и те же открытые файлы. Копия настраивает перенаправления, а потом просит ядро загрузить в себя нужную программу — exec. Номер при этом не меняется. Оболочка тем временем ждёт.\n\nОтсюда несколько вещей, которые раньше казались правилами без причины. Запущенная программа видит экспортированные переменные — потому что она копия оболочки. Перенаправление ошибается раньше, чем программа запустится, — потому что его делает копия до exec. А `cd` — встроенная команда, потому что сменить каталог копии бесполезно.\n\nВ конце процесс завершается с числом — [[linux.exit-code|кодом завершения]]: 0 значит успех, любое другое — что-то пошло не так. Оболочка кладёт его в `$?`. `grep` возвращает 1, если ничего не нашёл, `ls` — 2, если файла нет, 127 значит «команда не найдена». Пока родитель не забрал код, завершившийся процесс остаётся строчкой в таблице — это зомби, `Z` в `ps`.',
        'When you press Enter, the shell finds the program in PATH and makes a copy of itself — [[linux.fork-exec|fork]]. The copy has a new number but the same environment variables and the same open files. The copy sets up the redirections and then asks the kernel to load the right program into itself — exec. The number does not change. Meanwhile the shell waits.\n\nThis explains several things that used to look like rules without a reason. A started program sees the exported variables — because it is a copy of the shell. A redirection fails before the program starts — because the copy does it before exec. And `cd` is a builtin because changing the directory of a copy would be pointless.\n\nIn the end a process exits with a number — the [[linux.exit-code|exit code]]: 0 means success, anything else that something went wrong. The shell puts it into `$?`. `grep` returns 1 if it found nothing, `ls` returns 2 if the file is missing, 127 means “command not found”. Until the parent collects the code, the finished process stays a line in the table — a zombie, `Z` in `ps`.',
      ),
    },
    {
      id: 'signals',
      kind: 'text',
      step: 'explain',
      title: bi('Сигналы', 'Signals'),
      body: bi(
        'Остановить процесс можно, только попросив ядро передать ему [[linux.signal|сигнал]] — короткое сообщение с номером. `kill PID` посылает TERM (15): «пожалуйста, завершись». Процесс может поймать его, сохранить данные и выйти — или проигнорировать. KILL (`kill -9 PID`) процесс поймать не может: его завершает ядро, сразу, без уборки. Поэтому сначала TERM, и только если не помогло — KILL.\n\nCtrl+C в терминале посылает INT, Ctrl+Z — TSTP (процесс останавливается, `T` в `ps`, а `fg` возвращает его), HUP часто значит «перечитай настройки». Номер процесса берут из `ps` или `pgrep имя`, а `pkill имя` посылает сигнал по имени. Процесс, убитый сигналом N, завершается с кодом 128 + N: 143 после TERM, 137 после KILL.\n\nКоманду можно запустить в фоне, добавив `&`: оболочка не ждёт её, а сразу показывает приглашение. `jobs` показывает фоновые задания, `fg` возвращает задание на передний план, `kill %1` — сигнал первому заданию.',
        'You can stop a process only by asking the kernel to deliver it a [[linux.signal|signal]] — a short message with a number. `kill PID` sends TERM (15): “please finish”. The process may catch it, save its data and exit — or ignore it. KILL (`kill -9 PID`) cannot be caught: the kernel ends the process at once, with no cleanup. So TERM first, and KILL only if that did not help.\n\nCtrl+C in a terminal sends INT, Ctrl+Z sends TSTP (the process stops, `T` in `ps`, and `fg` brings it back), HUP often means “re-read your settings”. The process number comes from `ps` or `pgrep name`, and `pkill name` sends a signal by name. A process killed by signal N ends with code 128 + N: 143 after TERM, 137 after KILL.\n\nA command can run in the background if you add `&`: the shell does not wait for it and shows the prompt at once. `jobs` lists the background jobs, `fg` brings a job back to the foreground, `kill %1` signals job one.',
      ),
    },
    { id: 'pipe-look', kind: 'explainer', step: 'review', explainer: 'linux.pipe', caption: bi('Тот же конвейер из урока про потоки — теперь видно, что каждая команда в нём отдельный процесс, а трубы — буферы ядра.', 'The same pipeline as in the streams lesson — now you can see that each command is a separate process and the pipes are kernel buffers.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: procSetup,
      tasks: [
        {
          id: 'burner',
          prompt: bi('Какая-то программа нагружает процессор. Найдите её и остановите — вежливо, сигналом TERM.', 'Some program is loading the CPU. Find it and stop it — politely, with TERM.'),
          check: { when: "!procs[cmd=burner]", fail: [{ if: "procs[cmd=burner] && term['main'][last].line~'kill'", say: bi('Номер не тот или сигнал не дошёл: возьмите PID из `top` или `pgrep burner`.', 'Wrong number, or the signal did not arrive: take the PID from `top` or `pgrep burner`.') }] },
          chips: 'top',
          docRef: ref('man/top.1', 'DESCRIPTION'),
          hints: { H1: bi('`top` сортирует процессы по нагрузке на процессор.', '`top` sorts processes by CPU load.'), H2: bi('Номер из колонки PID — в `kill`; без флага `kill` и посылает TERM.', 'The number from the PID column goes to `kill`; with no flag `kill` sends TERM.') },
        },
        {
          id: 'sigdemo',
          prompt: bi('Программа `sigdemo` ловит TERM и не завершается. Остановите её всё равно.', 'The `sigdemo` program catches TERM and does not exit. Stop it anyway.'),
          check: { when: "!procs[cmd=sigdemo]", fail: [{ if: "procs[cmd=sigdemo]", say: bi('Сигнал, который процесс ловит, его не остановит. Нужен тот, что ловить нельзя.', 'A signal the process catches will not stop it. You need one that cannot be caught.') }] },
          chips: 'pkill -KILL sigdemo',
          docRef: { url: 'https://man7.org/linux/man-pages/man7/signal.7.html', label: 'signal(7) · Standard signals' },
          hints: { H1: bi('Посмотрите, что `sigdemo` пишет в `/tmp/sigdemo.log` после `kill`.', 'Look at what `sigdemo` writes to `/tmp/sigdemo.log` after `kill`.'), H2: bi('KILL ловить нельзя: `kill -9 PID` или `pkill -KILL sigdemo`.', 'KILL cannot be caught: `kill -9 PID` or `pkill -KILL sigdemo`.') },
        },
        {
          id: 'exit',
          prompt: bi('Выясните, с каким кодом завершается `ls /nosuch`: выведите только это число.', 'Find out the exit code of `ls /nosuch`: print just that number.'),
          check: { stdout: /(^|\n)2\n$/ },
          chips: 'ls /nosuch; echo $?',
          hints: { H1: bi('Код последней команды лежит в `$?`.', 'The code of the last command is in `$?`.') },
        },
      ],
    },
    {
      id: 'mem',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Сохраните в `~/mem.txt` процессы машины, отсортированные по памяти, самые большие первыми, только с колонками pid, rss и comm. Как это сделать, написано в `ps(1)`.', 'Save into `~/mem.txt` the processes of the machine sorted by memory, biggest first, with only the columns pid, rss and comm. How, `ps(1)` tells you.'),
      ref: ref('man/ps.1'),
      terminal: {
        setup: {},
        task: {
          id: 'mem',
          prompt: bi('`~/mem.txt`: pid, rss, comm, по убыванию памяти.', '`~/mem.txt`: pid, rss, comm, by decreasing memory.'),
          check: { when: memOk },
          docStep: 3,
          docRef: ref('man/ps.1', 'STANDARD FORMAT SPECIFIERS'),
          chips: 'ps',
          hints: { H1: bi('Ищите в странице, как задать свои колонки и как сортировать.', 'Look in the page for how to choose your own columns and how to sort.') },
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
  summary: bi('Пять одинаковых команд каждое утро — это скрипт. Аргументы, условия, циклы, код возврата и режим, в котором скрипт не молчит об ошибках.', 'The same five commands every morning are a script. Arguments, conditions, loops, the exit code, and the mode in which a script does not keep quiet about errors.'),
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
      body: bi('Каждое утро вы упаковываете сайт в архив, кладёте его в каталог с бэкапами и проверяете, что всё получилось. Пять команд, каждый день, и однажды вы перепутаете одну. Пора записать их в файл.', 'Every morning you pack the site into an archive, put it into the backups directory and check that it worked. Five commands every day, and one day you will mix one up. Time to write them into a file.'),
    },
    {
      id: 'script',
      kind: 'text',
      step: 'explain',
      title: bi('Файл с командами', 'A file of commands'),
      body: bi(
        '[[linux.script|Скрипт]] — текстовый файл с командами оболочки, которые выполняются по очереди. Первая строка — [[linux.shebang|shebang]]: `#!/bin/bash`. Она говорит ядру, какой программой выполнить файл, когда его запускают как программу. Дальше — обычные команды, а строки с `#` — комментарии.\n\n```bash\n#!/bin/bash\n# backup.sh: pack a directory into ~/backups\nset -euo pipefail\n\nif [ $# -ne 1 ]; then\n  echo "usage: backup.sh DIR" >&2\n  exit 1\nfi\n\nname=$(basename "$1")\nmkdir -p ~/backups\ntar -czf ~/backups/"$name".tar.gz -C "$(dirname "$1")" "$name"\necho "saved ~/backups/$name.tar.gz"\n```\n\nЧтобы запускать файл как программу, ему нужен бит `x` (`chmod u+x backup.sh`), а запускают его по пути: `./backup.sh ~/site` или из каталога в PATH. `bash backup.sh ~/site` работает и без бита — здесь программа `bash`, а файл — её аргумент.\n\nАргументы скрипта — `$1`, `$2` и так далее, `$#` — сколько их, `"$@"` — все, каждый отдельным словом. `$(команда)` подставляет вывод команды: `name=$(basename "$1")`. Кавычки вокруг `"$1"` нужны всегда: без них путь с пробелом развалится на два аргумента.',
        'A [[linux.script|script]] is a text file with shell commands that run in order. The first line is the [[linux.shebang|shebang]]: `#!/bin/bash`. It tells the kernel which program runs the file when it is started as a program. Then come ordinary commands; lines with `#` are comments.\n\n```bash\n#!/bin/bash\n# backup.sh: pack a directory into ~/backups\nset -euo pipefail\n\nif [ $# -ne 1 ]; then\n  echo "usage: backup.sh DIR" >&2\n  exit 1\nfi\n\nname=$(basename "$1")\nmkdir -p ~/backups\ntar -czf ~/backups/"$name".tar.gz -C "$(dirname "$1")" "$name"\necho "saved ~/backups/$name.tar.gz"\n```\n\nTo run the file as a program it needs the `x` bit (`chmod u+x backup.sh`), and it is started by its path: `./backup.sh ~/site`, or from a directory in PATH. `bash backup.sh ~/site` works without the bit — here the program is `bash` and the file is its argument.\n\nThe script’s arguments are `$1`, `$2` and so on, `$#` is how many there are, `"$@"` is all of them, each as a separate word. `$(command)` substitutes a command’s output: `name=$(basename "$1")`. Quotes around `"$1"` are always needed: without them a path with a space falls apart into two arguments.',
      ),
    },
    {
      id: 'logic',
      kind: 'text',
      step: 'explain',
      title: bi('Условия, циклы, ошибки', 'Conditions, loops, errors'),
      body: bi(
        'Условие в bash — это код завершения команды. `if команда; then … fi` выполняет ветку, если команда вернула 0. Чаще всего команда — `[ ]` (то же, что `test`): `[ -f file ]` — файл есть, `[ -d dir ]` — каталог есть, `[ "$a" = "$b" ]` — строки равны, `[ $n -gt 5 ]` — число больше. Пробелы внутри скобок обязательны: `[` — это команда, а `]` — её последний аргумент. Короткие формы: `команда && другая` — выполнить вторую, если первая удалась; `команда || другая` — если не удалась.\n\nЦикл `for f in *.log; do gzip "$f"; done` проходит по списку; `while read line; do …; done < file` — по строкам файла.\n\nПо умолчанию скрипт, в котором упала команда, спокойно идёт дальше — и следующая команда работает уже с мусором. Первая строка после shebang в серьёзных скриптах — `set -euo pipefail`: `-e` останавливает скрипт на первой ошибке, `-u` считает ошибкой незаданную переменную (опечатку в имени), `pipefail` — ошибку любой команды конвейера, а не только последней. А `exit N` завершает скрипт с нужным кодом — так скрипт сообщает, удался ли он, тому, кто его запустил.',
        'A condition in bash is the exit code of a command. `if command; then … fi` runs the branch if the command returned 0. Most often the command is `[ ]` (the same as `test`): `[ -f file ]` — the file exists, `[ -d dir ]` — the directory exists, `[ "$a" = "$b" ]` — the strings are equal, `[ $n -gt 5 ]` — the number is greater. The spaces inside the brackets are required: `[` is a command and `]` its last argument. The short forms: `command && other` runs the second if the first succeeded; `command || other` if it failed.\n\nThe loop `for f in *.log; do gzip "$f"; done` goes through a list; `while read line; do …; done < file` through the lines of a file.\n\nBy default a script in which a command failed calmly goes on — and the next command works with garbage. The first line after the shebang in serious scripts is `set -euo pipefail`: `-e` stops the script at the first error, `-u` treats an unset variable (a typo in a name) as an error, `pipefail` the failure of any command in a pipeline, not just the last. And `exit N` ends the script with the code you choose — that is how a script tells whoever started it whether it worked.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { files: [{ path: '~/site/index.html', content: '<h1>Edu Cafe</h1>\n' }, { path: '~/site/menu.html', content: '<h1>Menu</h1>\n' }, { path: '~/bin', type: 'd' }], env: { PATH: '/home/learner/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' } },
      intro: bi("Файлы удобно писать через `cat > файл <<'EOF'` … `EOF`: строки между ними попадут в файл как есть.", "Files are easy to write with `cat > file <<'EOF'` … `EOF`: the lines between them go into the file as they are."),
      tasks: [
        {
          id: 'backup',
          prompt: bi('Напишите скрипт `~/bin/backup.sh`, который упаковывает каталог из первого аргумента в `~/backups/<имя каталога>.tar.gz`, и сохраните им `~/site`. Скрипт должен запускаться по имени `backup.sh`.', 'Write a script `~/bin/backup.sh` that packs the directory from its first argument into `~/backups/<directory name>.tar.gz`, and back up `~/site` with it. The script must run by its name, `backup.sh`.'),
          check: {
            when: scriptOk,
            fail: [
              { if: (f) => !!f.files['/home/learner/bin/backup.sh'] && !/x/.test(String((f.files['/home/learner/bin/backup.sh'] as { perm?: { u: string } }).perm?.u ?? '')), say: bi('У файла нет бита x — запустить его как программу нельзя: `chmod u+x ~/bin/backup.sh`.', 'The file has no x bit — it cannot run as a program: `chmod u+x ~/bin/backup.sh`.') },
              { if: (f) => !!f.files['/home/learner/bin/backup.sh'] && !/^#!/.test(text(f, '/home/learner/bin/backup.sh')), say: bi('Первая строка скрипта должна говорить, чем его выполнять: `#!/bin/bash`.', 'The first line of the script must say what runs it: `#!/bin/bash`.') },
            ],
          },
          chips: "cat > ~/bin/backup.sh <<'EOF'",
          hints: {
            H1: bi('Три части: shebang, проверка аргумента, `tar`.', 'Three parts: the shebang, a check of the argument, `tar`.'),
            H2: bi('Возьмите скрипт из текста урока; не забудьте `chmod u+x`.', 'Take the script from the lesson text; do not forget `chmod u+x`.'),
            H3: bi('`backup.sh ~/site` после `chmod u+x ~/bin/backup.sh`.', '`backup.sh ~/site` after `chmod u+x ~/bin/backup.sh`.'),
          },
        },
        {
          id: 'usage',
          prompt: bi('Запустите `backup.sh` без аргументов: он должен завершиться с кодом 1 и объяснить, как им пользоваться.', 'Run `backup.sh` with no arguments: it must exit with code 1 and explain how to use it.'),
          check: { when: "term['main'][last].exit=1", stdout: /usage/i },
          chips: 'backup.sh',
          hints: { H1: bi('`$#` — число аргументов; `exit 1` — код.', '`$#` is the number of arguments; `exit 1` is the code.') },
        },
      ],
    },
    {
      id: 'xtrace',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Сделайте так, чтобы `~/bin/backup.sh` при каждом запуске печатал каждую команду перед тем, как её выполнить. В уроке этого не было — найдите сами.', 'Make `~/bin/backup.sh` print every command before running it, on every run. The lesson did not cover this — find it yourself.'),
      ref: ref('help/set'),
      terminal: {
        setup: { files: [{ path: '~/bin/backup.sh', content: '#!/bin/bash\nname=$(basename "$1")\nmkdir -p ~/backups\ntar -czf ~/backups/"$name".tar.gz -C "$(dirname "$1")" "$name"\n', mode: '0755' }, { path: '~/site/index.html', content: 'x\n' }] },
        task: {
          id: 'xtrace',
          prompt: bi('Скрипт печатает каждую выполняемую команду.', 'The script prints every command it runs.'),
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
  title: bi('Пакеты', 'Packages'),
  summary: bi('Программы ставят не скачиванием файлов, а менеджером пакетов: он знает зависимости и помнит, какой файл откуда.', 'Programs are installed not by downloading files but with a package manager: it knows the dependencies and remembers which file came from where.'),
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
      body: bi('«Поставьте на сервер jq». Скачивать файл с сайта и класть его в `/usr/bin` не нужно — и даже опасно: кто потом вспомнит, откуда он, какой версии и что ему нужно для работы?', '“Install jq on the server.” Downloading a file from a website and putting it into `/usr/bin` is not needed — and even dangerous: who will later remember where it came from, which version it is and what it needs to work?'),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Пакеты и репозитории', 'Packages and repositories'),
      body: bi(
        '[[linux.package|Пакет]] — архив программы с описанием: имя, версия, какие файлы куда положить и какие ещё пакеты нужны для работы (зависимости). Менеджер пакетов ставит программу вместе со всеми зависимостями и записывает, что поставил. В Debian и Ubuntu это `apt` (а под ним — `dpkg`), в Red Hat-семействе — `dnf`, в Alpine — `apk`; идея везде одна.\n\nПакеты лежат на серверах — в [[linux.repo|репозиториях пакетов]], адреса которых перечислены в `/etc/apt/sources.list`. Работа в два шага:\n\n```\nsudo apt update          # скачать свежий список пакетов\nsudo apt install jq      # поставить пакет и его зависимости\n```\n\nБез `apt update` машина не знает, какие пакеты есть, и честно отвечает `Unable to locate package`. `apt show jq` описывает пакет, `apt search слово` ищет, `apt remove` удаляет (настройки в `/etc` остаются), `apt purge` — вместе с настройками.\n\n`dpkg` помнит каждый файл: `dpkg -L jq` — какие файлы поставил пакет, `dpkg -S /usr/bin/tree` — какому пакету принадлежит файл. Это первое, что спрашивают, когда на сервере нашлось что-то непонятное.\n\nСлужбы из пакетов в Debian запускаются сразу после установки: поставили nginx — он уже работает.',
        'A [[linux.package|package]] is an archive of a program with a description: the name, the version, which files go where, and which other packages it needs to work (dependencies). The package manager installs the program together with all its dependencies and records what it installed. On Debian and Ubuntu it is `apt` (with `dpkg` underneath), in the Red Hat family `dnf`, on Alpine `apk`; the idea is the same everywhere.\n\nPackages live on servers — in [[linux.repo|package repositories]], whose addresses are listed in `/etc/apt/sources.list`. It works in two steps:\n\n```\nsudo apt update          # download a fresh list of packages\nsudo apt install jq      # install the package and its dependencies\n```\n\nWithout `apt update` the machine does not know which packages exist and honestly answers `Unable to locate package`. `apt show jq` describes a package, `apt search word` searches, `apt remove` removes it (the settings in `/etc` stay), `apt purge` removes it with the settings.\n\n`dpkg` remembers every file: `dpkg -L jq` — which files a package installed, `dpkg -S /usr/bin/tree` — which package a file belongs to. That is the first thing to ask when you find something unclear on a server.\n\nServices from packages start right after installation on Debian: install nginx and it is already running.',
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
          prompt: bi('Поставьте пакет `jq`.', 'Install the `jq` package.'),
          check: { when: "files['/usr/bin/jq'].type=f", fail: [{ if: "term['main'][last].out~'Unable to locate'", say: bi('Машина не знает такого пакета: сначала скачайте список пакетов.', 'The machine does not know the package: download the package list first.') }] },
          chips: 'sudo apt update && sudo apt install jq',
          docRef: { url: 'https://manpages.debian.org/trixie/apt/apt.8.en.html', label: 'apt(8)' },
          hints: { H1: bi('Два шага: список пакетов, потом установка.', 'Two steps: the package list, then the installation.') },
        },
        {
          id: 'names',
          prompt: bi('Выведите из `~/orders.json` названия всех позиций, по одному в строке и без кавычек.', 'Print the names of all items from `~/orders.json`, one per line and without quotes.'),
          check: { stdout: /^espresso\nlatte\ntea\n$/ },
          chips: "jq -r '.items[].name' ~/orders.json",
          docRef: { url: 'https://jqlang.org/manual/', label: 'jq manual' },
          hints: { H1: bi('`.items[]` — каждый элемент массива, `.name` — поле; `-r` убирает кавычки.', '`.items[]` is every element of the array, `.name` a field; `-r` removes the quotes.') },
        },
      ],
    },
    {
      id: 'files',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Запишите в `~/jq-files.txt` список файлов, которые поставил пакет `jq`. Где искать — `dpkg(1)`.', 'Write into `~/jq-files.txt` the list of files the `jq` package installed. Where to look — `dpkg(1)`.'),
      ref: ref('man/dpkg.1'),
      terminal: {
        setup: { ext: { linux: { packages: ['jq'] } } },
        task: { id: 'jq-files', prompt: bi('`~/jq-files.txt` — файлы пакета jq.', '`~/jq-files.txt` — the files of the jq package.'), check: { when: pkgFilesOk }, docStep: 3, chips: 'dpkg', hints: { H1: bi('Ищите в OPTIONS действие, которое перечисляет файлы пакета.', 'Look in OPTIONS for the action that lists a package’s files.') } },
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
  title: bi('Службы, журналы и расписание', 'Services, logs and schedules'),
  summary: bi('systemd запускает службы, следит за ними и перезапускает. Unit-файл, start и enable, журнал, в котором видна причина падения, и cron.', 'systemd starts services, watches them and restarts them. The unit file, start and enable, the journal that shows why a service died, and cron.'),
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
      body: bi('«После перезагрузки сайт не поднялся». Вчера его запускали руками, и всё работало. Кто вообще запускает программы, когда машина включается, и куда они пишут, когда падают ночью?', '“After the reboot the site did not come up.” Yesterday it was started by hand and everything worked. Who starts programs when the machine powers on at all, and where do they write when they die at night?'),
    },
    {
      id: 'systemd',
      kind: 'text',
      step: 'explain',
      title: bi('Кто запускает службы', 'Who starts the services'),
      body: bi(
        '[[linux.daemon|Служба]] (демон) — программа, которая работает в фоне без терминала: веб-сервер, база данных, cron. Запускать их руками после каждой загрузки было бы безумием. Это делает [[linux.systemd|systemd]] — самый первый процесс системы, PID 1. Ядро запускает его сразу после загрузки, а дальше systemd поднимает всё остальное, следит за службами и перезапускает упавшие.\n\nЧто и как запускать, systemd читает из [[linux.unit|unit-файлов]]. Свои кладут в `/etc/systemd/system/`, файлы из пакетов лежат в `/usr/lib/systemd/system/`:\n\n```ini\n[Unit]\nDescription=Web demo\nAfter=network-online.target\n\n[Service]\nExecStart=/usr/local/bin/web-demo --port 8080\nUser=learner\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n```\n\n`[Unit]` — описание и порядок запуска, `[Service]` — что запускать (`ExecStart=`, полный путь), от какого пользователя (`User=`) и что делать при падении (`Restart=`), `[Install]` — к какой цели загрузки подключить службу.',
        'A [[linux.daemon|service]] (a daemon) is a program that runs in the background without a terminal: a web server, a database, cron. Starting them by hand after every boot would be madness. [[linux.systemd|systemd]] does it — the very first process of the system, PID 1. The kernel starts it right after booting, and from then on systemd brings up everything else, watches the services and restarts those that die.\n\nWhat to start and how, systemd reads from [[linux.unit|unit files]]. Your own go into `/etc/systemd/system/`; those from packages live in `/usr/lib/systemd/system/`:\n\n```ini\n[Unit]\nDescription=Web demo\nAfter=network-online.target\n\n[Service]\nExecStart=/usr/local/bin/web-demo --port 8080\nUser=learner\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n```\n\n`[Unit]` is the description and the start order, `[Service]` what to run (`ExecStart=`, a full path), as which user (`User=`) and what to do when it dies (`Restart=`), `[Install]` which boot target to attach the service to.',
      ),
    },
    { id: 'boot', kind: 'explainer', step: 'look', explainer: 'linux.boot', caption: bi('От включения до приглашения. Попробуйте rescue.target и сломанный fstab.', 'From power-on to the prompt. Try rescue.target and a broken fstab.') },
    {
      id: 'not-everywhere',
      kind: 'callout',
      tone: 'note',
      title: bi('systemd есть не везде', 'systemd is not everywhere'),
      body: bi(
        'systemd стоит на Debian, Ubuntu, RHEL и большинстве серверов, поэтому этот урок о нём. Но это не единственная система запуска служб. В конце блока вы будете работать на настоящих машинах с Alpine Linux, и там службы запускает другая система, попроще; задачи у неё те же — запустить, включить при загрузке, перезапустить после падения, — меняются только команды и файлы.',
        'systemd runs on Debian, Ubuntu, RHEL and most servers, which is why this lesson is about it. But it is not the only service manager. At the end of the block you will work on real machines with Alpine Linux, where a different, simpler system starts the services; its jobs are the same — start, enable at boot, restart after a crash — only the commands and the files change.',
      ),
    },
    {
      id: 'systemctl',
      kind: 'text',
      step: 'explain',
      title: bi('start и enable — разные вещи', 'start and enable are different things'),
      body: bi(
        'Службами управляет `systemctl`:\n\n- `systemctl start web` — запустить сейчас; `stop` — остановить; `restart` — перезапустить;\n- `systemctl enable web` — запускать при загрузке (создаётся ссылка в `multi-user.target.wants/`); `disable` — не запускать; `enable --now` — и то и другое сразу;\n- `systemctl status web` — состояние, номер главного процесса и последние строки журнала;\n- `systemctl daemon-reload` — перечитать unit-файлы после правки. Пока его не сделали, systemd работает со старой версией и предупреждает об этом.\n\nВот и ответ про сайт после перезагрузки: `start` без `enable` действует только до перезагрузки.\n\nВсё, что служба пишет в вывод и ошибки, systemd собирает в [[linux.journal|журнал]] — ничего настраивать не нужно. `journalctl -u web` — журнал одной службы, `-n 20` — последние 20 строк, `-f` — следить за новыми, `-p err` — только ошибки, `-b` — с последней загрузки. Когда служба упала, первая команда — `systemctl status`, вторая — `journalctl -u`.',
        'Services are managed with `systemctl`:\n\n- `systemctl start web` — start now; `stop` — stop; `restart` — restart;\n- `systemctl enable web` — start at boot (a link is created in `multi-user.target.wants/`); `disable` — do not; `enable --now` — both at once;\n- `systemctl status web` — the state, the number of the main process and the last lines of the journal;\n- `systemctl daemon-reload` — re-read the unit files after an edit. Until you do it, systemd keeps working with the old version and warns about it.\n\nThat answers the question about the site after the reboot: `start` without `enable` lasts only until the reboot.\n\nEverything a service writes to its output and errors, systemd collects into the [[linux.journal|journal]] — nothing to configure. `journalctl -u web` is the journal of one service, `-n 20` the last 20 lines, `-f` follows new ones, `-p err` errors only, `-b` since the last boot. When a service has died, the first command is `systemctl status`, the second `journalctl -u`.',
      ),
    },
    { id: 'restart', kind: 'explainer', step: 'look', explainer: 'linux.restart', caption: bi('Поиграйте с Restart= и RestartSec=: когда systemd сдаётся?', 'Play with Restart= and RestartSec=: when does systemd give up?') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: servicesSetup,
      tasks: [
        {
          id: 'fix-report',
          prompt: bi('Служба `report` не работает. Выясните по журналу почему, исправьте причину (содержимое файла не важно) и добейтесь, чтобы служба была active.', 'The `report` service is not working. Find out why from the journal, fix the cause (the file’s contents do not matter) and get the service active.'),
          check: {
            when: (f) => units(f)['report.service']?.active === 'active',
            fail: [{ if: (f) => !!f.files['/etc/report.conf'] && units(f)['report.service']?.active === 'failed', say: bi('Причину вы убрали, но systemd уже сдался: попыток было слишком много. Сбросьте счётчик `systemctl reset-failed report` и запустите снова.', 'You removed the cause, but systemd has already given up: there were too many attempts. Reset the counter with `systemctl reset-failed report` and start it again.') }],
          },
          chips: 'systemctl status report; journalctl -u report',
          docRef: ref('man/journalctl.1', 'OPTIONS', '-u, --unit'),
          hints: {
            H1: bi('Сначала `systemctl status report`, потом журнал службы.', 'First `systemctl status report`, then the service’s journal.'),
            H2: bi('В журнале написано, какого файла не хватает. Создайте его через sudo.', 'The journal says which file is missing. Create it with sudo.'),
            H3: bi('`sudo touch /etc/report.conf`, затем `sudo systemctl reset-failed report && sudo systemctl start report`.', '`sudo touch /etc/report.conf`, then `sudo systemctl reset-failed report && sudo systemctl start report`.'),
          },
        },
        {
          id: 'web',
          prompt: bi('Сделайте службу `web` из программы `/usr/local/bin/web-demo --port 8080`: от пользователя `learner`, с перезапуском при падении, запущенную сейчас и при каждой загрузке.', 'Make a `web` service out of the program `/usr/local/bin/web-demo --port 8080`: running as `learner`, restarted when it dies, started now and at every boot.'),
          check: {
            when: (f) => {
              const u = units(f)['web.service'];
              return !!u && u.active === 'active' && u.enabled === 'enabled' && u.props.User === 'learner' && /on-failure|always/.test(u.props.Restart ?? '') && !u.stale;
            },
            fail: [
              { if: (f) => units(f)['web.service']?.active === 'active' && units(f)['web.service']?.enabled !== 'enabled', say: bi('Служба работает, но после перезагрузки не поднимется: нужен `enable`.', 'The service runs but will not come back after a reboot: it needs `enable`.') },
              { if: (f) => !!units(f)['web.service']?.stale, say: bi('Файл изменён, а systemd помнит старую версию: `sudo systemctl daemon-reload`.', 'The file changed but systemd remembers the old version: `sudo systemctl daemon-reload`.') },
              { if: (f) => !!units(f)['web.service'] && units(f)['web.service'].props.User !== 'learner', say: bi('Служба работает от root: добавьте `User=learner` в `[Service]`.', 'The service runs as root: add `User=learner` to `[Service]`.') },
            ],
          },
          chips: "sudo tee /etc/systemd/system/web.service <<'EOF'",
          docRef: { url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html', label: 'systemd.service(5)' },
          hints: {
            H1: bi('Unit-файл из текста урока подходит почти целиком.', 'The unit file from the lesson text fits almost as it is.'),
            H2: bi('Файл — в `/etc/systemd/system/web.service` (через `sudo tee`), затем `daemon-reload` и `enable --now`.', 'The file goes to `/etc/systemd/system/web.service` (with `sudo tee`), then `daemon-reload` and `enable --now`.'),
          },
        },
        {
          id: 'cron',
          prompt: bi('Поставьте `~/bin/backup.sh` в расписание: каждую ночь в 02:30.', 'Schedule `~/bin/backup.sh`: every night at 02:30.'),
          check: { when: (f) => /^\s*30\s+0?2\s+\*\s+\*\s+\*\s+\S*backup\.sh/m.test(text(f, '/var/spool/cron/crontabs/learner')) },
          chips: "echo '30 2 * * * /home/learner/bin/backup.sh' | crontab -",
          docRef: ref('man/crontab.1', 'DESCRIPTION', 'minute hour day-of-month month day-of-week'),
          hints: { H1: bi('Пять полей: минута, час, день месяца, месяц, день недели. Звёздочка — «любой».', 'Five fields: minute, hour, day of month, month, day of week. A star means “any”.'), H2: bi('`crontab -` читает таблицу со стандартного ввода.', '`crontab -` reads the table from standard input.') },
        },
      ],
    },
    {
      id: 'cron-text',
      kind: 'text',
      step: 'explain',
      title: bi('Расписание', 'Schedules'),
      body: bi(
        '[[linux.cron|cron]] — служба, которая каждую минуту просматривает таблицы расписаний (crontab) и выполняет то, что пора. Строка таблицы — пять полей времени и команда:\n\n```\n# минута час день месяц день-недели  команда\n30 2 * * *   /home/learner/bin/backup.sh >> /home/learner/backup.log 2>&1\n*/15 9-18 * * 1-5   /usr/local/bin/check-queue\n```\n\nПервая строка — каждую ночь в 02:30, вторая — каждые 15 минут с 9 до 18 по будням. Свою таблицу показывает `crontab -l`, ставит из файла — `crontab файл`. Главная ловушка: команда из cron работает без вашего окружения — с коротким PATH и без `~/.bashrc`. Поэтому в crontab пишут полные пути и перенаправляют вывод в файл, иначе ошибки будет некому увидеть.',
        '[[linux.cron|cron]] is the service that looks through the schedule tables (crontabs) every minute and runs whatever is due. A line of the table is five time fields and a command:\n\n```\n# minute hour day month weekday  command\n30 2 * * *   /home/learner/bin/backup.sh >> /home/learner/backup.log 2>&1\n*/15 9-18 * * 1-5   /usr/local/bin/check-queue\n```\n\nThe first line is every night at 02:30, the second every 15 minutes from 9 to 18 on weekdays. `crontab -l` shows your table, `crontab file` installs one from a file. The main trap: a command from cron runs without your environment — with a short PATH and without `~/.bashrc`. That is why crontabs use full paths and redirect the output to a file; otherwise nobody will see the errors.',
      ),
    },
    {
      id: 'limit',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Служба `flappy` падает и перезапускается без конца. Сделайте так, чтобы systemd перезапускал её не больше 3 раз за минуту, а потом оставлял в состоянии failed. Директив для этого в уроке не было.', 'The `flappy` service dies and restarts endlessly. Make systemd restart it at most 3 times a minute and then leave it failed. The lesson had no directives for this.'),
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
          prompt: bi('flappy: не больше 3 запусков за 60 секунд.', 'flappy: at most 3 starts in 60 seconds.'),
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
  summary: bi('Диск — раздел — файловая система — точка в дереве. Плюс inode и ссылки, и почему `df` и `du` иногда спорят.', 'Disk — partition — file system — a point in the tree. Plus inodes and links, and why `df` and `du` sometimes disagree.'),
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
      body: bi('«Добавили серверу диск на 64 гигабайта, а места не прибавилось». Диск есть, система его видит — но в дереве файлов его нет. Подключить диск к Linux — это три отдельных шага, и каждый можно забыть.', '“We added a 64 GB disk to the server and got no more space.” The disk is there, the system sees it — but it is not in the tree of files. Attaching a disk in Linux takes three separate steps, and each can be forgotten.'),
    },
    {
      id: 'chain',
      kind: 'text',
      step: 'explain',
      title: bi('Диск, раздел, файловая система, точка', 'Disk, partition, file system, mount point'),
      body: bi(
        '[[linux.block-device|Блочное устройство]] — это диск целиком (`/dev/sdb`) или его раздел (`/dev/sdb1`): кусок, описанный таблицей разделов. Сам по себе диск — просто ряд блоков. Чтобы на нём жили файлы, на нём создают [[linux.filesystem|файловую систему]] — способ хранить имена, права и данные: `sudo mkfs.ext4 /dev/sdb`. Это стирает всё, что было на устройстве.\n\nДальше файловую систему подключают в какую-нибудь точку дерева — это [[linux.mount|монтирование]]:\n\n```\nsudo mkdir /data\nsudo mount /dev/sdb /data\n```\n\nТеперь всё, что лежит в `/data`, на самом деле лежит на новом диске. Если в `/data` раньше были файлы, они не удалены — просто скрыты под новой файловой системой и появятся снова после `umount /data`. `lsblk` показывает диски и разделы, `findmnt` и `mount` без аргументов — что куда смонтировано, `df -h` — сколько места свободно на каждой файловой системе.\n\nМонтирование руками живёт до перезагрузки. Чтобы диск подключался всегда, строку пишут в `/etc/fstab`:\n\n```\nUUID=6d1f…  /data  ext4  defaults  0  2\n```\n\nUUID — номер самой файловой системы, его показывает `blkid`. Имя `/dev/sdb` использовать не стоит: подключат ещё один диск — и имена сдвинутся. Ошибка в fstab — одна из немногих вещей, из-за которых сервер не загружается вовсе, поэтому после правки проверяют `sudo mount -a`.\n\nЕсть файловые системы и без диска: tmpfs живёт в памяти и пустеет при перезагрузке — так устроен `/tmp`. А `mount --bind каталог другое-место` показывает один каталог ещё в одном месте дерева.',
        'A [[linux.block-device|block device]] is a whole disk (`/dev/sdb`) or a partition of it (`/dev/sdb1`): a piece described by a partition table. A disk by itself is just a row of blocks. For files to live on it, you create a [[linux.filesystem|file system]] on it — a way to keep names, modes and data: `sudo mkfs.ext4 /dev/sdb`. That wipes whatever was on the device.\n\nThen the file system is attached at some point of the tree — that is [[linux.mount|mounting]]:\n\n```\nsudo mkdir /data\nsudo mount /dev/sdb /data\n```\n\nNow everything in `/data` actually lives on the new disk. If `/data` had files before, they are not deleted — just hidden under the new file system, and they reappear after `umount /data`. `lsblk` shows disks and partitions, `findmnt` and `mount` without arguments what is mounted where, `df -h` how much space is free on each file system.\n\nA mount made by hand lasts until the reboot. To attach the disk always, a line goes into `/etc/fstab`:\n\n```\nUUID=6d1f…  /data  ext4  defaults  0  2\n```\n\nThe UUID is the number of the file system itself; `blkid` shows it. Using the name `/dev/sdb` is a bad idea: attach one more disk and the names shift. A mistake in fstab is one of the few things that stop a server from booting at all, so after an edit you check with `sudo mount -a`.\n\nThere are file systems without a disk: tmpfs lives in memory and empties at reboot — that is how `/tmp` works. And `mount --bind dir other-place` shows one directory at another place in the tree as well.',
      ),
    },
    {
      id: 'inode',
      kind: 'text',
      step: 'explain',
      title: bi('Имя и inode', 'A name and an inode'),
      body: bi(
        'Файл на файловой системе — это не имя. Это [[linux.inode|inode]]: запись с владельцем, правами, размером и адресом данных; `ls -i` показывает её номер. Имя в каталоге — лишь ссылка на inode. Поэтому `mv` внутри одной файловой системы мгновенный — меняется только ссылка, данные не двигаются.\n\nЖёсткая ссылка (`ln файл второе-имя`) — второе имя того же inode: изменили через одно — видно через другое, а данные живут, пока жива хоть одна ссылка. Символическая ссылка (`ln -s куда имя`) — маленький файл, в котором записан путь; удалите цель — ссылка останется, но будет вести в никуда. Символические ссылки — обычный способ держать «текущую версию»: `current -> releases/v2`.\n\nИз этого вытекает загадка, которая ставит в тупик даже опытных: `df` показывает, что диск полон, а `du` по всем каталогам насчитывает намного меньше. Значит, где-то есть удалённый файл, который до сих пор держит открытым какой-то процесс: имени уже нет, а inode и данные живы, пока процесс его не закроет. `du` считает имена, `df` — занятые блоки.',
        'A file on a file system is not a name. It is an [[linux.inode|inode]]: a record with the owner, mode, size and where the data is; `ls -i` shows its number. A name in a directory is only a link to an inode. That is why `mv` within one file system is instant — only the link changes, the data does not move.\n\nA hard link (`ln file second-name`) is a second name of the same inode: change it through one and it shows through the other, and the data lives while at least one link is alive. A symbolic link (`ln -s target name`) is a small file holding a path; delete the target and the link stays but leads nowhere. Symbolic links are the usual way to keep a “current version”: `current -> releases/v2`.\n\nThis explains a riddle that puzzles even experienced people: `df` says the disk is full while `du` over all directories counts far less. It means some deleted file is still held open by some process: the name is gone, but the inode and the data live until the process closes it. `du` counts names, `df` counts used blocks.',
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
          prompt: bi('На машину добавили пустой диск `/dev/sdb`. Создайте на нём файловую систему ext4 и смонтируйте его в `/data`.', 'An empty disk `/dev/sdb` was added to the machine. Create an ext4 file system on it and mount it at `/data`.'),
          check: {
            when: "mounts[target='/data'].source='/dev/sdb'",
            fail: [{ if: "term['main'][last].out~'wrong fs type'", say: bi('На диске ещё нет файловой системы: её создаёт `mkfs.ext4`.', 'The disk has no file system yet: `mkfs.ext4` creates one.') }],
          },
          chips: 'sudo mkfs.ext4 /dev/sdb && sudo mount /dev/sdb /data',
          docRef: ref('man/mount.8', 'DESCRIPTION'),
          hints: { H1: bi('Два шага: файловая система, потом монтирование.', 'Two steps: a file system, then mounting.'), H2: bi('Посмотрите `ls /data` до и после: куда делся README?', 'Look at `ls /data` before and after: where did the README go?') },
        },
        {
          id: 'fstab',
          prompt: bi('Сделайте так, чтобы диск монтировался в `/data` при каждой загрузке — по UUID, а не по имени устройства.', 'Make the disk mount at `/data` at every boot — by UUID, not by the device name.'),
          check: {
            when: (f) => /^\s*UUID=[0-9a-f-]{36}\s+\/data\s+ext4\s+\S+/m.test(text(f, '/etc/fstab')),
            fail: [{ if: (f) => /^\s*\/dev\/sdb\s+\/data/m.test(text(f, '/etc/fstab')), say: bi('По имени устройства работает, пока не подключат ещё один диск: возьмите UUID из `sudo blkid`.', 'The device name works until another disk is attached: take the UUID from `sudo blkid`.') }],
          },
          chips: 'sudo blkid',
          docRef: ref('man/mount.8', 'THE FILES /ETC/FSTAB'),
          hints: { H1: bi('Строка fstab: что, куда, тип, параметры, два числа.', 'An fstab line: what, where, type, options, two numbers.'), H2: bi("`echo 'UUID=… /data ext4 defaults 0 2' | sudo tee -a /etc/fstab`", "`echo 'UUID=… /data ext4 defaults 0 2' | sudo tee -a /etc/fstab`") },
        },
        {
          id: 'link',
          prompt: bi('Сделайте в домашнем каталоге символическую ссылку `current`, которая ведёт на `releases/v2`.', 'Make a symbolic link `current` in your home directory that leads to `releases/v2`.'),
          check: { when: "files['/home/learner/current'].type=l && files['/home/learner/current'].target~'releases/v2'" },
          chips: 'ln -s releases/v2 ~/current',
          docRef: ref('man/ln.1', 'OPTIONS', '-s, --symbolic'),
          hints: { H1: bi('`ln -s куда имя`.', '`ln -s target name`.') },
        },
        {
          id: 'tmpfs',
          prompt: bi('Смонтируйте в `/mnt/scratch` файловую систему в памяти размером 16 мегабайт.', 'Mount an in-memory file system of 16 megabytes at `/mnt/scratch`.'),
          check: { when: "mounts[target='/mnt/scratch'].type=tmpfs && mounts[target='/mnt/scratch'].options~'size=16384k'" },
          chips: 'sudo mkdir -p /mnt/scratch && sudo mount -t tmpfs -o size=16m tmpfs /mnt/scratch',
          docRef: ref('man/mount.8', 'OPTIONS', '-o, --options'),
          hints: { H1: bi('Тип — tmpfs, размер — параметр `-o size=…`.', 'The type is tmpfs; the size is the option `-o size=…`.') },
        },
      ],
    },
    {
      id: 'inodes',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Место на диске кончается не только байтами: у файловой системы ограничено и число inode. Узнайте, сколько свободных inode осталось на `/`, и запишите одно это число в `~/inodes.txt`.', 'A disk runs out not only of bytes: a file system has a limited number of inodes too. Find out how many free inodes are left on `/` and write just that number into `~/inodes.txt`.'),
      ref: ref('man/df.1'),
      terminal: {
        setup: {},
        task: {
          id: 'inodes',
          prompt: bi('`~/inodes.txt` — свободные inode на `/`.', '`~/inodes.txt` — free inodes on `/`.'),
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
