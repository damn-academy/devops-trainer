# DevOps Trainer web — контракты для авторов

[English](CONTRACTS.md) · Русский

Все формы данных лежат в `src/core/types.ts` (читайте комментарии — это и есть спецификация).
Эта страница объясняет, как подключиться, не трогая чужих файлов.

## Команды

```
npm run dev     # http://localhost:5173, заголовки COOP/COEP включены
npm run build   # tsc --noEmit + vite build → dist/
npm test        # vitest: юнит-тесты и линтер содержания (tests/concept-order.test.ts)
```

`npm test` прогоняет `lintRegistry()` по всем модулям сборки. Он падает на любой
ошибке контракта и выводит список строк `where: message`.

## Как подключается блок

Создайте `src/blocks/<your-folder>/index.ts`:

```ts
import { defineModule } from '../../core/define';
export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams, widgets, facts, setup, settings });
```

Модуль находится через `import.meta.glob` в `src/core/registry.ts`; общего
списка, который надо править, нет. Движки устроены так же, через
`src/engine/<name>/module.ts` (модули движков загружаются раньше модулей блоков).

Карта маршрута этих модулей не ждёт. При сборке (а в режиме разработки — после
изменения) `src/core/manifest-plugin.ts` импортирует все модули в Node и
оставляет только то, что показывает карта, — блоки без заданий проверки уровня
и источников, id уроков, заголовки, ярусы и минуты — в виде `virtual:dt-manifest`.
Главная рисуется по нему; первый заход на любую другую страницу загружает все
модули и код страницы. Авторам ничего делать не нужно, кроме одного: модуль
должен чисто импортироваться в Node (никаких `document`/`window` на верхнем
уровне, оборачивайте проверкой `typeof`), иначе сборка падает. Код, который
работает только на главной, видит заглушки уроков с пустыми `sections`;
используйте `registry.placementCount(id)`, а не `block.placement.length`.

- **Id блоков и порядок** берутся из `src/core/route.ts` (`ROUTE`). Используйте
  указанные там id и `order`; пока вашего блока нет, карта показывает
  заглушку. Одна папка может экспортировать несколько блоков (`git-cicd` →
  `git-yaml`, `cicd`; `kubernetes` → `k8s-1`, `k8s-2`; `iac` → `iac`, `k8s-3`;
  `career` → `career`, `final`; `methodology` → `orient`, `methodology`).
- **Id уроков**: `<block>.<slug>`. Урок принадлежит ровно одному блоку и
  перечислен в `Block.lessons` в порядке маршрута.
- **Id понятий**: `<prefix>.<name>` (префиксы — в `types.ts`). У каждого понятия
  есть `introducedIn` — урок, в чьём `introduces` оно указано.
- **Уровни**: `beginner | intermediate | experienced`. Никогда L0/L1/L2 в данных.
- **Текст**: каждая строка для учащегося — `Bi { ru, en }` (используйте `bi(ru, en)`).
  Команды, вывод терминала, страницы man/--help остаются простыми английскими строками.
- **Источники**: у каждого урока и блока есть `sources.en[]` и `sources.ru[]`
  с настоящими URL `https://`.

## Правило порядка понятий (линтер)

Урок может опираться на понятие только после урока, который его вводит, в
порядке маршрута (блоки по `order`, затем `Block.lessons`). Проверяется:

1. `Lesson.uses` — каждое понятие должно быть введено в более раннем уроке.
2. Ссылки на глоссарий `[[concept.id]]` / `[[concept.id|words]]` в любом Bi
   урока (текст, выноски, условия и подсказки заданий, задания квизов, включая
   задания банка, на которые он ссылается) — понятие должно быть введено здесь
   или раньше.
3. Сканирование глоссария — `Concept.term` и `Concept.forms` (целые слова, без
   учёта регистра, без участков кода) не должны встречаться в тексте более
   раннего урока. Русские падежные формы указывайте в `forms.ru`. Для бытовых
   слов, которые одновременно термины («файл», «server»), ставьте `scan: false`.

