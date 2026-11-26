# Понятность заданий во всех курсах

Проверена рабочая копия `fix/exam-titles` после чтения `5522c97` и `1d45816`. За основу взяты три вопроса из исправления экзаменов: что выполнить, где работать и как увидеть результат. Дополнительно проверены значения отметок и действия в состоянии ожидания.

## Обход и границы проверки

Скрипт `web/scripts/audit-task-clarity.mjs` запускает Vite, получает полный реестр через `loadRegistry()` и `orderedBlocks(true)`, затем открывает каждый урок. Скрытые бизнес-блоки входят в обход. Разделы для среднего и опытного уровней открываются отдельно. На ширинах 1280 и 390 пикселей сохраняются видимый текст раздела, элементы управления и снимок каждого раздела. Теория и предупреждения тоже сохраняются, чтобы не потерять задания внутри прозы. Итоговый обход дополнительно проходит доступный вариант входной проверки каждого блока и уровня кнопкой «Пропустить».

Запуск из `web`: `node scripts/audit-task-clarity.mjs before` и `node scripts/audit-task-clarity.mjs after`. Доказательства лежат в `web/task-clarity-audit/{before,after}/`: `inventory.json`, `sections.json`, снимки PNG; итоговый запуск также пишет `errors.json`. Каталог исключён из Git. После последней правки калькулятора обновлены три урока командой `node scripts/audit-task-clarity.mjs after k8s-2.prepare k8s-3.plan k8s-3.real`; остальные записи итогового обхода сохранены. Затем тем же способом обновлены десять уроков с виджетами `rubric`, `roleplay` и `deptsim` после добавления кнопки самопроверки внешнего чата.

Исходный обход охватил 307 уроков, 28 блоков и все 2279 разделов; сохранены 4572 записи со снимками, ошибок захвата нет. Число снимков больше удвоенного числа разделов, потому что несколько разделов открыты на двух уровнях. Семь недостающих исходных снимков дополнены обходом четырёх уроков из временной копии `1d45816`; итоговый исходный набор покрывает каждый раздел на обеих ширинах. В таблицах ниже раздел считается один раз по паре «урок / раздел».

Локальная копия не содержит образов машин. Поэтому браузерный обход проверяет также сообщение об их отсутствии, но не запускает настоящие машины, не обращается к внешним нейросетям и не выполняет упражнения в облаке. Проверка состояния машин опирается на существующие тесты с данными машин; результаты ручных документов и отдельных чатов проверяет ученик. Обход начальных экранов сам по себе не доказывает прохождение всех сценариев.

## Типы заданий

`unclear` означает найденный пробел в инструкции или подтверждении результата; `clear` означает, что описанный пробел закрыт. Таблица учитывает общие компоненты и каждый зарегистрированный виджет, встречающийся в уроках.

| Тип | До | Причина и изменение | После |
|---|---|---|---|
| Терминал симулятора | unclear | Не объяснены ввод команды через Enter, автоматическая проверка состояния и зелёная галочка. | clear |
| Поиск в документации и выбор её раздела | unclear | Не объяснено, как выбор раздела или команда подтверждают выполнение. | clear |
| Схема процесса и вопросы перед изменением | unclear | Не названы условие завершения просмотра и видимая отметка; нужны действия при вопросе перед изменением. | clear |
| Письменная практика бизнес-курса | unclear | Не везде было поле результата; чтение задания засчитывалось как выполнение, самостоятельная проверка не отделялась от автоматической. | clear |
| Ежедневные действия внутри старых модулей | unclear | Практические действия были спрятаны в теории и засчитывались при чтении. | clear |
| Квиз `mcq` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| Квиз `multi` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| Квиз `order` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| Квиз `match` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| Квиз `fill-command` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| Квиз `predict-output` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| Квиз `bugfind` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| Квиз `label` | unclear | Инструкция перед управлением называет способ ответа, кнопку «Проверить» и результат; входная проверка обещает только сохранение ответа до итогов. | clear |
| `boundary` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `career.checklist` | unclear | Не отделены самостоятельная проверка внешнего проекта и отметка знакомства с планом. | clear |
| `career.cluster-repair` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `career.drill` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `career.mock` | unclear | До запуска не названы завершение интервью и получение итогового балла. | clear |
| `career.oncall` | unclear | До запуска не названы сдача смены, итоговый процент и значения отметок. | clear |
| `career.pitch` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `career.resume` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `career.translator` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `career.vacancy` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `cicd.board` | unclear | Ожидание git push не называло терминал урока и способ просмотра результата. | clear |
| `deptsim` | unclear | Не описаны два места игры и условие завершения; для отдельного чата добавлена явная самопроверка на странице. | clear |
| `events.roi` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `finance.franchise` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `finance.round` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `flowlab.board` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `governance` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `health` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `iac.cloudlab` | unclear | Не объяснены место работы и автоматическая проверка состояния. При отсутствии образа нет понятного ученику следующего шага. | clear |
| `k8s.constructor` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `k8s.controller-lab` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `k8s.cost` | unclear | Раздел засчитывался при открытии; теперь завершение требует самостоятельной сверки и кнопки «Завершить сравнение». | clear |
| `k8s.output-check` | unclear | Не объяснены подготовка своей машины, нажатие «Сверить» и значение отметок результата. | clear |
| `k8s.real-check` | unclear | Нет явной связи терминала собственного кластера, подготовки и сообщений об успешной проверке. | clear |
| `linux.lab` | unclear | Не объяснены выбор машины, автоматическая проверка и значение галочек. Сообщение об отсутствующем образе адресовано разработчику. | clear |
| `marketing.budget` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `marketing.dns-lab` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `marketing.regions` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `net.protocols` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `net.reallab` | unclear | Сбор данных для обратной связи ошибочно скрывал цели урока как на экзамене. При отсутствии образа показывалась команда сборки проекта. | clear |
| `net.route-map` | clear | Это справочная таблица со ссылками на уроки; отдельного задания и проверки в ней нет. | clear |
| `net.subnet-calc` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `net.subnet-drill` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `obs.logs` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `obs.traces` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `obs.workbench` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `product.opencore` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `product.valuemetric` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `roleplay` | unclear | Инструкция для нейросети не объясняла отправку реплики и получение разбора; отдельный чат не позволял завершить раздел. | clear |
| `rubric` | unclear | Не описано, где появится оценка, как подключить нейросеть и как завершить работу в отдельном чате. | clear |
| `sales.funnel` | unclear | Не задано явное завершение самостоятельного сравнения; часть калькуляторов вообще не сообщала о завершении раздела. | clear |
| `scithink.calibration` | unclear | Не объяснены заполнение всех вероятностей, недоступная кнопка и итоговое сравнение. | clear |
| `signal-feed` | unclear | Перед управлением не назван полный порядок выполнения и подтверждения результата. | clear |
| `template` | unclear | Не названо приложение для файла; не отделены самопроверка, завершение раздела и очистка черновика. | clear |
| `yaml.parser` | unclear | Выбор версии стоял перед заданием; успешный разбор синтаксиса можно было принять за выполнение задачи. | clear |
| Входная проверка: квиз | unclear | Указаны сохранение ответа, переход дальше и итог после последнего задания. | clear |
| Входная проверка: терминал | unclear | Указаны терминал, автоматическая проверка, пропуск без зачёта и завершение проверки. | clear |
| Входная проверка: свои машины | unclear | Карточка объясняет сбор данных и отметки; убрана ошибочная подпись «практика в песочнице». | clear |

## Изменения поведения

