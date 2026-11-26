// Block exams written in the exam frame (10 §6.1) for blocks whose own
// exam is not delivered yet. Each is a story told in business words, checked
// by the state of the machine (any way to the state counts), with a critical
// task, at least 10% of the weight beyond the course (no hints, DL5), a soft
// timer and two "explain" questions that give the interview-readiness mark.
// They run on the shell commands of the simulator; a block's own exam, when
// it arrives, is listed first on the block page.

import { bi } from '../../core/i18n';
import type { Exam, Facts } from '../../core/types';
import { gitSetup, head, PAGES, repo } from '../git-cicd/content/common';

const HOME = '/home/learner';
const text = (f: Facts, path: string) => f.files[path]?.text ?? '';

const LOG = [
  '2026-11-18 14:02:11 INFO  checkout started id=8812',
  '2026-11-18 14:02:12 ERROR payment gateway timeout id=8812',
  '2026-11-18 14:03:40 INFO  checkout started id=8813',
  '2026-11-18 14:03:41 INFO  checkout done id=8813',
  '2026-11-18 14:05:02 ERROR db connection refused id=8814',
  '2026-11-18 14:05:09 WARN  retrying db id=8814',
  '2026-11-18 14:06:30 ERROR payment gateway timeout id=8815',
  '2026-11-18 14:07:55 INFO  checkout done id=8816',
].join('\n') + '\n';

const ACCESS = [
  '198.51.100.7 - - [18/Nov/2026:14:02:12 +0300] "POST /checkout HTTP/2.0" 504 160',
  '198.51.100.9 - - [18/Nov/2026:14:02:15 +0300] "GET / HTTP/2.0" 200 5120',
  '198.51.100.7 - - [18/Nov/2026:14:03:41 +0300] "POST /checkout HTTP/2.0" 200 88',
  '203.0.113.4 - - [18/Nov/2026:14:05:02 +0300] "POST /checkout HTTP/2.0" 504 160',
  '203.0.113.5 - - [18/Nov/2026:14:05:30 +0300] "GET /health HTTP/2.0" 200 2',
  '198.51.100.7 - - [18/Nov/2026:14:06:30 +0300] "POST /checkout HTTP/2.0" 504 160',
].join('\n') + '\n';

const mine = { owner: 'learner', group: 'learner' };
const setupFiles = [
  { path: `${HOME}/shop`, type: 'd' as const, mode: '0755', ...mine },
  { path: `${HOME}/shop/config`, type: 'd' as const, mode: '0755', ...mine },
  { path: `${HOME}/shop/data`, type: 'd' as const, mode: '0755', ...mine },
  { path: `${HOME}/shop/config/app.env`, content: 'DB_HOST=db\nDB_PORT=5432\n', mode: '0644', ...mine },
  { path: `${HOME}/shop/data/orders.db`, content: 'orders v3\n', mode: '0644', ...mine },
  { path: `${HOME}/shop/data/.lock`, content: '4120\n', mode: '0644', ...mine },
  { path: '/var/log/shop/app.log', content: LOG, mode: '0644', owner: 'root' },
  { path: '/var/log/shop/access.log', content: ACCESS, mode: '0644', owner: 'root' },
];