Флаги и подкоманды — не понятия: их можно найти в документации раньше, чем их
проходят (в этом и состоит лестница документации).

## Секции урока

`text` (облегчённый markdown: абзацы, `###`, списки, `> quote`, ограждения ```,
`` `code` ``, `**bold**`, `*em*`, `[text](https://…)`, `[[concept]]`),
`explainer`, `terminal`, `quiz`, `docs`, `callout`, `widget`. У каждой секции
уникальный `id` (прогресс хранится по секциям), необязательные `levels`
(показывается только для этих уровней) и `step` (hook/look/try/explain/practice/exit/review;
для опытных первая секция `practice` поднимается сразу после `hook`).
Урок пройден, когда пройдены все видимые секции: text/callout — когда
прокручены в поле зрения, explainer — когда просмотрен каждый шаг, terminal —
когда пройдены все задания, quiz — когда дан ответ на каждое задание, docs —
когда решено, widget — когда он вызвал `ctx.complete()`.

## Объяснения процессов

Напишите `ProcessModel` (types.ts, 08 §3.1) через `defineModel` и
зарегистрируйте её через `fromModel(model)` из `src/engine/explainer/render.ts`
в `explainers`. Рабочий пример — `src/blocks/demo/pipe.ts`. Правила, которые
проверяет линтер: не больше 12 узлов; у каждого ребра есть `label` (рисуется на
линии) и `card`; у каждого узла и группы есть `card { what, who, see?, doc? }`;
`run(defaults)` возвращает шаги, чьи id в `focus` существуют; каждая поломка
заставляет какой-то шаг сообщить `broken` (предупреждение). Правила модели:
`run` чистая и быстрая (< 16 мс); `states`, `values`, `fill` сворачиваются по
шагам (поздние шаги перекрывают ранние); `metrics` указываются полностью на
каждом шаге; `explainDelta` возвращает одно предложение;
`Prediction.resolve(prev, next)` читает пересчитанный прогон и возвращает id
правильного варианта. Ручки с `predict` спрашивают «что будет?» перед первым
изменением; каждая поломка спрашивает перед включением. Цветовые семейства —
`ColorFamily` в types.ts (токены — в `src/styles/tokens.css`). Используйте
`shape: 'bar'` для полосы ядра (рисуется под рёбрами), `'hex'` — плоскость
управления, `'doc'` — объект API, `'rack'` — узел, `'buffer'` — очереди с
индикатором заполнения.

Своё объяснение (не из модели) — это любой `ExplainerReg` со своим
`mount(el, ctx)`; вызовите `ctx.onComplete()`, когда учащийся всё посмотрел.

## Терминал, машина, команды, проверки

- `TerminalSection { machine: 'sim', setup: TerminalSetup, tasks: Task[] }`.
  У симулированной машины (`src/engine/terminal/shell.ts`, `SimMachine`) есть
  VFS с inode, правами и пользователями, таблица процессов, разборщик
  подмножества bash (кавычки, `| > >> < 2> 2>&1 &>`, `&& || ;`,
  `$VAR ${VAR:-x} $? $(…)`, glob, `~`), скрипты (`./x.sh` требует `x`;
  `bash x.sh` — нет; `$1… $# $@`, `exit`).
- **Регистрируйте команды** в `commands: ShellCommand[]`: `name`, `summary` (Bi),
  английский `help` (печатается на `<cmd> --help`, становится страницей
  документации `help/<name>`), `man` (секции → страница `man/<name>.<section>`),
  `run(ctx)`. Используйте `ctx.fs` (привязан к пользователю и cwd; бросает
  `FsError` — дайте ему подняться или используйте `fsErr()`), `ctx.out/err`,
  `ctx.isatty`, `ctx.machine.procs`,
  `ctx.machine.ext('docker', () => new DockerState())` для состояния движка
  (сделайте его `Snapshotable`, чтобы оно переживало снимки и сброс). Помощники
  для разбора аргументов в стиле GNU — в `src/engine/terminal/commands/util.ts`.
  Совпадение имён — ошибка реестра; поставьте `override: true`, чтобы заменить
  базовую команду ядра (ядро поставляет: echo pwd cd ls cat mkdir touch rm grep
  clear help man export unset true false exit history bash/sh). Полный набор —
  за автором блока Linux.
- **Факты** (`Facts`, подмножество `dt.facts/v1`): `user, cwd, hostname, vars,
  procs, files[path]{type,mode('0644'),owner,group,size,ino,nlink,text},
  term.main[] {line, exit, out}, users, groups`. Движки добавляют свои области
  через `facts: [{ scope: 'containers', collect(m) }]` с именами полей из 09 §2.2.
- **Хуки подготовки**: `setup: [{ key: 'docker', apply(m, value) }]` принимает
  `TerminalSetup.ext.docker`.
- **Проверки** (`Task.check`): `when` — предикат (`src/core/predicate.ts`,
  09 §2.3: `files['/x'].type=f`, `procs[cmd=nginx]`, `cgroups[path=/box].memory.max<=20Mi`,
  `term['main'][last].exit=0`, `&& || ! ( )`, `has in ~ =~`, `#` — счёт,
  `@pid(cmd)`, `@start.<path>`) или функция `(facts, start) => boolean`;
  `stdout` сопоставляется с выводом последней команды; `fail[]` даёт
  адресные объяснения. `when` не должен читать набранный текст (`term.*.line`) —
  линтер падает; проверяйте результат.
- **Лестница документации в заданиях**: `docRef` (страница + якорь +
  подсвеченная строка), `hints { H1…H5 }`, `chips` (ожидаемая команда),
  переопределение `docStep`, `beyond: true` + `solutionTokens` для DL4 (кроме H1,
  подсказки запрещены). Ступень для каждого источника вычисляется в
  `src/engine/docs/ladder.ts` (старт по уровню, расписание по положению урока в
  блоке, никогда вниз, при переходе в новый блок −1, досрочный подъём после
  трёх чистых заданий).

## Задания квизов

Виды: `mcq`, `multi`, `order`, `match`, `fill-command`, `predict-output`,
`bugfind`, `label` (types.ts). У каждого неверного варианта нужен `why`;
`explain` показывается после любого ответа. `fill-command` с `setup` + `check`
оценивается запуском строки на свежей машине; `predict-output` берёт эталон из
запуска `command` на симуляторе. Переиспользуемые задания кладите в `quiz`
(банк; ссылайтесь по id из `QuizSection.items`; очередь повторения выбирает
задания банка по `concepts`). Уверенность (угадываю / думаю / знаю)
спрашивается перед каждым ответом.

## Корпус документации

Страницы берутся из команд (`man`, `help`) и из `docs: DocPage[]` (id вроде
`explain/pod.spec`, `web/kubernetes.io/…`; `source` — источник для лестницы:
`kubectl-explain`, `kubernetes.io`, `docs.docker.com`, …). У секций есть id
(`NAME`, `SYNOPSIS`, `DESCRIPTION`, `OPTIONS`, `EXIT STATUS`, `EXAMPLES`,
`SEE ALSO`, `FIELDS`); читалка показывает их анатомию на полях. Открывается
через `openDoc(ref, { mode: 'peek' | 'page' | 'exam' })`; чип DL1 — `docChip(ref)`.

## Движки, виджеты, настройки, нейросеть

- `widgets: [{ id, mount(el, props, ctx) }]` + секция `{ kind: 'widget', widget: id }` —
  для досок flowlab, видов кластера и т. п.
- `settings: [{ id: 'ai', order, title, mount(el) }]` — секция автора
  нейросети заменяет заглушку «Ваша нейросеть».
- `mentor: Mentor` — точка подключения нейросети (`ready()`, `ask(req)`);
  движок сворачивает ответы, содержащие `solutionTokens`, и никогда не
  предлагает наставника на экзаменах.
- `exams: Exam[]` + `Block.exam` — отрисовываются по `#/exam/<id>` (режимы
  экзамена и тренировки, читалка DL5 ограничена `allowedDocs`, мягкий таймер).
- `Block.placement: PlacementTask[]` — отрисовывается по `#/block/<id>/placement`
  (без подсказок, без обратной связи, «угадываю» никогда не засчитывается,
  80% + все `key`).

## Хранилище прогресса

`src/core/store.ts`: журнал событий только на дозапись в IndexedDB, пишется при
каждом `store.record(event)` (кнопки «Сохранить» нет); прогресс — это
`replay(events)` (`src/core/progress.ts`, чистая функция). Движки могут писать
свои события с видами `x.<engine>.<what>`. Снимки машин:
`store.saveSnapshot(key, data)`. Экспорт и импорт JSON
(`devops-trainer/progress@1`), `navigator.storage.persist()`, еженедельная
строка «экспортируйте или войдите»; вход подключится позже через `store.setAccount()`.

## Владение файлами

| Путь | Владелец |
|---|---|
| `src/core/*`, `src/app/*`, `src/styles/*`, `src/main.ts`, `index.html`, конфиги | ядро платформы (менять только минимальным обратно совместимым расширением; сообщать об этом) |
| `src/engine/{explainer,terminal,quiz,docs}` | ядро платформы |
| `src/blocks/demo` | ядро платформы (витрина; Linux может заменить конвейер) |
| `src/blocks/methodology`, `src/engine/flowlab` | автор методологии |
| `src/blocks/linux` | автор Linux |
| `src/blocks/networks`, `src/engine/sim-net` | автор сетей |
| `src/blocks/containers`, `src/engine/dsim` | автор контейнеров |
| `src/blocks/kubernetes`, `src/engine/kube-lite` | автор Kubernetes |
| `src/blocks/{git-cicd,iac,monitoring}` | автор CI/CD, IaC и мониторинга |
| `src/blocks/career` | автор оценивания и карьеры |
| `src/engine/{ai,v86}` | автор платформы, v86 и нейросети |
| `tests/<your-folder>-*.test.ts` | автор этой папки |

Не запускайте docker/kind/colima/ВМ на этом Mac. Не коммитьте; коммитит ведущий.

## Настоящий Linux (ярус B, v86), своя нейросеть, офлайн

Владелец: автор платформы, v86 и нейросети. Файлы: `src/engine/v86`, `src/engine/ai`, `src/engine/pwa`.

**Ресурсы.** `npm run fetch:v86` (запускается и в `prebuild`, без сети не
фатален) скачивает SeaBIOS/VGABIOS (коммит v86 315b2b0) и Buildroot-`bzImage`
из демо v86 (Linux 5.6.15 i686 + BusyBox, GPL-2.0, 5 МБ) в `public/v86/`
(в git не попадает), проверяет SHA-256 и пишет `manifest.json`. Эмулятор —
npm-пакет `v86` (BSD-2-Clause, закреплён на 0.5.473).

**Настоящая машина в уроке** — секция-виджет; эмулятор загружается только при монтировании:

```ts
{ kind: 'widget', id: 'real', widget: 'v86.linux', props: {
    intro: bi('…', '…'),
    hostname: 'linux',               // по умолчанию
    setup: ['mkdir -p /srv/app'],    // выполняется от root до того, как учащийся получит приглашение
    tasks: [{ id: 't1', prompt: bi('…','…'), check: { when: "files['/root/demo'].type=d" } }],
} }
```

- Гость работает от root в `/root`; оболочка — BusyBox `ash`. Проверки
  запускаются после каждой команды по фактам, собранным с настоящей машины:
  `files[...]` (только пути, названные в строковых предикатах, или
  `props.watch`), `procs` (из `/proc`, служебная оболочка тренажёра скрыта),
  `cwd`, `hostname`, `users`, `groups`, `term.main` (строка, код выхода,
  вывод — по маркеру приглашения), `env.kind = 'v86'`.
- Проверки-функции тоже работают, но их пути перечисляйте в `props.watch`.
- Машина лаборатории сохраняется в OPFS (на урок и секцию) после каждой
  пройденной цели и при уходе; учащийся продолжает с того места, где
  остановился. «Сбросить машину» возвращает в состояние после `setup`.
- Автозапуск только при `navigator.deviceMemory >= 4`; иначе — карточка
  «Запустить» с размером загрузки и памятью.
- Программное использование: `new V86Machine(opts)` (`src/engine/v86/machine.ts`,
  реализует `Machine`: `exec`, `facts`, `snapshot`/`restore`, `on`) +
  `mountConsole(el, machine)` (`console.ts`).

**Страницы.** `#/lab/linux` (песочница), `#/lab/multinode` (2–3 машины на
встроенном в страницу учебном коммутаторе `dt-switch`: таблица MAC со
старением, flood/forward/filter, 802.1Q access/trunk, режим хаба, порт
up/down; живая схема). Любой движок может добавить страницу `#/lab/<id>`,
зарегистрировав виджет `lab:<id>`.

**Наставник.** `registry.mentor` — наставник на своей нейросети (им пользуется
поле «Спросить» ядра). Урок может поставить
`{ kind: 'widget', widget: 'ai.tutor', props: { mode?, label?, question? } }`;
у уроков и лабораторий есть и плавающая кнопка «Спросить наставника» (скрыта
на экзаменах и проверке уровня, где воркер нейросети отказывает в запросах).
Наставник видит урок, введённые понятия (белый список), текущую цель
(`.goal.current[data-task]`), последние 40 строк терминала и след по
документации; `solutionTokens` — никогда (ответы, где они названы, один раз
перефразируются, затем сворачиваются). H4/H5 в режиме практики выдают только
текст автора из `hints.H4/H5`. Терминальные виджеты после каждой команды
отправляют событие `dt:terminal` `{ machine, line, out, exit }` на `document`.

**Офлайн.** Сборка выпускает `sw.js` + `manifest.webmanifest` (плагин
`src/engine/pwa/vite-plugin.ts`): оболочка приложения и все чанки
предзагружаются; движок и образы v86 кэшируются при первом использовании или
через «Настройки → Офлайн»; новая версия ждёт и применяется по кнопке или при
переходе к другому уроку.

### Редакторы на настоящей машине (lab-editors, v86.editor)

Профиль `lab-editors` (256 МБ): набор lab-node, а к нему Neovim, Emacs без X,
tmux, ripgrep и make, агенты только для чтения в `scripts/lab-editors`
(`dt.vim`, `dt.lua`, `dt-agent.el`, который загружает `site-start.el`) и
учебные файлы в `/srv/train`. Урок ставит виджет:

```ts
{ kind: 'widget', id: 'vim-lab', widget: 'v86.editor', props: {
    editors: ['vim'],
    tasks: [{ id: 'm', prompt: bi('…', '…'), check: { when: "vim.reg.a ~ ';' && vim.recording = ''" } }],
} }
```

- Факты собираются, только если их называет предикат: `vim`, `nvim`,
  `emacs` — `running`, `instrumented`, `source` (`socket` | `file` | `none`),
  `buf` (текущий буфер), `buffers[]{file,name,modified,text,…}`; у Vim и
  Neovim ещё `mode`, `recording`, `reg`, `regtype`, `marks`, `qf`, `windows`,
  `layout`, `undo`, `opt`; у Emacs `killhead`, `killring[]`, `point`, `mark`,
  `major`, `minor`, `registers`. Есть и `editor.{active,running,instrumented}`.
  У редактора, запущенного без плагинов (`vim -u NONE`, `nvim --clean`,
  `emacs -Q`), `instrumented=false`: тогда проверяются файлы, а в `fail[]`
  об этом честно говорится.
- Повод для проверки: `new V86Machine({ editorWatch: true })` опрашивает ttyS1
  раз в 400 мс, пока работает редактор (раз в секунду, пока идёт другая
  команда), и посылает `editor.change`; проверка по приглашению остаётся.
  `m.editorFacts()` возвращает одни факты редактора, это дешевле `facts()`.
- Демонстрация: `#/lab/editors`. Сквозной прогон:
  `node scripts/check-editors-lab.mjs` (на сборочной машине).