- Режим экзамена сетевой лаборатории задаётся отдельным признаком `WidgetCtx.exam`. Сбор данных для обратной связи больше не скрывает цели урока.
- Квизы объясняют проверку до полей и кнопок. Схемы показывают завершение просмотра, виджеты — завершение раздела.
- Девять видов калькуляторов завершаются явной кнопкой самостоятельного сравнения. Письменные задания бизнес-курсов завершаются кнопкой самопроверки; просмотр текста больше не засчитывается как выполненная работа.
- Действия из 25 старых модулей продаж, маркетинга и продукта вынесены из раздела `principles` в раздел `practice`. Формулировки самих действий сохранены.
- Для файлов названы Excel, Google Sheets или терминал с Node.js; для нейросетей различаются встроенная проверка и отдельный чат. Практики во внешнем чате и игра отдела завершаются явной кнопкой самопроверки, которая сохраняет текст ученика.
- Ожидание данных и отсутствие образа машины сопровождаются следующим действием. Цветовые отметки объяснены текстом; баллы интервью показаны числами рядом с точками.

## Счёт до и после

Найдено 827 разделов с общими или отдельными пробелами. Это число разделов, а не число отдельных вопросов и не число ошибок внутри раздела. Входные проверки учитываются отдельно, потому что первый обход сохранял уроки. После исправлений повторная проверка этих 827 разделов не обнаружила прежних пробелов: 827 → 0. Для перенесённых заданий проверены новые разделы `practice`. В итоговом обходе открыты все 2304 раздела 307 уроков из 28 блоков; сохранены 4622 записи уроков и 299 записей входных проверок. Ошибок захвата и ошибок JavaScript на странице нет.

Сверены видимые инструкции в записях каждого затронутого раздела на обеих ширинах; отдельно просмотрены снимки квизов, терминалов, лабораторий и письменных заданий. Проверка наличия инструкции подтверждает её показ, а тесты общих компонентов проверяют сохранение ответа и момент завершения. Отметка `clear` относится к перечисленным пробелам и границам проверки выше.

## Конкретные разделы

Для строк `principles` исправление находится в новом разделе `practice` того же урока. Для остальных строк сохранены прежние идентификаторы. Причина указана в таблице типов выше.