export const LINUX_EXAM: Exam = {
  id: 'linux.exam.first-day',
  block: 'linux',
  kind: 'block',
  title: bi('Linux: первый день на сервере', 'Linux: the first day on the server'),
  intro: bi(
    'Пять карточек из трекера задач небольшого интернет-магазина. Каждую карточку проверяют по состоянию машины, а не по набранным командам, поэтому подходит любой путь к результату. Подсказок нет, а из документации открыта только встроенная справка, то есть страницы `man` и вывод `--help`.',
    'Five cards from a small shop’s tracker. Each is checked by the state of the machine, not by the commands you type: any way works. There are no hints; only the built-in documentation is open — `man` and `--help`.',
  ),
  story: bi(
    'Сегодня ваш первый день в интернет-магазине «Ларёк». Сайт и база данных кое-как работают на одном сервере, а утром покупатели жаловались, что не проходит оплата. Руководитель команды оставил в трекере пять карточек и ушёл на встречу.',
    'It is your first day at a small online shop. The site and the database run on one server “somehow”, and customers complained about checkout this morning. The team lead left five cards in the tracker and went to a meeting.',
  ),
  minutes: 45,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  explain: [
    {
      id: 'e1',
      prompt: bi('Руководитель команды спрашивает: «Чем `>` отличается от `>>` и почему это важно, когда правите конфигурацию?» Ответьте ему.', 'The team lead asks: “How does `>` differ from `>>`, and why does it matter when you edit configuration?” Answer.'),
      keyPoints: [bi('`>` открывает файл, предварительно опустошив его, и старое содержимое пропадает', '`>` opens the file truncated: the old content is gone'), bi('`>>` дописывает текст в конец файла', '`>>` appends at the end'), bi('перенаправление выполняет оболочка ещё до запуска команды', 'the shell does the redirection before the command starts'), bi('перед правкой конфигурации нужно сделать копию или проверить результат', 'before editing configuration: a copy or a check')],
    },
    {
      id: 'e2',
      prompt: bi('«В журнале миллион строк, а `grep ERROR` выдаёт тысячи. Как вы будете искать причину?»', '“The log has a million lines and `grep ERROR` prints thousands. How will you look for the cause?”'),
      keyPoints: [bi('сузить поиск до времени, когда начался симптом', 'narrow by the time the symptom started'), bi('сгруппировать похожие ошибки и посчитать их', 'count and group similar errors'), bi('связать ошибки с запросами по идентификатору', 'link to the requests by an id'), bi('собрать конвейер из простых команд, а не просматривать журнал глазами', 'a pipeline of simple commands, not reading by eye')],
    },
  ],
  tasks: [
    {
      id: 'dirs',
      weight: 20,
      critical: true,
      kind: 'task',
      setup: { files: setupFiles },
      task: {
        id: 'dirs',
        prompt: bi('Карточка 1. «Приложению нужен каталог для журналов `~/shop/logs`. И сразу заведите каталог `~/shop/backup`, в котором будут храниться копии конфигурации».', 'Card 1. “The application needs a log directory: `~/shop/logs`. And create `~/shop/backup` right away — for config copies.”'),
        concepts: [],
        check: { when: `files['${HOME}/shop/logs'].type=d && files['${HOME}/shop/backup'].type=d && files['${HOME}/shop/data/orders.db']` },
      },
    },
    {
      id: 'env',
      weight: 25,
      kind: 'task',
      setup: { files: setupFiles },
      task: {
        id: 'env',
        prompt: bi('Карточка 2. «Приложение должно слушать порт 8080. Допишите строку `PORT=8080` в файл `~/shop/config/app.env` так, чтобы не потерять ничего из того, что в нём уже есть».', 'Card 2. “The application must listen on port 8080: add `PORT=8080` to `~/shop/config/app.env` without losing anything already there.”'),
        check: {
          when: `files['${HOME}/shop/config/app.env'].text ~ 'PORT=8080' && files['${HOME}/shop/config/app.env'].text ~ 'DB_HOST=db' && files['${HOME}/shop/config/app.env'].text ~ 'DB_PORT=5432'`,
          fail: [{ if: `files['${HOME}/shop/config/app.env'].text ~ 'PORT=8080' && !(files['${HOME}/shop/config/app.env'].text ~ 'DB_HOST=db')`, say: bi('Строка появилась, но прежние настройки пропали, потому что файл был перезаписан.', 'The line is there, but the old settings are gone: the file was overwritten.') }],
        },
      },
    },
    {
      id: 'errors-a',
      weight: 25,
      pool: 'logs',
      kind: 'task',
      setup: { files: setupFiles },
      task: {
        id: 'errors-a',
        prompt: bi('Карточка 3. «Соберите в файл `~/errors.txt` все строки со словом ERROR из журнала `/var/log/shop/app.log`, и только их: я хочу показать их разработчикам».', 'Card 3. “Put every ERROR line from `/var/log/shop/app.log` into `~/errors.txt` — and only those: I want to show them to the developers.”'),
        check: {
          when: (f) => {
            const lines = text(f, `${HOME}/errors.txt`).split('\n').filter(Boolean);
            return lines.length === 3 && lines.every((l) => l.includes('ERROR'));
          },
        },
      },
    },
    {
      id: 'errors-b',
      weight: 25,
      pool: 'logs',
      kind: 'task',
      setup: { files: setupFiles },
      task: {
        id: 'errors-b',
        prompt: bi('Карточка 3. «Соберите в файл `~/504.txt` все строки журнала доступа `/var/log/shop/access.log`, в которых сервер ответил кодом 504, и только их».', 'Card 3. “Put every line of the access log `/var/log/shop/access.log` where the server answered 504 into `~/504.txt` — and only those.”'),
        check: {
          when: (f) => {
            const lines = text(f, `${HOME}/504.txt`).split('\n').filter(Boolean);
            return lines.length === 3 && lines.every((l) => l.includes('" 504 '));
          },
        },
      },
    },
    {
      id: 'lock',
      weight: 15,
      kind: 'task',
      setup: { files: setupFiles },
      task: {
        id: 'lock',
        prompt: bi('Карточка 4. «После вчерашнего аварийного завершения приложения остался устаревший файл блокировки `~/shop/data/.lock`. Удалите его, а данные не трогайте».', 'Card 4. “A stale lock file `~/shop/data/.lock` is left after yesterday’s crash — remove it, leave the data alone.”'),
        check: {
          when: `!files['${HOME}/shop/data/.lock'] && files['${HOME}/shop/data/orders.db'].text ~ 'orders v3'`,
          fail: [{ if: `!files['${HOME}/shop/data/orders.db']`, say: bi('Вместе с файлом блокировки пропали и данные заказов.', 'The orders data is gone together with the lock.') }],
        },
      },
    },
    {
      id: 'count',
      weight: 15,
      beyond: true,
      kind: 'task',
      setup: { files: setupFiles },
      task: {
        id: 'count',
        prompt: bi('Карточка 5. «Сколько раз за утро не ответил платёжный шлюз? Запишите одно число в файл `~/gateway.txt`». Этой задачи не было в курсе, и ответ нужно найти в документации.', 'Card 5. “How many times did the payment gateway fail this morning? Write a single number into `~/gateway.txt`.” This task is beyond the course: the answer is in the documentation.'),
        docStep: 5,
        beyond: true,
        docRef: { page: 'man/grep.1', anchor: 'OPTIONS' },
        solutionTokens: ['-c', '--count', 'wc -l'],
        check: { when: (f) => text(f, `${HOME}/gateway.txt`).trim() === '2' },
      },
    },
  ],
};