| Урок | Раздел | Тип с найденным пробелом |
|---|---|---|
| `aicontent.bots` | `quiz-1` | `quiz` |
| `aicontent.bots` | `task-1` | `written` |
| `aicontent.brief` | `quiz-1` | `quiz` |
| `aicontent.brief` | `task-1` | `written` |
| `aicontent.checks` | `quiz-1` | `quiz` |
| `aicontent.checks` | `task-1` | `written` |
| `aicontent.editing` | `download-ru-intensifiers-lint` | `template` |
| `aicontent.editing` | `quiz-1` | `quiz` |
| `aicontent.editing` | `task-1` | `written` |
| `aicontent.interactive` | `quiz-1` | `quiz` |
| `aicontent.interactive` | `task-1` | `written` |
| `aicontent.interactive` | `widget-1` | `deptsim` |
| `aicontent.publishing` | `quiz-1` | `quiz` |
| `aicontent.publishing` | `task-1` | `written` |
| `aicontent.research` | `quiz-1` | `quiz` |
| `aicontent.research` | `task-1` | `written` |
| `aicontent.rules` | `quiz-1` | `quiz` |
| `aicontent.rules` | `task-1` | `written` |
| `aicontent.team` | `quiz-1` | `quiz` |
| `aicontent.team` | `task-1` | `written` |
| `aicontent.tools` | `quiz-1` | `quiz` |
| `aicontent.tools` | `task-1` | `written` |
| `aicontent.video` | `quiz-1` | `quiz` |
| `aicontent.video` | `task-1` | `written` |
| `aicontent.video-to-article` | `quiz-1` | `quiz` |
| `aicontent.video-to-article` | `task-1` | `written` |
| `aicontent.visuals` | `quiz-1` | `quiz` |
| `aicontent.visuals` | `task-1` | `written` |
| `career.answer` | `exit` | `quiz` |
| `career.answer` | `translator` | `career.translator` |
| `career.classics` | `exit` | `quiz` |
| `career.classics` | `translator` | `career.translator` |
| `career.first-job` | `ask-try` | `quiz` |
| `career.first-job` | `exit` | `quiz` |
| `career.interviews` | `exit` | `quiz` |
| `career.mock` | `exit` | `quiz` |
| `career.mock` | `mock` | `career.mock` |
| `career.mock` | `quote` | `explainer` |
| `career.oncall-life` | `exit` | `quiz` |
| `career.oncall-life` | `normal-try` | `quiz` |
| `career.pets` | `exit` | `quiz` |
| `career.pets` | `tracker` | `career.checklist` |
| `career.pitch` | `exit` | `quiz` |
| `career.pitch` | `trainer` | `career.pitch` |
| `career.resume` | `builder` | `career.resume` |
| `career.resume` | `exit` | `quiz` |
| `career.search` | `analyzer` | `career.vacancy` |
| `career.search` | `exit` | `quiz` |
| `career.search` | `funnel` | `explainer` |
| `career.situational` | `drill-504` | `career.drill` |
| `career.situational` | `drill-crash` | `career.drill` |
| `career.situational` | `drill-disk` | `career.drill` |
| `career.situational` | `exit` | `quiz` |
| `career.situational` | `symptom` | `explainer` |
| `cicd.artifacts-cache` | `board` | `cicd.board` |
| `cicd.artifacts-cache` | `forcing` | `docs` |
| `cicd.artifacts-cache` | `lab` | `terminal` |
| `cicd.artifacts-cache` | `look` | `explainer` |
| `cicd.artifacts-cache` | `quiz` | `quiz` |
| `cicd.first-pipeline` | `anatomy` | `docs` |
| `cicd.first-pipeline` | `board` | `cicd.board` |
| `cicd.first-pipeline` | `lab` | `terminal` |
| `cicd.first-pipeline` | `look` | `explainer` |
| `cicd.first-pipeline` | `quiz` | `quiz` |
| `cicd.remote` | `lab` | `terminal` |
| `cicd.remote` | `look` | `explainer` |
| `cicd.remote` | `quiz` | `quiz` |
| `cicd.remote` | `reject` | `terminal` |
| `cicd.rules-needs` | `board` | `cicd.board` |
| `cicd.rules-needs` | `forcing` | `docs` |
| `cicd.rules-needs` | `lab` | `terminal` |
| `cicd.rules-needs` | `look` | `explainer` |
| `cicd.rules-needs` | `quiz` | `quiz` |
| `cicd.variables-envs` | `board` | `cicd.board` |
| `cicd.variables-envs` | `lab` | `terminal` |
| `cicd.variables-envs` | `quiz` | `quiz` |
| `cicd-k8s.deploy` | `anatomy` | `docs` |
| `cicd-k8s.deploy` | `flux` | `k8s.constructor` |
| `cicd-k8s.deploy` | `forcing` | `docs` |
| `cicd-k8s.deploy` | `lab` | `terminal` |
| `cicd-k8s.deploy` | `look` | `explainer` |
| `cicd-k8s.deploy` | `quiz` | `quiz` |
| `containers.anatomy` | `findflag` | `docs` |
| `containers.anatomy` | `lab` | `terminal` |
| `containers.anatomy` | `look` | `explainer` |
| `containers.anatomy` | `quiz` | `quiz` |
| `containers.boundaries` | `drill-quiz` | `quiz` |
| `containers.boundaries` | `drills` | `terminal` |
| `containers.boundaries` | `forcing` | `docs` |
| `containers.boundaries` | `look` | `explainer` |
| `containers.boundaries` | `quiz` | `quiz` |
| `containers.by-hand` | `lab` | `terminal` |
| `containers.by-hand` | `quiz` | `quiz` |
| `containers.by-hand` | `seccomp` | `docs` |
| `containers.compose` | `find-wait` | `docs` |
| `containers.compose` | `lab` | `terminal` |
| `containers.compose` | `quiz` | `quiz` |
| `containers.dockerfile` | `anatomy-dockerfile` | `docs` |
| `containers.dockerfile` | `check-run-cmd` | `quiz` |
| `containers.dockerfile` | `forcing` | `docs` |
| `containers.dockerfile` | `lab` | `terminal` |
| `containers.dockerfile` | `look-cache` | `explainer` |
| `containers.dockerfile` | `look-stop` | `explainer` |
| `containers.dockerfile` | `quiz` | `quiz` |
| `containers.first-steps` | `anatomy-help` | `docs` |
| `containers.first-steps` | `find-timeout` | `docs` |
| `containers.first-steps` | `forcing` | `docs` |
| `containers.first-steps` | `lab` | `terminal` |
| `containers.first-steps` | `quiz` | `quiz` |
| `containers.image` | `forcing` | `docs` |
| `containers.image` | `lab` | `terminal` |
| `containers.image` | `look` | `explainer` |
| `containers.image` | `quiz` | `quiz` |
| `containers.interview` | `builder` | `quiz` |
| `containers.interview` | `twelve` | `quiz` |
| `containers.security` | `forcing` | `docs` |
| `containers.security` | `lab` | `terminal` |
| `containers.security` | `quiz` | `quiz` |
| `containers.storage-net` | `lab` | `terminal` |
| `containers.storage-net` | `look` | `explainer` |
| `containers.storage-net` | `quiz` | `quiz` |
| `containers.why` | `doc` | `docs` |
| `containers.why` | `look` | `explainer` |
| `containers.why` | `look-nesting` | `explainer` |
| `containers.why` | `look-scale` | `explainer` |
| `containers.why` | `quiz` | `quiz` |
| `containers.why` | `try` | `terminal` |
| `demo.pipeline` | `anatomy` | `docs` |
| `demo.pipeline` | `findflag` | `docs` |
| `demo.pipeline` | `forcing` | `docs` |
| `demo.pipeline` | `lab` | `terminal` |
| `demo.pipeline` | `look` | `explainer` |
| `demo.pipeline` | `quiz` | `quiz` |
| `events.booth` | `task-1` | `written` |
| `events.booth` | `widget-1` | `roleplay` |
| `events.cfp` | `task-1` | `written` |
| `events.cfp` | `widget-1` | `rubric` |
| `events.cncf-events` | `quiz-1` | `quiz` |
| `events.cncf-events` | `task-1` | `written` |
| `events.labs` | `task-1` | `written` |
| `events.local` | `task-1` | `written` |
| `events.local` | `widget-1` | `template` |
| `events.map` | `task-1` | `written` |
| `events.map` | `widget-1` | `events.roi` |
| `events.no-booth` | `task-1` | `written` |
| `events.no-booth` | `widget-1` | `deptsim` |
| `events.online-conf` | `quiz-1` | `quiz` |
| `events.online-conf` | `task-1` | `written` |
| `events.own-conf` | `quiz-1` | `quiz` |
| `events.own-conf` | `task-1` | `written` |
| `events.portfolio` | `quiz-1` | `quiz` |
| `events.portfolio` | `task-1` | `written` |
| `events.webinars` | `task-1` | `written` |
| `final.capstone` | `checklist` | `career.checklist` |
| `final.capstone` | `quiz` | `quiz` |
| `final.cluster-map` | `constructor` | `k8s.constructor` |
| `final.cluster-map` | `exit` | `quiz` |
| `final.cluster-map` | `repair` | `career.cluster-repair` |
| `final.oncall` | `exit` | `quiz` |
| `final.oncall` | `shift` | `career.oncall` |
| `finance.automation` | `quiz-1` | `quiz` |
| `finance.automation` | `task-1` | `written` |
| `finance.cash-vs-profit` | `quiz-1` | `quiz` |
| `finance.cash-vs-profit` | `task-1` | `written` |
| `finance.cash-vs-profit` | `widget-1` | `template` |
| `finance.close` | `quiz-1` | `quiz` |
| `finance.close` | `task-1` | `written` |
| `finance.dashboard` | `quiz-1` | `quiz` |
| `finance.dashboard` | `task-1` | `written` |
| `finance.metrics` | `quiz-1` | `quiz` |
| `finance.metrics` | `task-1` | `written` |
| `finance.model` | `quiz-1` | `quiz` |
| `finance.model` | `task-1` | `written` |
| `finance.model` | `widget-1` | `template` |
| `finance.revenue` | `quiz-1` | `quiz` |
| `finance.revenue` | `task-1` | `written` |
| `finance.runway` | `quiz-1` | `quiz` |
| `finance.runway` | `task-1` | `written` |
| `finance.runway` | `widget-1` | `template` |
| `finance.safe` | `quiz-1` | `quiz` |
| `finance.safe` | `task-1` | `written` |
| `finance.safe` | `widget-1` | `finance.round` |
| `finance.statements` | `quiz-1` | `quiz` |
| `finance.statements` | `task-1` | `written` |
| `finance.statements` | `widget-1` | `template` |
| `finance.taxes-federal` | `quiz-1` | `quiz` |
| `finance.taxes-federal` | `task-1` | `written` |
| `finance.taxes-federal` | `widget-1` | `finance.franchise` |
| `finance.taxes-people` | `quiz-1` | `quiz` |
| `finance.taxes-people` | `task-1` | `written` |
| `finance.tools` | `quiz-1` | `quiz` |
| `finance.tools` | `task-1` | `written` |
| `git-yaml.branches` | `abort` | `docs` |
| `git-yaml.branches` | `conflict` | `terminal` |
| `git-yaml.branches` | `lab` | `terminal` |
| `git-yaml.branches` | `merge-anatomy` | `docs` |
| `git-yaml.branches` | `merge-kinds` | `explainer` |
| `git-yaml.branches` | `quiz` | `quiz` |
| `git-yaml.ignore` | `forcing` | `docs` |
| `git-yaml.ignore` | `lab` | `terminal` |
| `git-yaml.ignore` | `quiz` | `quiz` |
| `git-yaml.repo` | `anatomy` | `docs` |
| `git-yaml.repo` | `lab` | `terminal` |
| `git-yaml.repo` | `quiz` | `quiz` |
| `git-yaml.undo` | `lab` | `terminal` |
| `git-yaml.undo` | `lab-detached` | `terminal` |
| `git-yaml.undo` | `lab-revert` | `terminal` |
| `git-yaml.undo` | `quiz` | `quiz` |
| `git-yaml.yaml` | `lab` | `terminal` |
| `git-yaml.yaml` | `parser` | `yaml.parser` |
| `git-yaml.yaml` | `quiz` | `quiz` |
| `git-yaml.yaml` | `strict` | `docs` |
| `iac.ansible-intro` | `anatomy` | `docs` |
| `iac.ansible-intro` | `lab` | `terminal` |
| `iac.ansible-intro` | `quiz` | `quiz` |
| `iac.ci-apply` | `lab` | `iac.cloudlab` |
| `iac.ci-apply` | `quiz` | `quiz` |
| `iac.cloud-api` | `lab` | `iac.cloudlab` |
| `iac.cloud-api` | `quiz` | `quiz` |
| `iac.import` | `forcing` | `docs` |
| `iac.import` | `lab` | `terminal` |
| `iac.import` | `lab2` | `terminal` |
| `iac.import` | `look` | `explainer` |
| `iac.import` | `quiz` | `quiz` |
| `iac.modules` | `anatomy` | `docs` |
| `iac.modules` | `forcing` | `docs` |
| `iac.modules` | `lab` | `terminal` |
| `iac.modules` | `look` | `explainer` |
| `iac.modules` | `quiz` | `quiz` |
| `iac.modules-lab` | `lab` | `iac.cloudlab` |
| `iac.modules-lab` | `quiz` | `quiz` |
| `iac.playbook` | `findopt` | `docs` |
| `iac.playbook` | `forcing` | `docs` |
| `iac.playbook` | `lab` | `terminal` |
| `iac.playbook` | `look` | `explainer` |
| `iac.playbook` | `quiz` | `quiz` |
| `iac.remote-state` | `lab` | `iac.cloudlab` |
| `iac.remote-state` | `quiz` | `quiz` |
| `iac.roles` | `anatomy` | `docs` |
| `iac.roles` | `forcing` | `docs` |
| `iac.roles` | `lab` | `terminal` |
| `iac.roles` | `look` | `explainer` |
| `iac.roles` | `quiz` | `quiz` |
| `iac.state` | `forcing` | `docs` |
| `iac.state` | `lab` | `terminal` |
| `iac.state` | `look` | `explainer` |
| `iac.state` | `quiz` | `quiz` |
| `iac.terraform` | `lab` | `terminal` |
| `iac.terraform` | `quiz` | `quiz` |
| `iac.tofu-lab` | `lab` | `iac.cloudlab` |
| `iac.tofu-lab` | `quiz` | `quiz` |
| `k8s-1.access` | `lab-ci` | `terminal` |
| `k8s-1.access` | `lab-grant` | `terminal` |
| `k8s-1.access` | `lab-who` | `terminal` |
| `k8s-1.access` | `lab-why` | `terminal` |
| `k8s-1.access` | `parts-quiz` | `quiz` |
| `k8s-1.access` | `quiz` | `quiz` |
| `k8s-1.addons` | `constructor` | `k8s.constructor` |
| `k8s-1.addons` | `quiz` | `quiz` |
| `k8s-1.architecture` | `constructor` | `k8s.constructor` |
| `k8s-1.architecture` | `lab` | `terminal` |
| `k8s-1.architecture` | `look-apply` | `explainer` |
| `k8s-1.architecture` | `look-chain` | `explainer` |
| `k8s-1.architecture` | `look-node` | `explainer` |
| `k8s-1.architecture` | `look-sched` | `explainer` |
| `k8s-1.architecture` | `quiz` | `quiz` |
| `k8s-1.config` | `forcing` | `docs` |
| `k8s-1.config` | `lab` | `terminal` |
| `k8s-1.config` | `quiz` | `quiz` |
| `k8s-1.deployments` | `anatomy` | `docs` |
| `k8s-1.deployments` | `forcing` | `docs` |
| `k8s-1.deployments` | `lab` | `terminal` |
| `k8s-1.deployments` | `look` | `explainer` |
| `k8s-1.deployments` | `quiz` | `quiz` |
| `k8s-1.dns` | `broken` | `terminal` |
| `k8s-1.dns` | `lab` | `terminal` |
| `k8s-1.dns` | `look` | `explainer` |
| `k8s-1.dns` | `quiz` | `quiz` |
| `k8s-1.first-pod` | `anatomy` | `docs` |
| `k8s-1.first-pod` | `findflag` | `docs` |
| `k8s-1.first-pod` | `lab` | `terminal` |
| `k8s-1.first-pod` | `quiz` | `quiz` |
| `k8s-1.health` | `lab` | `terminal` |
| `k8s-1.health` | `quiz` | `quiz` |
| `k8s-1.helm` | `lab` | `terminal` |
| `k8s-1.helm` | `lab-deep` | `terminal` |
| `k8s-1.helm` | `quiz` | `quiz` |
| `k8s-1.ingress` | `constructor` | `k8s.constructor` |
| `k8s-1.ingress` | `lab` | `terminal` |
| `k8s-1.ingress` | `lab-gw` | `terminal` |
| `k8s-1.ingress` | `look` | `explainer` |
| `k8s-1.ingress` | `quiz` | `quiz` |
| `k8s-1.netpol` | `constructor` | `k8s.constructor` |
| `k8s-1.netpol` | `docs` | `docs` |
| `k8s-1.netpol` | `lab` | `terminal` |
| `k8s-1.netpol` | `look` | `explainer` |
| `k8s-1.netpol` | `quiz` | `quiz` |
| `k8s-1.network` | `lab` | `terminal` |
| `k8s-1.network` | `look-across` | `explainer` |
| `k8s-1.network` | `look-same` | `explainer` |
| `k8s-1.network` | `quiz` | `quiz` |
| `k8s-1.operators` | `lab` | `terminal` |
| `k8s-1.operators` | `operator` | `k8s.controller-lab` |
| `k8s-1.operators` | `quiz` | `quiz` |
| `k8s-1.reconcile` | `lab` | `terminal` |
| `k8s-1.reconcile` | `lab-loop` | `k8s.controller-lab` |
| `k8s-1.reconcile` | `look` | `explainer` |
| `k8s-1.reconcile` | `quiz` | `quiz` |
| `k8s-1.scaling` | `constructor` | `k8s.constructor` |
| `k8s-1.scaling` | `lab` | `terminal` |
| `k8s-1.scaling` | `quiz` | `quiz` |
| `k8s-1.services` | `broken` | `terminal` |
| `k8s-1.services` | `lab` | `terminal` |
| `k8s-1.services` | `look` | `explainer` |
| `k8s-1.services` | `quiz` | `quiz` |
| `k8s-1.storage` | `constructor` | `k8s.constructor` |
| `k8s-1.storage` | `lab` | `terminal` |
| `k8s-1.storage` | `lab-noclass` | `terminal` |
| `k8s-1.storage` | `lab-sts` | `terminal` |
| `k8s-1.storage` | `lab-sts-life` | `terminal` |
| `k8s-1.storage` | `lab-sts-update` | `terminal` |
| `k8s-1.storage` | `quiz` | `quiz` |
| `k8s-1.troubleshoot` | `lab` | `terminal` |
| `k8s-1.troubleshoot` | `quiz` | `quiz` |
| `k8s-1.why` | `look` | `explainer` |
| `k8s-1.why` | `quiz` | `quiz` |
| `k8s-2.cni` | `look` | `explainer` |
| `k8s-2.cni` | `quiz` | `quiz` |
| `k8s-2.cni` | `real` | `k8s.real-check` |
| `k8s-2.cni` | `status` | `k8s.output-check` |
| `k8s-2.etcd` | `docs` | `docs` |
| `k8s-2.etcd` | `look` | `explainer` |
| `k8s-2.etcd` | `quiz` | `quiz` |
| `k8s-2.etcd` | `real` | `k8s.real-check` |
| `k8s-2.etcd` | `status` | `k8s.output-check` |
| `k8s-2.kubeadm` | `check-init` | `k8s.output-check` |
| `k8s-2.kubeadm` | `check-join` | `k8s.output-check` |
| `k8s-2.kubeadm` | `docs-init` | `docs` |
| `k8s-2.kubeadm` | `look-init` | `explainer` |
| `k8s-2.kubeadm` | `look-join` | `explainer` |
| `k8s-2.kubeadm` | `quiz` | `quiz` |
| `k8s-2.kubeadm` | `real` | `k8s.real-check` |
| `k8s-2.prepare` | `cost-table` | `k8s.cost` |
| `k8s-2.prepare` | `quiz` | `quiz` |
| `k8s-2.prepare` | `selfcheck` | `k8s.output-check` |
| `k8s-2.repair` | `empty` | `k8s.output-check` |
| `k8s-2.repair` | `look` | `explainer` |
| `k8s-2.repair` | `quiz` | `quiz` |
| `k8s-2.repair` | `real` | `k8s.real-check` |
| `k8s-2.single-node` | `check` | `k8s.real-check` |
| `k8s-2.single-node` | `quiz` | `quiz` |
| `k8s-2.upgrade` | `docs` | `docs` |
| `k8s-2.upgrade` | `look` | `explainer` |
| `k8s-2.upgrade` | `quiz` | `quiz` |
| `k8s-2.upgrade` | `real` | `k8s.real-check` |
| `k8s-3.as-code` | `lab` | `terminal` |
| `k8s-3.as-code` | `lab-b` | `terminal` |
| `k8s-3.as-code` | `quiz` | `quiz` |
| `k8s-3.gitops` | `forcing` | `docs` |
| `k8s-3.gitops` | `lab` | `terminal` |
| `k8s-3.gitops` | `look` | `explainer` |
| `k8s-3.gitops` | `quiz` | `quiz` |
| `k8s-3.kubeadm` | `forcing` | `docs` |
| `k8s-3.kubeadm` | `lab` | `terminal` |
| `k8s-3.kubeadm` | `quiz` | `quiz` |
| `k8s-3.kubeadm` | `token` | `docs` |
| `k8s-3.nodes` | `lab` | `terminal` |
| `k8s-3.nodes` | `quiz` | `quiz` |
| `k8s-3.operate` | `lab` | `terminal` |
| `k8s-3.operate` | `look` | `explainer` |
| `k8s-3.operate` | `quiz` | `quiz` |
| `k8s-3.plan` | `cost-table` | `k8s.cost` |
| `k8s-3.plan` | `look` | `explainer` |
| `k8s-3.plan` | `quiz` | `quiz` |
| `k8s-3.prepare` | `anatomy` | `docs` |
| `k8s-3.prepare` | `lab` | `terminal` |
| `k8s-3.prepare` | `quiz` | `quiz` |
| `k8s-3.real` | `check` | `k8s.real-check` |
| `k8s-3.real` | `cleanup-check` | `k8s.output-check` |
| `k8s-3.real` | `cost-table` | `k8s.cost` |
| `k8s-3.real` | `plan-check` | `k8s.output-check` |
| `k8s-3.real` | `recap-check` | `k8s.output-check` |
| `linux.caps` | `lab` | `terminal` |
| `linux.caps` | `quiz` | `quiz` |
| `linux.cgroups` | `lab` | `terminal` |
| `linux.cgroups` | `look` | `explainer` |
| `linux.cgroups` | `quiz` | `quiz` |
| `linux.cgroups` | `systemd-run` | `docs` |
| `linux.disk-real` | `lab` | `linux.lab` |
| `linux.disk-real` | `quiz` | `quiz` |
| `linux.disks` | `inodes` | `docs` |
| `linux.disks` | `lab` | `terminal` |
| `linux.disks` | `quiz` | `quiz` |
| `linux.env` | `lab` | `terminal` |
| `linux.env` | `quiz` | `quiz` |
| `linux.files` | `lab` | `terminal` |
| `linux.files` | `quiz` | `quiz` |
| `linux.install` | `explain` | `explainer` |
| `linux.install` | `lab` | `linux.lab` |
| `linux.install` | `quiz` | `quiz` |
| `linux.manual` | `anatomy` | `docs` |
| `linux.manual` | `find-builtin` | `terminal` |
| `linux.manual` | `find-size` | `docs` |
| `linux.manual` | `quiz` | `quiz` |
| `linux.manual` | `synopsis` | `docs` |
| `linux.namespaces` | `lab` | `terminal` |
| `linux.namespaces` | `look` | `explainer` |
| `linux.namespaces` | `quiz` | `quiz` |
| `linux.packages` | `files` | `docs` |
| `linux.packages` | `lab` | `terminal` |
| `linux.packages` | `quiz` | `quiz` |
| `linux.paths` | `lab` | `terminal` |
| `linux.paths` | `quiz` | `quiz` |
| `linux.permissions` | `lab` | `terminal` |
| `linux.permissions` | `look` | `explainer` |
| `linux.permissions` | `peek` | `terminal` |
| `linux.permissions` | `quiz` | `quiz` |
| `linux.processes` | `lab` | `terminal` |
| `linux.processes` | `look` | `explainer` |
| `linux.processes` | `mem` | `docs` |
| `linux.processes` | `pipe-look` | `explainer` |
| `linux.processes` | `quiz` | `quiz` |
| `linux.rootfs` | `lab` | `terminal` |
| `linux.rootfs` | `quiz` | `quiz` |
| `linux.scripts` | `lab` | `terminal` |
| `linux.scripts` | `quiz` | `quiz` |
| `linux.scripts` | `xtrace` | `docs` |
| `linux.services` | `boot` | `explainer` |
| `linux.services` | `lab` | `terminal` |
| `linux.services` | `limit` | `docs` |
| `linux.services` | `quiz` | `quiz` |
| `linux.services` | `restart` | `explainer` |
| `linux.ssh` | `lab` | `terminal` |
| `linux.ssh` | `quiz` | `quiz` |
| `linux.ssh-hops` | `explain` | `explainer` |
| `linux.ssh-hops` | `lab` | `linux.lab` |
| `linux.ssh-hops` | `quiz` | `quiz` |
| `linux.streams` | `lab` | `terminal` |
| `linux.streams` | `quiz` | `quiz` |
| `linux.streams` | `word` | `docs` |
| `linux.terminal` | `lab` | `terminal` |
| `linux.terminal` | `quiz` | `quiz` |
| `linux.threads` | `lab` | `terminal` |
| `linux.threads` | `quiz` | `quiz` |
| `linux.users` | `lab` | `terminal` |
| `linux.users` | `quiz` | `quiz` |
| `linux.web-openrc` | `lab` | `linux.lab` |
| `linux.web-openrc` | `quiz` | `quiz` |
| `marketing.analytics` | `principles` | `principles` |
| `marketing.analytics` | `quiz` | `quiz` |
| `marketing.blog-distribution` | `quiz-1` | `quiz` |
| `marketing.blog-distribution` | `task-1` | `written` |
| `marketing.blog-distribution` | `widget-1` | `deptsim` |
| `marketing.blog-formats` | `quiz-1` | `quiz` |
| `marketing.blog-formats` | `task-1` | `written` |
| `marketing.cases` | `quiz-1` | `quiz` |
| `marketing.cases` | `task-1` | `written` |
| `marketing.community` | `principles` | `principles` |
| `marketing.community` | `quiz` | `quiz` |
| `marketing.content` | `principles` | `principles` |
| `marketing.content` | `quiz` | `quiz` |
| `marketing.email-newsletter` | `quiz-1` | `quiz` |
| `marketing.email-newsletter` | `task-1` | `written` |
| `marketing.email-newsletter` | `widget-1` | `marketing.dns-lab` |
| `marketing.events` | `loop` | `explainer` |
| `marketing.events` | `principles` | `principles` |
| `marketing.fundamentals` | `principles` | `principles` |
| `marketing.fundamentals` | `quiz` | `quiz` |
| `marketing.paid` | `quiz-1` | `quiz` |
| `marketing.paid` | `task-1` | `written` |
| `marketing.paid` | `widget-1` | `marketing.budget` |
| `marketing.platforms` | `principles` | `principles` |
| `marketing.platforms` | `quiz` | `quiz` |
| `marketing.platforms-github` | `quiz-1` | `quiz` |
| `marketing.platforms-github` | `task-1` | `written` |
| `marketing.platforms-hn` | `quiz-1` | `quiz` |
| `marketing.platforms-hn` | `task-1` | `written` |
| `marketing.platforms-linkedin` | `quiz-1` | `quiz` |
| `marketing.platforms-linkedin` | `task-1` | `written` |
| `marketing.platforms-map` | `quiz-1` | `quiz` |
| `marketing.platforms-map` | `task-1` | `written` |
| `marketing.platforms-media` | `quiz-1` | `quiz` |
| `marketing.platforms-media` | `task-1` | `written` |
| `marketing.platforms-reddit` | `quiz-1` | `quiz` |
| `marketing.platforms-reddit` | `task-1` | `written` |
| `marketing.platforms-ru` | `quiz-1` | `quiz` |
| `marketing.platforms-ru` | `task-1` | `written` |
| `marketing.platforms-syndication` | `quiz-1` | `quiz` |
| `marketing.platforms-syndication` | `task-1` | `written` |
| `marketing.platforms-x-bluesky` | `quiz-1` | `quiz` |
| `marketing.platforms-x-bluesky` | `task-1` | `written` |
| `marketing.platforms-youtube` | `quiz-1` | `quiz` |
| `marketing.platforms-youtube` | `task-1` | `written` |
| `marketing.podcast-own` | `quiz-1` | `quiz` |
| `marketing.podcast-own` | `task-1` | `written` |
| `marketing.regions` | `principles` | `principles` |
| `marketing.regions` | `quiz` | `quiz` |
| `marketing.regions` | `regions` | `marketing.regions` |
| `marketing.search-changes` | `quiz-1` | `quiz` |
| `marketing.search-changes` | `task-1` | `written` |
| `marketing.search-docs` | `quiz-1` | `quiz` |
| `marketing.search-docs` | `task-1` | `written` |
| `marketing.search-llm` | `quiz-1` | `quiz` |
| `marketing.search-llm` | `task-1` | `written` |
| `marketing.search-llm` | `widget-1` | `template` |
| `marketing.sim-quarter` | `task-1` | `written` |
| `marketing.sim-quarter` | `widget-1` | `deptsim` |
| `marketing.site` | `quiz-1` | `quiz` |
| `marketing.site` | `task-1` | `written` |
| `marketing.vaccine` | `principles` | `principles` |
| `marketing.vaccine` | `quiz` | `quiz` |
| `marketing.video` | `principles` | `principles` |
| `methodology.agile` | `anatomy` | `docs` |
| `methodology.agile` | `exit` | `quiz` |
| `methodology.agile` | `exit-practice` | `quiz` |
| `methodology.agile` | `practice-sprint` | `terminal` |
| `methodology.batch` | `exit` | `quiz` |
| `methodology.batch` | `exit-practice` | `quiz` |
| `methodology.batch` | `practice` | `terminal` |
| `methodology.black-friday` | `practice` | `flowlab.board` |
| `methodology.black-friday` | `review` | `quiz` |
| `methodology.board` | `exit` | `quiz` |
| `methodology.board` | `practice` | `flowlab.board` |
| `methodology.bottleneck` | `exit` | `quiz` |
| `methodology.bottleneck` | `exit-practice` | `quiz` |
| `methodology.bottleneck` | `find` | `docs` |
| `methodology.bottleneck` | `forcing` | `docs` |
| `methodology.bottleneck` | `look` | `explainer` |
| `methodology.bottleneck` | `practice-beginner` | `terminal` |
| `methodology.business` | `exit` | `quiz` |
| `methodology.business` | `exit-exp` | `quiz` |
| `methodology.culture` | `exit` | `quiz` |
| `methodology.dora` | `exit` | `quiz` |
| `methodology.dora` | `exit-practice` | `quiz` |
| `methodology.dora` | `practice` | `terminal` |
| `methodology.flow` | `anatomy` | `docs` |
| `methodology.flow` | `exit` | `quiz` |
| `methodology.flow` | `exit-practice` | `quiz` |
| `methodology.flow` | `find` | `docs` |
| `methodology.flow` | `practice-wip` | `terminal` |
| `methodology.incident` | `exit` | `quiz` |
| `methodology.incident` | `look` | `explainer` |
| `methodology.little` | `exit` | `quiz` |
| `methodology.little` | `practice` | `flowlab.board` |
| `methodology.pipeline` | `exit` | `quiz` |
| `methodology.pipeline` | `look` | `explainer` |
| `methodology.sre` | `anatomy` | `docs` |
| `methodology.sre` | `exit` | `quiz` |
| `methodology.sre` | `look` | `explainer` |
| `methodology.value-stream` | `exit` | `quiz` |
| `methodology.value-stream` | `look` | `explainer` |
| `methodology.work-types` | `exit` | `quiz` |
| `metrics.activation` | `download-metrics-cohorts` | `template` |
| `metrics.activation` | `quiz-1` | `quiz` |
| `metrics.activation` | `task-1` | `written` |
| `metrics.arr` | `download-metrics-arr` | `template` |
| `metrics.arr` | `download-metrics-arr-start` | `template` |
| `metrics.arr` | `quiz-1` | `quiz` |
| `metrics.arr` | `task-1` | `written` |
| `metrics.attribution` | `quiz-1` | `quiz` |
| `metrics.attribution` | `task-1` | `written` |
| `metrics.channels` | `quiz-1` | `quiz` |
| `metrics.channels` | `task-1` | `written` |
| `metrics.contract` | `quiz-1` | `quiz` |
| `metrics.contract` | `task-1` | `written` |
| `metrics.dashboards` | `quiz-1` | `quiz` |
| `metrics.dashboards` | `task-1` | `written` |
| `metrics.efficiency` | `quiz-1` | `quiz` |
| `metrics.efficiency` | `task-1` | `written` |
| `metrics.forecast` | `download-metrics-forecast` | `template` |
| `metrics.forecast` | `quiz-1` | `quiz` |
| `metrics.forecast` | `task-1` | `written` |
| `metrics.funnel` | `quiz-1` | `quiz` |
| `metrics.funnel` | `task-1` | `written` |
| `metrics.lift` | `download-metrics-ab` | `template` |
| `metrics.lift` | `quiz-1` | `quiz` |
| `metrics.lift` | `task-1` | `written` |
| `metrics.pipeline` | `download-metrics-pipeline` | `template` |
| `metrics.pipeline` | `quiz-1` | `quiz` |
| `metrics.pipeline` | `task-1` | `written` |
| `metrics.pqa` | `quiz-1` | `quiz` |
| `metrics.pqa` | `task-1` | `written` |
| `metrics.stories` | `quiz-1` | `quiz` |
| `metrics.stories` | `task-1` | `written` |
| `metrics.truth` | `quiz-1` | `quiz` |
| `metrics.truth` | `task-1` | `written` |
| `metrics.usage` | `quiz-1` | `quiz` |
| `metrics.usage` | `task-1` | `written` |
| `monitoring.alerts` | `forcing` | `docs` |
| `monitoring.alerts` | `lab` | `terminal` |
| `monitoring.alerts` | `look` | `explainer` |
| `monitoring.alerts` | `quiz` | `quiz` |
| `monitoring.histogram` | `bench` | `obs.workbench` |
| `monitoring.histogram` | `quiz` | `quiz` |
| `monitoring.incident` | `drill` | `obs.workbench` |
| `monitoring.incident` | `quiz` | `quiz` |
| `monitoring.k8s` | `bench` | `obs.workbench` |
| `monitoring.k8s` | `forcing` | `docs` |
| `monitoring.k8s` | `lab` | `terminal` |
| `monitoring.k8s` | `look` | `explainer` |
| `monitoring.k8s` | `quiz` | `quiz` |
| `monitoring.k8s` | `silent` | `k8s.constructor` |
| `monitoring.logs` | `anatomy` | `docs` |
| `monitoring.logs` | `explore` | `obs.logs` |
| `monitoring.logs` | `forcing` | `docs` |
| `monitoring.logs` | `lab` | `terminal` |
| `monitoring.logs` | `look` | `explainer` |
| `monitoring.logs` | `quiz` | `quiz` |
| `monitoring.promql` | `bench` | `obs.workbench` |
| `monitoring.promql` | `bench-rate` | `obs.workbench` |
| `monitoring.promql` | `bench-select` | `obs.workbench` |
| `monitoring.promql` | `findfn` | `docs` |
| `monitoring.promql` | `quiz` | `quiz` |
| `monitoring.series` | `bench` | `obs.workbench` |
| `monitoring.series` | `quiz` | `quiz` |
| `monitoring.traces` | `anatomy` | `docs` |
| `monitoring.traces` | `logs` | `obs.logs` |
| `monitoring.traces` | `look` | `explainer` |
| `monitoring.traces` | `quiz` | `quiz` |
| `monitoring.traces` | `viewer` | `obs.traces` |
| `networks.arp` | `anatomy` | `docs` |
| `networks.arp` | `lab` | `terminal` |
| `networks.arp` | `look` | `explainer` |
| `networks.arp` | `quiz` | `quiz` |
| `networks.dhcp` | `findflag` | `docs` |
| `networks.dhcp` | `lab` | `terminal` |
| `networks.dhcp` | `lab-rogue` | `terminal` |
| `networks.dhcp` | `look` | `explainer` |
| `networks.dhcp` | `quiz` | `quiz` |
| `networks.dns` | `findflag` | `docs` |
| `networks.dns` | `forcing` | `docs` |
| `networks.dns` | `forcing-guided` | `docs` |
| `networks.dns` | `lab` | `terminal` |
| `networks.dns` | `look` | `explainer` |
| `networks.dns` | `quiz` | `quiz` |
| `networks.dns` | `quiz-deep` | `quiz` |
| `networks.envelopes` | `anatomy` | `docs` |
| `networks.envelopes` | `lab` | `terminal` |
| `networks.envelopes` | `look` | `explainer` |
| `networks.envelopes` | `quiz` | `quiz` |
| `networks.frames` | `findflag` | `docs` |
| `networks.frames` | `lab` | `terminal` |
| `networks.frames` | `look` | `explainer` |
| `networks.frames` | `quiz` | `quiz` |
| `networks.http` | `anatomy` | `docs` |
| `networks.http` | `forcing` | `docs` |
| `networks.http` | `forcing-guided` | `docs` |
| `networks.http` | `lab` | `terminal` |
| `networks.http` | `quiz` | `quiz` |
| `networks.internet` | `anatomy` | `docs` |
| `networks.internet` | `lab` | `terminal` |
| `networks.internet` | `look` | `explainer` |
| `networks.internet` | `quiz` | `quiz` |
| `networks.linux-lab` | `capture` | `net.reallab` |
| `networks.linux-lab` | `dnsmasq` | `net.reallab` |
| `networks.linux-lab` | `firewall` | `net.reallab` |
| `networks.linux-lab` | `netns` | `net.reallab` |
| `networks.linux-lab` | `quiz` | `quiz` |
| `networks.linux-lab` | `router` | `net.reallab` |
| `networks.linux-lab` | `vlan` | `net.reallab` |
| `networks.nat` | `anatomy` | `docs` |
| `networks.nat` | `findflag` | `docs` |
| `networks.nat` | `lab` | `terminal` |
| `networks.nat` | `look` | `explainer` |
| `networks.nat` | `quiz` | `quiz` |
| `networks.protocols` | `catalogue` | `net.protocols` |
| `networks.protocols` | `quiz` | `quiz` |
| `networks.protocols` | `quiz-deep` | `quiz` |
| `networks.proxy` | `anatomy` | `docs` |
| `networks.proxy` | `forcing` | `docs` |
| `networks.proxy` | `lab` | `terminal` |
| `networks.proxy` | `look` | `explainer` |
| `networks.proxy` | `quiz` | `quiz` |
| `networks.routing` | `findflag` | `docs` |
| `networks.routing` | `lab` | `terminal` |
| `networks.routing` | `lab-trace` | `terminal` |
| `networks.routing` | `look` | `explainer` |
| `networks.routing` | `quiz` | `quiz` |
| `networks.subnets` | `calc` | `net.subnet-calc` |
| `networks.subnets` | `drill` | `net.subnet-drill` |
| `networks.subnets` | `drill-split` | `net.subnet-drill` |
| `networks.subnets` | `findflag` | `docs` |
| `networks.subnets` | `lab` | `terminal` |
| `networks.subnets` | `quiz` | `quiz` |
| `networks.tls` | `findflag` | `docs` |
| `networks.tls` | `forcing` | `docs` |
| `networks.tls` | `lab` | `terminal` |
| `networks.tls` | `look` | `explainer` |
| `networks.tls` | `quiz` | `quiz` |
| `networks.transport` | `forcing` | `docs` |
| `networks.transport` | `forcing-guided` | `docs` |
| `networks.transport` | `lab` | `terminal` |
| `networks.transport` | `look` | `explainer` |
| `networks.transport` | `quiz` | `quiz` |
| `networks.troubleshooting` | `incident1` | `terminal` |
| `networks.troubleshooting` | `incident2` | `terminal` |
| `networks.troubleshooting` | `look` | `explainer` |
| `networks.troubleshooting` | `quiz` | `quiz` |
| `networks.vpn` | `look` | `explainer` |
| `networks.vpn` | `quiz` | `quiz` |
| `orient.inside` | `look` | `explainer` |
| `orient.inside` | `quiz` | `quiz` |
| `orient.inside` | `try` | `terminal` |
| `orient.inside` | `try-cpu` | `terminal` |
| `orient.net` | `quiz` | `quiz` |
| `orient.net` | `try` | `terminal` |
| `orient.places` | `look` | `explainer` |
| `orient.places` | `quiz` | `quiz` |
| `orient.places` | `try` | `terminal` |
| `orient.release` | `look` | `explainer` |
| `orient.release` | `quiz` | `quiz` |
| `orient.release` | `try` | `terminal` |
| `orient.rent` | `look` | `explainer` |
| `orient.rent` | `quiz` | `quiz` |
| `orient.requests` | `look` | `explainer` |
| `orient.requests` | `quiz` | `quiz` |
| `orient.requests` | `try` | `terminal` |
| `orient.system` | `look` | `explainer` |
| `orient.system` | `quiz` | `quiz` |
| `orient.system` | `try` | `terminal` |
| `orient.team` | `quiz` | `quiz` |
| `orient.team` | `review` | `quiz` |
| `orient.text` | `doc` | `docs` |
| `orient.text` | `quiz` | `quiz` |
| `orient.text` | `try` | `terminal` |
| `orient.together` | `find` | `docs` |
| `orient.together` | `look` | `explainer` |
| `orient.together` | `quiz` | `quiz` |
| `orient.together` | `try` | `terminal` |
| `oss.cncf-benefits` | `task-1` | `written` |
| `oss.cncf-path` | `task-1` | `written` |
| `oss.cncf-path` | `widget-1` | `deptsim` |
| `oss.community` | `task-1` | `written` |
| `oss.contributors` | `task-1` | `written` |
| `oss.contributors` | `widget-1` | `health` |
| `oss.crises` | `task-1` | `written` |
| `oss.donation` | `quiz-1` | `quiz` |
| `oss.donation` | `task-1` | `written` |
| `oss.foundations` | `quiz-1` | `quiz` |
| `oss.foundations` | `task-1` | `written` |
| `oss.governance` | `task-1` | `written` |
| `oss.governance` | `widget-1` | `governance` |
| `oss.revenue` | `task-1` | `written` |
| `oss.why` | `task-1` | `written` |
| `oss.why` | `widget-1` | `boundary` |
| `pr.analysts` | `task-1` | `written` |
| `pr.analysts` | `widget-1` | `template` |
| `pr.crisis` | `task-1` | `written` |
| `pr.crisis` | `widget-1` | `rubric` |
| `pr.crisis` | `widget-2` | `deptsim` |
| `pr.founder` | `task-1` | `written` |
| `pr.founder` | `widget-1` | `template` |
| `pr.press` | `task-1` | `written` |
| `pr.press` | `widget-1` | `template` |
| `product.cases` | `quiz-1` | `quiz` |
| `product.cases` | `task-1` | `written` |
| `product.category` | `principles` | `principles` |
| `product.category` | `quiz` | `quiz` |
| `product.chasm` | `principles` | `principles` |
| `product.chasm` | `quiz` | `quiz` |
| `product.discovery` | `principles` | `principles` |
| `product.discovery` | `quiz` | `quiz` |
| `product.first-minutes` | `principles` | `principles` |
| `product.first-minutes` | `quiz` | `quiz` |
| `product.gtm` | `principles` | `principles` |
| `product.gtm` | `quiz` | `quiz` |
| `product.interfaces` | `principles` | `principles` |
| `product.interfaces` | `quiz` | `quiz` |
| `product.opencore` | `opencore-model` | `product.opencore` |
| `product.opencore` | `principles` | `principles` |
| `product.opencore` | `quiz` | `quiz` |
| `product.oss` | `principles` | `principles` |
| `product.oss` | `quiz` | `quiz` |
| `product.pricing` | `principles` | `principles` |
| `product.pricing` | `quiz` | `quiz` |
| `product.pricing` | `valuemetric-model` | `product.valuemetric` |
| `product.priorities` | `principles` | `principles` |
| `product.priorities` | `quiz` | `quiz` |
| `product.roadmap` | `task-1` | `written` |
| `product.signals` | `task-1` | `written` |
| `product.signals` | `widget-1` | `template` |
| `product.signals` | `widget-2` | `deptsim` |
| `sales.asymmetry` | `principles` | `principles` |
| `sales.asymmetry` | `quiz` | `quiz` |
| `sales.d100-inperson` | `task-1` | `written` |
| `sales.d100-presence` | `task-1` | `written` |
| `sales.d100-sequence` | `task-1` | `written` |
| `sales.d100-signals` | `task-1` | `written` |
| `sales.d100-signals` | `widget-1` | `signal-feed` |
| `sales.d100-tracking` | `task-1` | `written` |
| `sales.d100-tracking` | `widget-1` | `template` |
| `sales.d100-us` | `task-1` | `written` |
| `sales.d100-us` | `widget-1` | `rubric` |
| `sales.d100-us` | `widget-2` | `deptsim` |
| `sales.fundamentals` | `principles` | `principles` |
| `sales.regions` | `principles` | `principles` |
| `sales.roles` | `buying` | `explainer` |
| `sales.roles` | `principles` | `principles` |
| `sales.segments` | `principles` | `principles` |
| `sales.touches` | `funnel` | `sales.funnel` |
| `sales.touches` | `principles` | `principles` |
| `scithink.anecdote` | `quiz` | `quiz` |
| `scithink.base-rate` | `quiz` | `quiz` |
| `scithink.bayes` | `practice` | `written` |
| `scithink.calibration` | `trainer` | `scithink.calibration` |
| `scithink.control` | `practice` | `written` |
| `scithink.correlation` | `practice` | `written` |
| `scithink.correlation` | `scheme` | `explainer` |
| `scithink.fakes` | `quiz` | `quiz` |
| `scithink.final` | `quiz` | `quiz` |
| `scithink.final` | `register` | `written` |
| `scithink.final` | `texts` | `written` |
| `scithink.numbers` | `quiz` | `quiz` |
| `scithink.story` | `practice` | `written` |
| `scithink.studies` | `quiz` | `quiz` |
| `strategy.agents` | `task-1` | `written` |
| `strategy.category` | `task-1` | `written` |
| `strategy.ecosystem` | `task-1` | `written` |
| `strategy.event-offer` | `quiz-1` | `quiz` |
| `strategy.event-offer` | `task-1` | `written` |
| `strategy.market-events` | `quiz-1` | `quiz` |
| `strategy.market-events` | `task-1` | `written` |
| `strategy.market-shifts` | `quiz-1` | `quiz` |
| `strategy.market-shifts` | `task-1` | `written` |
| `strategy.sovereignty` | `quiz-1` | `quiz` |
| `strategy.sovereignty` | `task-1` | `written` |
| `strategy.standards` | `task-1` | `written` |

## Проверки

- `npm run typecheck` — успешно после последних изменений.
- Полный запуск `npx vitest run tests --configLoader runner --maxWorkers 2 --testTimeout 15000` выполнен. Во время массового браузерного обхода он завершился тайм-аутами в `kubernetes-addons.test.ts` и `finance-workbooks.test.ts`; остальные 1609 тестов прошли.
- Финальный запуск `npx vitest run tests --configLoader runner --maxWorkers 2 --testTimeout 15000 --exclude tests/kubernetes-addons.test.ts` — 142 файла и 1589 тестов прошли, 8 файлов и 23 теста пропущены. Сюда входят последние изменения внешней самопроверки.
- `npx vitest run tests/kubernetes-addons.test.ts --configLoader runner --testTimeout 15000` — все 25 тестов прошли отдельно. При стандартном лимите 5 секунд нестабильный тест завершался по тайм-ауту даже отдельно.
- `finance-workbooks.test.ts` также прошёл отдельно с лимитом 15 секунд и в финальном общем запуске. Финансовые расчёты не менялись.
- Повторный браузерный обход: все разделы сняты на 1280 и 390 пикселях; 0 пропусков, 0 ошибок захвата, 0 ошибок JavaScript. Для 827 исходных замечаний проверен показ исправленных инструкций на обеих ширинах. Для всех 24 снимков практик `rubric`, `roleplay` и `deptsim` дополнительно проверена видимая кнопка самопроверки.
- `node --check web/scripts/audit-task-clarity.mjs` и `git diff --check` — успешно. Сборка `npm run build` не запускалась; `web/src/engine/rv64`, `lab/` и `deploy/` не менялись.

Локальные журналы проверок лежат в `web/.cache/task-clarity-*.log`. Снимки и журналы в коммиты не входят.