const TYPO = PAGES['index.html'].replace('<h1>Edu Cafe</h1>', '<h1>Edu Cafe!</h1>');
const MENU = '<!doctype html>\n<title>Menu</title>\n<h1>Menu</h1>\n<p>Espresso, flat white, cocoa.</p>\n';

export const GIT_EXAM: Exam = {
  id: 'git-yaml.exam.cafe',
  block: 'git-yaml',
  kind: 'block',
  title: bi('Git: сайт кафе', 'Git: the café site'),
  intro: bi(
    'Четыре карточки о репозитории сайта кафе. Проверяется состояние репозитория, то есть коммиты, ветки и файлы, а не набранные команды. Из документации открыта только встроенная справка Git.',
    'Four cards about the café site’s repository. The state of the repository is checked — commits, branches, files — not the commands you type. Only the built-in Git help is open.',
  ),
  story: bi(
    'Небольшая кофейня хранит свой сайт в Git. Прежний подрядчик ушёл и оставил репозиторий в беспорядке, и владелица просит навести порядок до завтрашней выкладки.',
    'A small coffee shop keeps its site in Git. The previous contractor left the repository in a mess; the owner asks you to tidy it up before tomorrow’s release.',
  ),
  minutes: 40,
  pass: 0.7,
  allowedDocs: ['git-help'],
  explain: [
    {
      id: 'e1',
      prompt: bi('Владелица спрашивает: «Мы же убрали файл с паролем из репозитория, значит, всё в порядке?» Ответьте ей.', 'The owner asks: “We removed the password file from the repository, so everything is fine?” Answer her.'),
      keyPoints: [bi('в старых коммитах пароль по-прежнему есть', 'the old commits still contain the password'), bi('историю репозитория уже скопировали другие люди', 'others have already copied the history'), bi('пароль нужно считать утёкшим и сменить', 'the password counts as leaked and is changed'), bi('в репозиторий кладут пример файла без настоящих значений', 'the repository gets an example without values')],
    },
    {
      id: 'e2',
      prompt: bi('«Почему вы отменили коммит новым коммитом, а не удалили его из истории?»', '“Why did you undo the commit with a new commit instead of just removing it from the history?”'),
      keyPoints: [bi('история уже лежит на сервере и у коллег', 'the history is already with colleagues on the server'), bi('переписанная история разойдётся с их копиями', 'a rewritten history diverges from their copies'), bi('отменяющий коммит виден в истории, и его самого тоже можно отменить', 'the undoing commit is visible and can itself be undone')],
    },
  ],
  tasks: [
    {
      id: 'menu',
      weight: 30,
      critical: true,
      kind: 'task',
      setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }], worktree: { 'menu.html': MENU, 'notes.txt': 'call the milk supplier\n' } }] }),
      task: {
        id: 'menu',
        prompt: bi('Карточка 1. «Новая страница `menu.html` должна попасть в ветку main отдельным коммитом. Файл `notes.txt` — мои личные заметки: в репозиторий их класть нельзя, но и удалять не надо».', 'Card 1. “The new `menu.html` page must land in main as a commit of its own. `notes.txt` is my personal notes: it must not go into the repository, but do not delete it either.”'),
        check: { when: (f) => repo(f)?.branch === 'main' && 'menu.html' in (head(f)?.files ?? {}) && !('notes.txt' in (head(f)?.files ?? {})) && !!f.files['/home/learner/site/notes.txt'] },
      },
    },
    {
      id: 'branch',
      weight: 25,
      kind: 'task',
      setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: { ...PAGES, 'index.html': TYPO } }] }] }),
      task: {
        id: 'branch',
        prompt: bi('Карточка 2. «В заголовке главной страницы лишний восклицательный знак: „Edu Cafe!“. Исправьте его в отдельной ветке `fix/title` и слейте её в main, так у нас принято».', 'Card 2. “The home page heading has a stray exclamation mark: “Edu Cafe!”. Fix it in a separate `fix/title` branch and merge it into main — that is how we work.”'),
        check: { when: (f) => repo(f)?.branch === 'main' && !!repo(f)?.branches['fix/title'] && (head(f)?.files['index.html'] ?? '').includes('<h1>Edu Cafe</h1>') },
      },
    },
    {
      id: 'secret',
      weight: 30,
      kind: 'task',
      setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }, { message: 'Add config', files: { '.env': 'DB_PASSWORD=hunter2\n' } }] }] }),
      task: {
        id: 'secret',
        prompt: bi('Карточка 3. «Подрядчик закоммитил файл `.env` с паролем. Сделайте так, чтобы Git перестал следить за этим файлом и больше никогда не взял его в коммит, но сам файл у меня на диске остался».', 'Card 3. “The contractor committed `.env` with a password. Make Git stop tracking that file and never take it into a commit again, but keep the file on my disk.”'),
        check: {
          when: (f) => !('.env' in (head(f)?.files ?? {})) && /(^|\n)\/?\.env\s*(\n|$)/.test(head(f)?.files['.gitignore'] ?? '') && !!f.files['/home/learner/site/.env'],
          fail: [{ if: (f) => !f.files['/home/learner/site/.env'], say: bi('Файл удалён и с диска, а он нужен приложению.', 'The file is gone from disk too, and the application needs it.') }],
        },
      },
    },
    {
      id: 'revert',
      weight: 15,
      beyond: true,
      kind: 'task',
      setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }, { message: 'Rework the home page', files: { 'index.html': '<!doctype html>\n<title>TODO</title>\n' } }] }] }),
      task: {
        id: 'revert',
        prompt: bi('Карточка 4. «Последний коммит сломал главную страницу, а коллеги уже забрали себе историю. Отмените этот коммит, не переписывая историю». Этой задачи не было в курсе, и ответ нужно найти в справке Git.', 'Card 4. “The last commit broke the home page, and colleagues have already pulled the history. Undo it — without rewriting the history.” This task is beyond the course: the answer is in the Git help.'),
        docStep: 5,
        beyond: true,
        docRef: { page: 'man/git-revert.1' },
        solutionTokens: ['git revert', 'revert'],
        check: { when: (f, start) => head(f)?.files['index.html'] === PAGES['index.html'] && (repo(f)?.commits.length ?? 0) === (start ? (repo(start)?.commits.length ?? 0) + 1 : 3) },
      },
    },
  ],
};

export const BLOCK_EXAMS: Exam[] = [LINUX_EXAM, GIT_EXAM];
