# 06. Git, CI/CD, IaC (Ansible, Terraform) и мониторинг — проект блоков

Роль автора: DevOps/SRE-инженер, отвечающий за блоки инфраструктуры как кода, конвейеров поставки и наблюдаемости. Документ описывает учебные блоки DevOps Trainer: **G — Git**, **A — CI/CD**, **B1 — Ansible**, **B2 — Terraform**, **B3 — кластер Kubernetes из кода** (третий этап Kubernetes, R12), **C — мониторинг**. По каждому блоку здесь есть место в маршруте и порядок понятий по графу 01, план учебника (тезисы глав), процессные объяснения по экранам, лестница документации, интерактивы, тренажёры с проверками в контракте 09, практический экзамен в формате 10 и источники на английском и русском. В конце — общий технический стек, проверка достоверности симуляторов, риски, зависимости от других ролей и список изменений после ревью. Редакция от 18.11.2026.

Базовая программа — чек-лист `source/checklist.txt`: шаг 01 (CI/CD как практика, «где заканчивается одно и начинается другое»), шаг 06 (Ansible/Terraform, «понять основную концепцию, основные сущности»), шаг 07 (метрики, трейсы, логи, алерты, Grafana + Prometheus), пет-проекты «сайт-визитка в Docker с CI/CD на VPS», «docker-compose + GitLab пайплайн», «мониторинг Prometheus + Grafana», «автоматизация с Ansible» и вопрос с собеседований «CI vs CD vs CDP». Понятия CI, Continuous Delivery, Continuous Deployment, пайплайн как идея и метрики DORA (M13–M17) вводит блок методологии (документ 07); блоки этого документа на них опираются и показывают их в коде.

Приоритеты документа следуют требованию владельца R1. Основа — связный учебник со строгим порядком понятий, процессные объяснения и привычка читать документацию. Практика стоит на этих трёх опорах: тренажёр, в котором ученик не понимает, что происходит внутри, не учит.

---

## 0. Сквозные решения

### 0.1. Место блоков в маршруте

Маршрут курса задан в 01, раздел 5: методология → Linux → сети → Docker → CI/CD с Git → Kubernetes → IaC → мониторинг → пет-проект → карьера. Блоки этого документа встают в него так, чтобы ни одно понятие не использовалось раньше своих предпосылок в графе 01 (раздел 6.2).

| Позиция в маршруте | Модуль | Понятия графа | Почему здесь |
|---|---|---|---|
| Блок Linux, после L21 (скрипты) | **Y1. YAML и JSON** — урок L31. Содержание пишется в этом документе (раздел 2.7) и передаётся в блок Linux (документ 02) | L31 | YAML нужен раньше Docker: compose-файлы и манифесты. Граф 01 уже держит его в Linux; второго введения YAML в маршруте нет |
| Блок Linux, последний модуль | **G-local. Git на своей машине** (G1–G5, G8a) | C01, C02, C16, C17, C03, C06, C21 (L1/L2) | Dockerfile и compose-файлы блока Docker живут в локальном репозитории. Предпосылки C01–C03 — только файлы, каталоги, редактор и оболочка (F12, L04) |
| Начало блока CI/CD (после Docker и, значит, после сетей) | **G-remote. Удалённый репозиторий и merge request** (G6, G7, G8b) | C04, C05, C15, C18, C19, C20 | C04 требует N14 (HTTP), C05 — M14 (CI из методологии). До CI/CD удалённый репозиторий никому не нужен |
| Блок CI/CD | **Y-traps** (урок «YAML глазами парсера»), затем **A1–A6**, **A5b** (выкладка по SSH и стратегии), **A6g** (GitHub Actions) | C30, C07–C12, C22–C27, C31, C13, C14 | Джоба запускается в образе контейнера (D08, D11), сборка образа — стадия пайплайна (D18). C14 — предпосылка K12 (rolling update), поэтому стратегии выкладки вводятся до Kubernetes |
| Блок Kubernetes, после K28 (Helm) и K29 (GitOps) | **A7. Деплой в Kubernetes из CI** | C28, C29 | Нужны Deployment, RBAC, Helm и GitOps, которые вводит 05 |
| Блок IaC | **B1. Ansible**, затем **B2. Terraform**, затем мост **E-REC** (I22) | I01–I27 | Ansible первым: он работает с уже известными сущностями Linux (пакет, файл, unit). Terraform вводит новую сущность — облачный ресурс (I03 требует K31, который ученик уже прошёл руками на втором этапе Kubernetes). Граф допускает оба порядка: I13 требует I05 и I10 одновременно, ни одно из них не требует другого |
| Финал блока IaC | **B3. Кластер Kubernetes из кода** — третий этап Kubernetes (R12): kubeadm на 3+ ВМ, ВМ заказывает Terraform, настраивает Ansible | K32, I23 | Требования R12 и порядок 01 «IaC после Kubernetes» сходятся только так: этапы 1 и 2 (симулятор и k3s) проходят в блоке Kubernetes, где ученик заказывает ВМ руками и чувствует боль; этап 3 открывается, когда Terraform и Ansible уже введены. В графе 01 добавляется ребро K32 → I05, I10 |
| Блок мониторинга | **C1–C17** | O01–O25 | Метрики узлов опираются на Linux, сервисов — на HTTP, метрики контейнеров — на cgroups (D04, R6), обнаружение целей в Kubernetes — на EndpointSlice (K14, R9) |
| Пет-проекты и итоговый экзамен (документ 10) | Критерии приёмки пет-проектов 5 и 6 и частей A3, A5 итогового экзамена (раздел 8) | — | Механику проверки даёт агент `trainer-check` (09, 5.4), содержательные критерии — этот документ |

Модуль A0 «Методология CI/CD» из первой редакции снят: определения CI, Continuous Delivery и Continuous Deployment, пять метрик DORA и симуляция размера партии принадлежат блоку методологии (07: M13–M17, E10 «Пять приборов», `flowlab`). Из A0 в этом документе остался один экран-мост — A-I6 «Одна строка», где разница Delivery и Deployment показана строкой YAML (раздел 3).

### 0.2. Порядок введения понятий и новые идентификаторы графа

Каждый **экран** (сцена) объявляет `introduces` — не больше одного понятия — и `uses`. Сборка проверяет граф, предпосылки и словоформы, как требует 01, 6.1. Крупные понятия графа 01 (C08 «Файл пайплайна: стадия, задача, шаг», O06 «PromQL: селекторы, `rate`, `sum by`») содержат по три-четыре самостоятельные идеи, поэтому этот документ предлагает дополнить граф идентификаторами C16–C31, I15–I27, O15–O25 и сузить формулировки I11, O06, O08. Мелкие детали, которые не заслуживают отдельного понятия (`policy: pull` у кэша, `expire_in` у артефакта, `allow_stopping_for_update`), оформляются как `facet` существующего понятия: они не считаются введением и не ломают правило «одно понятие на экран».

| ID | Понятие | Требует | Блок |
|---|---|---|---|
| C16 | Индекс (staging area); в русском тексте только «индекс» | C02 | G-local |
| C17 | HEAD и ветка как подвижный указатель | C02 | G-local |
| C03 (уточнение) | Слияние и конфликт | C17 | G-local |
| C18 | Rebase и переписывание истории | C03, C04 | G-remote |
| C19 | `reset` и `revert`: отменить коммит двумя способами | C17, C04 | G-remote |
| C20 | Reflog: журнал движений указателей | C19 | G-remote, L2 |
| C21 | Объекты Git: blob, tree, commit | C02 | G-local, L1/L2 |
| C22 | Исполнитель раннера и образ джобы (`image:`) | C07, D11, D08 | A2 |
| C23 | Кэш CI (против артефакта) | C09 | A3 |
| C24 | Правила запуска и события пайплайна (`rules`, MR, тег) | C08, C05, C15 | A6 |
| C25 | Окружение CI и история деплоев (environment) | C12, F10 | A5 |
| C26 | Граф джоб `needs` | C08 | A6 |
| C27 | Матрица и переиспользование: `default`, `extends`, `include`, reusable workflows | C08 | A6 |
| C28 | Деплой в Kubernetes из CI (push-модель) | C25, K12, K25, K28 | A7 |
| C29 | Деплой через GitOps (pull-модель): CI пишет тег в репозиторий конфигурации | C28, K29 | A7 |
| C30 | Ловушки YAML 1.1 и 1.2 (`yes`, `on`, `0755`, `1.10`) | L31 | Y-traps |
| C31 | Те же понятия в GitHub Actions: `on`, `jobs`, `steps`, `uses` | C08, C12, C24 | A6g |
| I11 (уточнение) | Переменные и шаблоны Jinja2 | I10 | B1 |
| I15 | Факты Ansible | I10 | B1 |
| I16 | Handler | I11 | B1 |
| I17 | Приоритет переменных | I11, I12 | B1 |
| I18 | Граф ресурсов Terraform, `depends_on` | I05 | B2 |
| I19 | Изменение на месте и пересоздание | I05, I06 | B2 |
| I20 | `count` и `for_each`, адрес экземпляра | I07 | B2 |
| I21 | `import`, `moved`, `removed`, `state mv` | I06, I20 | B2 |
| I22 | Три исполнителя сверки: Ansible, Terraform, контроллер | I13, K03 | мост E-REC |
| I23 | Кластер Kubernetes из кода: Terraform + Ansible + kubeadm | I13, I12, K31 | B3 |
| I24 | Полное имя модуля (FQCN) и коллекции | I10 | B1 |
| I25 | Check mode и diff | I10 | B1 |
| I26 | Объектное хранилище и бакет | I03 | B2 |
| I27 | Terraform в CI: план в MR, `apply` вручную | I06, C24 | B2 |
| O06 (уточнение) | PromQL: instant vector, селекторы, матчеры | O03, O04 | C5 |
| O08 (уточнение) | Правило алерта | O16 | C11 |
| O15 | Кардинальность | O02 | C2 |
| O16 | Range vector, `rate` и `increase` | O06, O03 | C6 |
| O17 | Агрегация `by` / `without` | O06 | C7 |
| O18 | Сопоставление векторов: `on`, `ignoring`, `group_left` | O17 | C7 |
| O19 | Гистограмма: бакеты `le` и `histogram_quantile` | O03, O16, O17 | C8 |
| O20 | Recording rule | O16 | C12 |
| O21 | Состояния алерта и `for`: inactive, pending, firing | O08 | C11 |
| O22 | Alertmanager: маршрут, группировка, подавление, тишина | O21 | C11 |
| O23 | Burn rate | O09 | C15 |
| O24 | Метрики контейнеров из cgroups | O05, D04, K22 | C16 |
| O25 | Обнаружение целей в Kubernetes (`kubernetes_sd_configs`, EndpointSlice) | O04, K14 | C16 |

Цепочки введения по блокам (через стрелку — порядок экранов; в скобках — `facet`, отдельным понятием не считается):

| Блок | Порядок |
|---|---|
| G-local | C01 репозиторий → C02 коммит и история (хэш как имя, `log`, `diff`) → C16 индекс → C17 HEAD и ветка → C03 слияние: fast-forward, merge-коммит, конфликт → C06 `.gitignore` и секреты вне репозитория → C21 объекты (L1/L2) |
| G-remote | C04 удалённый репозиторий (origin, `push`/`fetch`/`pull`, отказ non-fast-forward) → C05 merge request и ревью (защищённая ветка как facet) → C15 тег и semver → C18 rebase (средний) → C19 `reset` и `revert` → C20 reflog (опытный) |
| Y1 (в блоке Linux) | L31: документ → ключ и значение → словарь → список → вложенность отступами → многострочные `\|` и `>` (всё — facets одного понятия L31, по экрану на facet) |
| Y-traps, A1–A7 | C30 ловушки YAML → C07 раннер → C08 файл пайплайна (джоба, скрипт, лог, статус — facets) → стадия (facet C08) → C22 исполнитель и образ → C10 тест и код возврата → C09 артефакт → C23 кэш → C12 переменные и секреты (masked, protected — facets) → C11 сборка и публикация образа → C25 окружение (ручной запуск `when: manual` — facet) → C13 выкладка по SSH и compose → C14 стратегии выкладки → C24 правила и события → C26 `needs` → C27 матрица и переиспользование → C31 GitHub Actions → C28 деплой в Kubernetes → C29 GitOps-деплой |
| B1 | I01 инфраструктура как код → I02 идемпотентность → I09 инвентарь и SSH → I10 модуль, задача, плей, плейбук (ad-hoc, ok/changed/failed — facets) → I24 FQCN и коллекции → I15 факты → I11 переменные и шаблоны → I16 handler → (`when`, `loop`, `register` — facets I10) → I12 роль → I17 приоритет переменных → I25 check mode и diff → I14 секреты (vault) |
| B2 | I03 облачный ресурс и API → I04 провайдер, `resource`, HCL, ссылки → I05 `init`/`plan`/`apply`/`destroy` → I06 state (`known after apply` — facet) → I19 на месте и пересоздание → I18 граф и `depends_on` → I07 переменные, `output`, `locals`, `data`, модули → I08 дрейф → I20 `count` и `for_each` → I26 бакет → I06 (продолжение: удалённый state и блокировка) → I21 `import`, `moved`, `removed` → I13 создание и настройка → I27 Terraform в CI → I22 три исполнителя сверки |
| B3 | K31 (повтор карточкой) → I23 кластер из кода → K32 kubeadm, PKI control plane (содержание — 05, R3/R4) |
| C | O01 наблюдаемость → O02 временной ряд → O15 кардинальность → O03 типы метрик → O04 Prometheus: pull, `/metrics`, targets, `up` → O05 экспортёры → O06 instant vector и селекторы → O16 range vector и `rate` → O17 агрегация → O18 сопоставление векторов → O19 гистограммы → O07 Grafana → O10 USE, RED, золотые сигналы → O08 правило алерта → O21 состояния и `for` → O22 Alertmanager → O20 recording rule → O11 логи → O12 трейсы и OpenTelemetry → O09 SLI, SLO, бюджет → O23 burn rate → O25 обнаружение целей в Kubernetes → O24 метрики контейнеров → O13 kube-state-metrics, ServiceMonitor → O14 Zabbix |

Омонимы разведены отдельными понятиями и словоформами, как требует 01, 6.1. «Индекс» Git (C16) в русском тексте никогда не называется «staging», «стадия» (facet C08) — это stage пайплайна, «тестовое окружение (staging)» — окружение C25. В Edu Cloud зона доступности называется `availability_zone`, а DNS-зона у `edu_dns_record` — `zone`; в B2-2 этому посвящена одна карточка «zone в этой строке — не то же, что zone в той».

### 0.3. Общий стенд в браузере

Все блоки работают поверх **Стенда** — эмулятора оболочки и виртуальной файловой системы, который проектирует роль Linux, в общем воркере `sim.worker.ts` (09, 1.3). От Стенда эти блоки требуют реестра команд (`(argv, io, vfs) => Promise<exitCode>`), VFS с POSIX-путями и правами и нескольких «машин» с собственными hostname, пакетами и сервисами, между которыми ходит `ssh host`. Команды, которые добавляют блоки этого документа:

| Команда | Реализация | Блок |
|---|---|---|
| `git init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`, `merge`, `tag`, `stash`, `clone` | библиотека **isomorphic-git** поверх VFS Стенда | G |
| `git push`, `fetch`, `pull` | своя обёртка: обход объектов `readCommit`/`readTree`/`readBlob`, копирование через `writeObject` в gitdir forge, `writeRef` с проверкой fast-forward (isomorphic-git умеет push только по HTTP) | G |
| `git switch`, `restore`, `reset` (soft, mixed, hard), `revert`, `cherry-pick`, `rebase`, `rebase -i`, `diff`, `show`, `blame`, `bisect`, `reflog` | **наша реализация** поверх `readCommit`/`writeCommit`/`writeRef`/`walk`/`resetIndex`: `revert` и `cherry-pick` — трёхстороннее слияние деревьев на временной ветке, `rebase` — цепочка cherry-pick, `diff` — `walk` и библиотека `diff` (npm), `bisect` — состояние в `.git/BISECT_*`. Reflog — свой слой: каждая наша операция, которая двигает ссылку, пишет строку в `.git/logs/HEAD` и `.git/logs/refs/heads/<ветка>` в формате Git (`<old> <new> <имя> <email> <ts> <tz>\t<сообщение>`), поэтому работают `git reflog` и `HEAD@{2}`. Распознавания переименований при слиянии нет, и упражнения его не требуют. Объём — 2–3 недели отдельной работы | G |
| `glab ci lint`, `actionlint` | ajv + JSON Schema `ci.json` GitLab; actionlint, собранный в wasm | A |
| `gitlab-runner list`, `verify` | TS (сам раннер — часть симулятора пайплайнов) | A |
| `docker build`, `push`, `pull` внутри джобы | **dsim и реестр из документа 04** (09, 1.7) с профилем образа `docker` и сервисом `docker:dind` | A |
| `kubectl`, `helm` внутри джобы | **kube-lite и `helm-engine.wasm` из документа 05** в том же воркере | A7 |
| `ansible`, `ansible-playbook`, `ansible-inventory`, `ansible-galaxy init`, `ansible-doc` | **ansim** — симулятор на TS; `ansible-doc` выдаёт текст, сгенерированный в CI из `ansible-doc -j` настоящего ansible-core | B1 |
| `terraform` / `tofu` (init, fmt, validate, plan, apply, destroy, show, output, state, import, console, graph, providers, version, workspace) | **tfsim** — Go → wasm на `hashicorp/hcl/v2` и `go-cty` (раздел 5.1) | B2 |
| `curl http://<host>:<port>/metrics` | генератор метрик отвечает текстом в формате экспозиции | C |
| `promtool check config`, `promtool check rules`, `promtool test rules`, `promtool query instant <url> '<expr>'` | валидатор, движок PromQL и исполнитель юнит-тестов правил на TS | C |
| `amtool check-config`, `amtool config routes test --config.file=alertmanager.yml <метки>`, `amtool silence add` | симулятор маршрутизации Alertmanager | C |

Стенд принимает и короткие формы (`amtool config routes test severity=critical` без `--config.file` при одном файле в каталоге), но урок всегда показывает полную.

Команды, которые в браузере выполнить нельзя (`npm ci`, `pip install -r`, `go build`), реализованы как **модели инструментов**: они читают настоящие файлы репозитория, проверяют их согласованность, создают ожидаемые выходные файлы и тратят модельное время, зависящее от кэша. Модель — не сценарий: у неё закрытый список поведения, и каждая ошибка сверяется с настоящим инструментом в CI (раздел 9.2).

| Модель | Читает | Создаёт | Ошибки, которые воспроизводит (текст — настоящего инструмента) |
|---|---|---|---|
| `npm ci` | `package.json`, `package-lock.json`, кэш `~/.npm` | `node_modules/` с маркером | lock-файл не совпадает с `package.json` (`npm ERR! cipm can only install packages when your package.json and package-lock.json ... are in sync`); нет lock-файла; без кэша время ×5 |
| `npm test`, `npm run build` | скрипты `package.json` | `dist/` | `test` запускает **настоящие** скрипты-тесты курса (`./test.sh` с `grep`, `diff`, `test`), поэтому красный пайплайн — результат исполнения |
| `pip install -r` | `requirements.txt` | `site-packages/` с маркером | несуществующая версия (`No matching distribution found for …`) |
| `go build` | `go.mod`, `go.sum`, `*.go` | бинарник-маркер | синтаксическая ошибка из фикстуры (позиция и текст `go vet`), нет `go.sum` (`missing go.sum entry`) |

В логе модели — неброская пометка «смоделировано»; в пет-проектах те же шаги выполняются по-настоящему.

Остальной интерфейс — редактор с подсветкой, консоль Edu Cloud, страницы forge, дашборды, графы — веб-панели вокруг терминала. Терминал присутствует всегда: всё, что можно сделать мышью в интерактиве, делается и командой, и панель показывает результат.

### 0.4. Формат контента и проверок

Контент хранится как YAML по образцу `features/model.ts` Sankofa: двуязычные блоки `{en, ru}`, флаги `draft` и `hold`, у фактических утверждений — ссылки на источники. `introduces` и `uses` объявляются у сцены, а не у урока.

```yaml
# content/blocks/cicd/a3-artifacts-cache/lesson.yaml
id: a3-artifacts-cache
block: cicd
level: [L0, L1, L2]
scenes:
  - id: clean-machine
    kind: mechanism
    widget: stepper                     # часть объяснения E-CI, экран 4
    introduces: [C09]
    uses: [C07, C08, C22]
    blocks:
      - id: t1
        role: text
        en: "A job runs on a clean machine. Anything it creates disappears when it ends, unless you ask the runner to keep it."
        ru: "Джоба запускается на чистой машине. Всё, что она создала, исчезает вместе с ней, если не попросить раннер это сохранить."
        draft: true
        sources: [gitlab-artifacts, pro-git-ru]
  - id: second-shelf
    kind: mechanism
    introduces: [C23]
    uses: [C09]
    # ...
exercises: [a3-d1, a3-d2, a3-d3]
```

Проверки упражнений записываются в контракте 09, раздел 2.4: цели `goals[]` с `when`, `keep`, `fail[].say` и обязательным `fail[].term` — ссылкой на понятие, к уроку которого отправляют ученика. Вычислители, которые не сводятся к фактам машины (`lint`, `yaml_path`, `hcl_path`, `plan_expect`, `promql_equiv`, `explain`), подключаются как `eval` и возвращают общий `CheckResult`.

```yaml
# content/blocks/cicd/a3-artifacts-cache/a3-d1.yaml
id: a3-d1
kind: pipeline-fix
level: [L0, L1]
doc_ladder: { step: 2, source: { kind: web, page: "docs.gitlab.com/ci/yaml/#artifactspaths" }, allow_hint_excerpt: true }
task:
  ru: "Джоба deploy падает с «dist/: No such file or directory». Сделайте так, чтобы результат сборки дошёл до деплоя."
  en: "The deploy job fails with 'dist/: No such file or directory'. Make the build result reach the deploy job."
start: { repo: fixtures/site-no-artifacts, pipeline_file: .gitlab-ci.yml }
goals:
  - id: g-lint
    eval: { lint: gitlab }
  - id: g-run
    needs: [ci]
    eval: { run: { event: push, ref: main } }
    when: "ci.pipelines[-1].jobs[name=build].status=success && ci.pipelines[-1].jobs[name=deploy].status=success"
    fail:
      - if: "ci.pipelines[-1].jobs[name=deploy].log~'dist/: No such file'"
        say: { ru: "deploy всё ещё не видит dist/: у build нет artifacts:paths", en: "deploy still cannot see dist/: build has no artifacts:paths" }
        term: C09
  - id: g-artifact
    eval: { yaml_path: "$.build.artifacts.paths", contains: "dist/" }
  - id: g-no-rebuild
    eval: { yaml_path: "$.deploy.script[*]", not_matches: "npm (ci|install|run build)" }
    fail:
      - say: { ru: "Деплой не должен собирать сайт заново: сборка — работа джобы build.", en: "Deploy must not rebuild the site: building is the build job's work." }
        term: C09
hints:
  - { id: a3-h1, kind: question }
  - { id: a3-h2, kind: doc_fragment }   # ступень 2 лестницы документации, см. 0.5
ai_context: [task, pipeline_file, last_run_log, doc_ladder]
```

Подсказка `kind: doc_fragment` показывается только при `doc_ladder.step ≤ 2`; на ступенях 3 и выше её можно открыть явным запросом, и это пишется в журнал попытки как подсказка уровня H3 (01, 14.2).

**Области фактов.** Чтобы одна и та же цель проверялась в симуляторе и на настоящей ВМ, схему `dt.facts/v1` (09, 2.2) нужно дополнить областями этих блоков. Сборщики: в симуляторе — проекция состояния ansim, tfsim, пайплайн-движка и PromQL-стенда; на ВМ — агент `trainer-check`, который читает `terraform show -json`, вывод плейбука с `ANSIBLE_STDOUT_CALLBACK=json`, `/api/v1/targets`, `/api/v1/rules`, `/api/v2/alerts`, `/api/dashboards/uid/<uid>`.

```ts
// дополнение к shared/facts/v1.ts — предложение в 09, 2.2
git?:      { repos: { path: string; head: string; branches: Record<string, string>; status: [string, number, number, number][]; log: { oid: string; parents: string[]; tree: string; message: string }[]; reflog?: string[] }[] };
ci?:       { pipelines: { id: string; ref: string; source: string; status: string; durationS: number;
                          jobs: { name: string; stage: string; status: string; needs: string[]; runner?: string; image?: string;
                                  log: string; startedAt: number; finishedAt: number; artifacts: string[]; cacheHit?: boolean }[] }[];
             registry?: { ref: string; digest: string }[]; environments?: { name: string; deployed: string; by: string }[] };
tf?:       { state?: { serial: number; lineage: string; resources: { addr: string; id: string; attrs: object }[] };
             plan?: { resource_changes: { address: string; actions: string[]; action_reason?: string }[] } };
ansible?:  { runs: { n: number; hosts: { name: string; ok: number; changed: number; failed: number; unreachable: number;
                                          tasks: { name: string; status: 'ok'|'changed'|'failed'|'skipped'; handler?: boolean }[] }[] }[] };
prom?:     { targets: { job: string; instance: string; health: 'up'|'down'|'unknown'; lastError?: string }[];
             rules: { group: string; name: string; kind: 'alert'|'record'; state?: 'inactive'|'pending'|'firing'; health: string }[] };
am?:       { alerts: { labels: Record<string, string>; state: string; receivers: string[] }[]; silences: object[] };
grafana?:  { dashboards: { uid: string; json: object }[] };
```

Типы проверок первой редакции переносятся в эту форму так: `state` — предикат по областям `git`, `tf`, `ansible`, `files`, `units`; `output` — предикат по `history` и `cmd.done`; `run` — `eval: run` с последующим предикатом по `ci`/`ansible`/`tf.plan`; `idempotent` — предикат `ansible.runs[n=2].hosts[*].changed=0`; `forbid` — цель с отрицанием (`not_matches`, `!`), а не отдельный тип.

### 0.5. Лестница документации (R2)

На работе инженер каждый день читает `man git-log`, справочник ключевых слов GitLab CI, `ansible-doc`, страницу ресурса провайдера и справочник функций PromQL. Курс учит этому поэтапно: новичка не отправляют в документацию с нуля, но к концу блока без неё задачу не решить.

| Ступень | Где в блоке | Что видит ученик | Как проверяется | С какой ступени начинает уровень |
|---|---|---|---|---|
| 1. Мерцание | уроки первой трети блока | Под командой, ключом или функцией в тексте строчная метка «→ из документации» со ссылкой на точный якорь (`git-scm.com/docs/git-commit#Documentation/git-commit.txt--mltmsggt`). Можно не открывать | не проверяется; клик пишется в журнал (`doc.open`) | L0 |
| 2. Фрагмент как подсказка | подсказка уровня H2 в тренажёрах | Вместо текста подсказки — вырезка настоящей страницы с подсвеченной нужной строкой и подписанными разделами (анатомия ниже) | задание засчитывается как обычно; открытая подсказка даёт в FSRS «Hard» | L1 |
| 3. «Найди флаг» | микрозадания в каждом модуле второй трети | Только ссылка на страницу или команда справки, без вырезки: «найдите в `git help log` ключ, который…» | по эффекту (`fill`: команда выполняется в копии стенда, проверяется состояние), а не по тексту ключа | L2 |
| 4. Принуждение | тренажёры последней трети блока | Задача требует ключа, параметра или функции, которых нет ни в одном `introduces` маршрута. Подсказок нет. Поле «где нашёл» — ссылка или команда справки | обычная проверка + непустое поле «где нашёл»; наставник в режиме `lab-docs` | все уровни |
| 5. Экзамен с документацией | практический экзамен блока | Открыта только официальная документация из списка; часть заданий построена на том, чего в курсе нет | по состоянию среды | все уровни |

**Анатомия страниц, которой учит ступень 2.** Подписи разделов на вырезке — часть урока; ученик к концу блока знает, где на странице что искать.

| Источник | Разделы, которые подписываются | Команды справки |
|---|---|---|
| `man git-<команда>` | NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES / SEE ALSO; нотация `[<опция>]`, `<commit>...` | `git help <команда>`, `git <команда> -h` (короткая справка), `git help -a` |
| Справочник GitLab CI (`docs.gitlab.com/ci/yaml/`) | у ключевого слова: Keyword type / Supported values / Example / Additional details / Related topics | `glab ci lint`, редактор пайплайнов |
| Документация GitHub Actions | Workflow syntax: `on.<event>`, `jobs.<job_id>.<ключ>`; страница действия на Marketplace: Inputs / Outputs | `actionlint` |
| `ansible-doc ansible.builtin.<модуль>` | OPTIONS (`=` — обязательный, `-` — необязательный, `default:`), ATTRIBUTES (`check_mode`, `diff_mode`), NOTES, EXAMPLES, RETURN VALUES | `ansible-doc -l`, `ansible-doc -s <модуль>` (заготовка задачи), `ansible-doc -t filter -l`, `ansible-config dump` |
| Страница ресурса провайдера (OpenTofu/Terraform Registry) | Example Usage / Argument Reference (Required, Optional; пометка «Changing this forces a new resource») / Attributes Reference / Import | `tofu -help`, `tofu plan -help`, `tofu console` |
| Язык OpenTofu/Terraform | Language → Resources / Meta-Arguments / Functions (у функции — сигнатура и примеры) | — |
| prometheus.io | Querying → Functions: сигнатура `rate(v range-vector)`, описание, оговорки; Configuration: нотация `<duration>`, `[ - <scrape_config> ... ]`, значения по умолчанию в скобках | `promtool --help`, `amtool --help`, `promtool test rules` |
| grafana.com/docs | Panels → Visualizations → `<тип>`: Panel options / Standard options (Unit, Min, Max) / Thresholds | — |

**Задания по ступеням.** На каждый блок — не меньше трёх заданий ступени 4 и двух ступени 5; ниже — готовые формулировки, остальные пишутся по образцу.

| Блок | Ст. 1 | Ст. 2 | Ст. 3 | Ст. 4 (в теории нет) | Ст. 5 (экзамен) |
|---|---|---|---|---|---|
| G | под выводом `git status` метка «это из `man git-status`, раздел SHORT FORMAT»; у `git commit -m` — якорь OPTIONS | G-D1: подсказка — вырезка `git-restore(1)` OPTIONS с подсвеченной `--staged` | «Покажите историю одной строкой на коммит с графом веток» → ссылка на `git-log`; проверка: вывод содержит граф; «Найдите ключ `git log`, который показывает историю одного файла с учётом переименований» → `--follow`, проверка: в выводе есть коммит до переименования | «Найдите коммит, в котором из кода исчезла строка `DEBUG=1`» (`log -S`; проверка — введённый хэш); «Покажите, кто последним менял строку 12 в `about.html`, не учитывая правки пробелов» (`blame -w -L 12,12`); «Работайте одновременно в двух ветках в двух каталогах» (`git worktree add`; проверка — два рабочих дерева) | «Найдите коммит, сломавший `test.sh`, не больше чем за 7 шагов» (`bisect run`, в курсе только назван); «Перенесите один коммит из чужой ветки в свою, не сливая ветку» (`cherry-pick` с `-x`) |
| A | у `artifacts:paths` в A3 метка «Keyword reference → artifacts:paths»; у `rules:` в A-I6 — «→ rules» | A-D4: вырезка `tags` с подсвеченной «use tags to select a specific runner…» | «Ограничьте срок хранения артефакта одной неделей» → `expire_in` (`yaml_path`); «Сделайте, чтобы джоба шла только при изменении файлов в `docs/`» → `rules:changes` (два события симулятора) | «Пусть упавшая `lint` не блокирует пайплайн, но MR показывает предупреждение» (`allow_failure` у lint; цель `keep`: у тестов его нет); «Сравнивайте изменения с `main`, а не с предыдущим push» (`rules:changes:compare_to`); «Перезапускайте джобу при сбое раннера, но не при падении теста» (`retry:when: runner_system_failure`); «Отменяйте устаревший пайплайн ветки при новом push» (`interruptible`) | `workflow:rules` с `auto_cancel`; `rules:exists` |
| B1 | в выводе `ansible-playbook` у задачи метка «модуль `ansible.builtin.apt` — `ansible-doc ansible.builtin.apt`» | B1-D3: вырезка `ansible-doc ansible.builtin.lineinfile` с подсвеченными `regexp` и `line`; B1-D2: OPTIONS модуля `template`, строка `mode` | «Найдите параметр `lineinfile`, который создаёт файл, если его нет» → `create`; проверка `run` на хосте без файла; «Поставьте пакет, только если кэш apt старше часа» → `cache_valid_time` + цель идемпотентности | «Продолжите плейбук с упавшей задачи» (`--start-at-task`); «Выполните задачу один раз на всю группу» (`run_once`); «Выведите хост из балансировщика на lb1 перед обновлением» (`delegate_to`); «Поставьте пакет из .deb по URL» (`apt: deb:`) | модуль, которого в курсе не было: `ansible.builtin.cron` или `ansible.builtin.get_url` с `checksum` |
| B2 | в выводе `plan` у `# forces replacement` метка «Registry → `edu_vm` → Argument Reference» | B2-D1: вырезка страницы `edu_vm` с подсвеченным «Changing this forces a new resource»; B2-D3: вырезка `validation` из Language → Variables | «Найдите функцию, которая делит `10.0.0.0/16` на подсети /24» → `cidrsubnet`, проверка в `tofu console`; «Покажите план без обновления state из облака» → `-refresh=false` по эффекту | «Сгенерируйте код для импортируемого бакета» (`plan -generate-config-out`); «Пометьте VM на пересоздание без правки кода» (`-replace`); «Сделайте так, чтобы удаление DNS-записи из кода не удаляло её в облаке» (`removed` с `lifecycle { destroy = false }`) | блок `check {}` или `precondition`; `terraform_data` с `replace_triggered_by` |
| C | у `rate` в C-I6 метка «prometheus.io → Query functions → rate()» | C-D5: вырезка описания `rate` с подсвеченным «should only be used with counters»; C-D4: вырезка `histogram_quantile` | «Найдите функцию, которая возвращает 1, если ряда нет 10 минут» → `absent_over_time` (`promql_equiv`); «Сколько раз за час перезапускался процесс?» → `changes(process_start_time_seconds[1h])` | «Переименуйте метку `instance` в `host` в результате» (`label_replace`); «Поставьте тишину на 2 часа из терминала» (`amtool silence add`); «Проверьте правило алерта юнит-тестом» (`promtool test rules`, формат файла тестов не показывался) | `promtool test rules` с `time()`-арифметикой; `time() - process_start_time_seconds` как аптайм |

**Наставник на ступени 4.** В контекст наставника (09, 4.5, слой 3) передаётся `doc_ladder.step`. Для ступени 4 добавляется режим `lab-docs` (предложение в таблицу режимов 09, 4.5): «Не называй команду, ключ, параметр или функцию. Спроси, где ученик искал. Назови один официальный источник и раздел страницы (SYNOPSIS, OPTIONS, Argument Reference, Query functions) и команду справки (`man`, `--help`, `ansible-doc`, `tofu <cmd> -help`, `promtool --help`), но не строку. Если ученик процитировал нужную строку, подтверди её смысл и объясни, как она применяется». Движок сверяет ответ со словарём ключей задания и, если ключ встретился в ответе, сворачивает блок, как в режиме `lab`.

**Ступень 5 технически.** Большинство сайтов документации не открываются во фрейме (`X-Frame-Options`), поэтому экзамен показывает встроенный просмотрщик со **снимками** разрешённой документации из пакета `docs-snippets/` (он же работает офлайн через Service Worker). Где лицензия снимка не позволяет, просмотрщик открывает внешнюю вкладку с доменом из списка, и это честная самопроверка (09, 4.7). Разрешённые домены по блокам: G — `git-scm.com/docs`; A — `docs.gitlab.com/ci`, `docs.github.com/actions`; B1 — `docs.ansible.com`, `ansible-doc` в терминале; B2 — `opentofu.org/docs`, `developer.hashicorp.com/terraform`, страница провайдера `edu`; C — `prometheus.io/docs`, `grafana.com/docs`.

**Лицензии фрагментов.** Пакет `docs-snippets/` содержит файл лицензий по источникам, а под каждой вырезкой указаны источник и лицензия.

| Источник | Лицензия | Как используем |
|---|---|---|
| man-страницы Git | GPL-2.0 | вырезки и снимок с указанием источника |
| Документация GitLab | CC BY-SA 4.0 | вырезки и снимок с атрибуцией |
| Документация GitHub Docs | CC BY 4.0 | вырезки с атрибуцией |
| Документация модулей Ansible (`ansible-doc`) | GPL-3.0 (тексты живут в исходниках модулей) | генерируем в CI из `ansible-doc -j`, распространяем как данные GPL-3.0 |
| Документация OpenTofu | MPL-2.0 | вырезки и снимок — основной источник блока B2 |
| developer.hashicorp.com | собственные условия использования | только ссылка во внешней вкладке; анатомию страницы ресурса показываем на документации провайдера `edu`, которую пишем сами |
| Документация Prometheus | Apache-2.0 | вырезки и снимок |
| Документация Grafana | лицензия текстов документации сверяется по репозиторию до публикации (`hold: true`) | пока — ссылка во внешней вкладке и короткие цитаты с атрибуцией |

**Линтер контента.** В блоке не меньше трёх заданий ступени 4 и двух ступени 5; ключ задания ступени 4 отсутствует во всех `introduces` и в словаре `flags.yaml` введённых ключей; задание ступени 5 не появляется раньше экзамена блока; `doc_fragment` в подсказке есть только у заданий ступени 2.

### 0.6. Процессные объяснения (R3, R4)

Каждый блок этого документа получает объяснения процессов, а не только флагманские. Все они — сцены `kind: mechanism` с примитивами 08: `diagram` (схема, привязанная к состоянию), `stepper` (шаги с полосой времени), `breakit` (тумблеры «сломай» с вопросом-предсказанием), `packets` там, где по линии движется сообщение. Правила для всех объяснений документа:

1. **Один экран — одна мысль.** Блоки, стрелки, подписи на самих линиях («`git push` по HTTPS», «`GET /metrics` каждые 15 с»), моноширинные значения. Ни персонажей, ни сюжета, ни декора, ни туши: только почерк «чертёж» из 08, 5.1.
2. **Анимация показывает только процесс:** квадрат коммита ползёт по линии, узел графа загорается при создании, счётчик растёт, слой появляется. В спокойном режиме и при `prefers-reduced-motion` переходы мгновенные.
3. **Всё кликабельно.** Клик по блоку или стрелке открывает карточку «что это, кто это запускает, где увидеть командой» и ссылку на документацию по ступени лестницы.
4. **Параметры меняют процесс сразу.** Ползунок или переключатель пересчитывает весь процесс, а рядом со схемой появляется пояснение изменения одной фразой («`concurrent: 1` — джобы ждут свободный слот: +40 с»).
5. **«Сломай» убирает компонент.** На схеме — красная обводка и ⨯ у сломанного узла, в терминале — настоящее сообщение инструмента, под схемой — блок «Почему». Перед включением тумблера ученик предсказывает последствие (08, 3.5).
6. **Шаги перематываются вперёд и назад, ставятся на паузу.** Состояние в момент `t` — свёртка событий шины до `t` (08, 3.1), поэтому перемотка ничего не откатывает вручную. Это не видео.
7. **Живое и записанное совпадают.** Объяснение работает над теми же событиями шины, что живой симулятор; любой прогон ученика в терминале можно открыть в степпере как разбор.

Список объяснений документа:

| ID | Процесс | Блок | Раздел |
|---|---|---|---|
| E-GIT | Что делает `git commit` и `git push`: файл → blob → tree → commit → ссылка → forge | G | 2.3 |
| E-CI | От `git push` до работающей версии | A (после A2, повтор в A7) | 3.4 |
| E-DEPLOY | Как выкладывают: recreate, rolling, blue-green, canary | A5b | 3.4 |
| E-ANS | Идемпотентный прогон Ansible | B1 | 4.4 |
| E-TF | `terraform plan` и `apply`: код, state, облако | B2 | 5.4 |
| E-REC | Четыре исполнителя сверки: Ansible, Terraform, контроллер, Argo CD | мост B2 → Kubernetes | 5.5 |
| E-K8S-CODE | Кластер из кода: от `tofu apply` до трёх узлов Ready | B3 | 6.3 |
| E-MON | От счётчика в коде до сообщения дежурному: scrape → store → PromQL → alert → notify | C | 7.4 |
| E-OTEL | Путь трейса: SDK → OTLP → Collector → хранилища | C14b | 7.4 |
| E-CG | Откуда берутся метрики контейнера: cgroup → cAdvisor → PromQL | C16 | 7.10 |

**События шины.** Для этих объяснений шину 08, 3.0 нужно дополнить типами (предложение в 08):

```ts
| { t: 'git.object'; kind: 'blob'|'tree'|'commit'|'tag'; oid: string; repo: string }
| { t: 'git.ref'; repo: string; ref: string; from: string; to: string; reason: string }       // пишет и наш reflog
| { t: 'ci.pipeline'; id: string; ref: string; source: string; status: string }
| { t: 'ci.job'; pipeline: string; job: string; status: 'created'|'pending'|'running'|'success'|'failed'|'canceled'|'skipped'|'manual'; runner?: string }
| { t: 'ci.cache'; key: string; hit: boolean; bytes: number }
| { t: 'ci.artifact'; job: string; paths: string[]; bytes: number; dir: 'up'|'down' }
| { t: 'deploy.shift'; env: string; from: string; to: string; share: number }               // доля трафика на новую версию
| { t: 'ans.ssh'; host: string; module: string; phase: 'connect'|'transfer'|'exec'|'result' }
| { t: 'ans.task'; host: string; task: string; status: 'ok'|'changed'|'failed'|'skipped'|'unreachable'; diff?: string }
| { t: 'tf.step'; phase: 'parse'|'graph'|'refresh'|'diff'|'plan'|'confirm'|'apply'|'state.write'; addr?: string; action?: string }
| { t: 'tf.api'; method: string; path: string; status: number; addr?: string }
| { t: 'prom.scrape'; target: string; ok: boolean; samples: number; ms: number; error?: string }
| { t: 'prom.rule'; name: string; state: 'inactive'|'pending'|'firing'; value: number }
| { t: 'am.notify'; group: string; receiver: string; alerts: number; reason: 'group_wait'|'group_interval'|'repeat_interval'|'resolved' }
```

### 0.7. Визуальный язык и что берём из Sankofa (R5)

Схемы этих блоков используют токены цвета 08, 5.2 и добавляют свои там, где у сущности нет цвета. Цвет всегда несёт смысл и дублируется формой или подписью.

| Сущность | Токен | Форма-дубль |
|---|---|---|
| Джоба success / failed / running / pending / manual / skipped | `--c-ok` / `--c-err` / `--c-flow` / серый / `--c-warn` / серый пунктир | ✓ / ⨯ / вращающаяся дуга (в спокойном режиме ◐) / ◯ / ▶ / ⤼ |
| План Terraform `+` / `~` / `-` / `-/+` / `<=` | `--c-ok` / `--c-warn` / `--c-err` / `--c-err` с обводкой `--c-ok` / серый | сам символ плана моноширинным шрифтом перед адресом |
| Ansible ok / changed / failed / skipped | `--c-ok` / `--c-warn` / `--c-err` / серый (как в выводе Ansible) | буквы `ok`, `ch`, `F`, `s` в ячейке сетки |
| Алерт inactive / pending / firing / resolved | серый / `--c-warn` / `--c-err` / `--c-ok` | полоса шкалы с подписью состояния |
| Код и Git (новый `--c-code`) | приглушённый сине-серый | лист с загнутым углом и моноширинной строкой |
| State Terraform (новый `--c-state`) | приглушённый фиолетовый | карточка-«память» с номером `serial` |
| Реальность облака (новый `--c-cloud`) | приглушённый бирюзовый | карточка ресурса с ID облака |
| Хранилище: TSDB, кэш, реестр (новый `--c-store`) | тёмно-охристый | форма «бочка» |
| Три сигнала: метрика / лог / трейс (новые `--c-metric`, `--c-log`, `--c-trace`) | три приглушённых оттенка | линия графика / строка текста / горизонтальная полоса спана |
| Процесс приложения | `--c-user` | прямоугольник со скруглением |
| Компоненты Kubernetes | `--c-cp`, `--c-node`, `--c-obj` из 08 | шестиугольник, «стойка», документ |

Значения новых токенов (светлая и тёмная темы, контраст ≥ 4,5:1 для текста и ≥ 3:1 для линий) подбирает роль движка в 08, 5.2. Терминал — общий виджет `terminal` 08, 3.4; вывод `terraform plan`, `ansible-playbook`, лог раннера раскрашиваются так же, как в настоящих инструментах, чтобы ученик узнал эти цвета на работе.

| Механизм Sankofa | Как используется в этих блоках |
|---|---|
| `engine/scroll.ts` — сцены, привязанные к прокрутке | журнальная подача текста учебника; в сценах `mechanism` прокрутка ведёт шаги степпера, пока ученик не взялся за ползунок (08, 3.1) |
| Журнальная типографика, слои, раскрытие сносок | тексты глав (раздел «План учебника» в каждом блоке), карточки терминов, блок «Источники и проверка» |
| `engine/ink.ts` | только `data-ink`-прорисовка линии чертежа и `data-fade` появления узлов; кипящая линия и `sketch` в этих блоках не используются |
| `engine/calm.ts` — спокойный режим | у всех анимаций пайплайнов, планов и графиков статичный вариант: готовая схема и кнопка «дальше» |
| `engine/qr.ts` | квизы и карточки повторения (термины, ключи команд, символы плана) продолжаются на телефоне; «схема на втором экране» для объяснений E-CI, E-TF, E-MON |
| Линзы (`Lens`) | только в постмортеме C13: одна хронология с точки зрения ролей «дежурный SRE», «автор релиза», «руководитель продукта». Это роли без имён и лиц, а не персонажи |
| Двуязычный YAML, `draft`/`hold`, правило двух источников, экран «Как мы проверяли» | каждое фактическое утверждение теории привязано к двум источникам; утверждение с одним источником — `hold: true` и в сборку не попадает. Для поведения инструментов второй источник — воспроизводимый прогон на настоящем инструменте (раздел 9.2) |
| `mechanics/objects` (секвенсор) | модель «дорожки × такты» для визуализатора идемпотентности (задачи × прогоны) и шкалы состояний алерта |
| `engine/clap.ts` (WebAudio) | один тональный сигнал пейджера в инциденте C13; **выключен по умолчанию**, как весь звук курса (08, 4) |

Источник событий в сценариях с «чужими» действиями (ручная правка в консоли облака, коммит в forge, пока ученик работал) — нейтральная строка журнала, без имени и мотива: «14:02 через консоль изменён `size_gb` диска `disk-db` (источник: console, пользователь `ops-2`)», «коммит `4e1f0c2` от `bot@forge`».

### 0.8. Своя нейросеть

Общую интеграцию проектирует 09, педагогическое поведение — 01, 14. Эти блоки определяют, **что** отправляется в контексте: у упражнения есть поле `ai_context` — текст задачи, текущий файл, последний лог джобы, вывод `plan`, дерево разбора PromQL с промежуточными результатами, ступень лестницы документации. Эталонное решение в контекст не передаётся (01, 14.4). Режимы: `learn` в теории и объяснениях, `lab` в тренажёрах, `lab-docs` на ступени 4 лестницы (0.5), `exam` — нейросеть выключена в экзаменах и проверках уровня. Типовые кнопки: «Объясни этот лог», «Почему план хочет пересоздать ресурс», «Что считает этот запрос», «Почему задача каждый раз changed».

### 0.9. Уровни, проверки уровня, экзамены

Уровни называются L0, L1, L2 и определены в 01, 3 и 4.3. Единственный источник ключевых заданий проверок уровня — 01, 4.3 (блоки «CI/CD (с Git)», «IaC», «Мониторинг»); критерий — ≥ 80% и все ключевые, уверенность «наугад» не засчитывается, пересдача через 72 часа другим вариантом. Этот документ даёт **дополнительный пул** заданий в формате банка 10, 3.1 (`key: false`, `concepts` — ID графа, `misconception` у неверных вариантов, 3–5 вариантов параметризации). Пул защищает проверку от заучивания и расширяет варианты; ключевые задания пула не появляются в квизах того же уровня (10, 3.5). Предложение в 01, 4.3: в каждой проверке L1 и L2 этих блоков пометить ключевыми не меньше двух практических заданий, как требует 10, 3.5 (сейчас ключевое по одному).

Профиль «программист без опыта эксплуатации» в этом документе — типичный L1 по IaC и мониторингу и L2 по Git: определения уровней 01 не меняются. Опытный (L2) начинает лестницу документации со ступени 3, средний (L1) — со ступени 2.

Практические экзамены блоков — в формате 10, раздел 6: сценарий «смена на работе», 60–120 минут, 3–5 практических задач (70%) и 2 вопроса `explain` (30%), вариант из сида (имена, порты, *какая из 3–5 поломок*), `critical: true` у проверок, без которых экзамен не сдан, порог — все критические и ≥ 70%, пересдача через 24 часа новым вариантом, режим «с помощником / без» пишется в протокол. Дополнительно у каждого экзамена: `envs: [sim]` для экзаменов в симуляторе, `envs: [vm]` + `attest` для предъявляемых треков (B3, пет-проекты); `doc_ladder: { step: 5, allowed: [...] }`; `ai: off` для встроенного наставника.

### 0.10. Учебник (R1)

Каждый модуль в программе блока имеет **тезис главы** (одно предложение — что ученик должен вынести) и **план текста** (5–8 утверждений в порядке введения понятий). Объяснения, интерактивы и тренажёры привязаны к утверждениям плана: тренажёр не может проверять то, чего нет в плане. Тексты глав пишет роль контента, но тезис и план — обязанность автора блока; в этом документе они даны для модулей-ядер (G2, G4–G5, A1, A3, A5b, B1-5, B2-4, C2, C6, C11), для остальных — тезисом в таблице программы.

---

## 1. Методология: что этот документ берёт из блока 07

Блок методологии (07) вводит M13–M17: непрерывную интеграцию как договорённость команды, Continuous Delivery как «каждое изменение готово к выпуску, выпуск — решение человека», Continuous Deployment как «выпуск без ручного шага», пайплайн как понятие и пять метрик DORA по dora.dev (время внесения изменения, частота развёртываний, время восстановления после неудачного развёртывания, доля неудачных изменений, доля внеплановых развёртываний). Этот документ ничего из этого не переопределяет и использует так:

- **A-I6 «Одна строка»** (раздел 3) — мост «понятие → код»: строка `when: manual` у джобы production отличает Delivery от Deployment. Здесь же вопросы квиза, которые в 07 невозможны, потому что Git ещё не введён: «Каждый merge в main через 20 минут оказывается в продакшене — какая это практика?», «Разработчик держит ветку три недели, но на каждый push запускаются тесты — это CI?».
- **E-CI** (раздел 3.4) в последнем экране подписывает переключатель ручного шага теми же словами, что 07 (M15, M16).
- **C13, постмортем** опирается на M12 (инцидент без поиска виноватых) и считает «время восстановления после неудачного развёртывания» на настоящих данных инцидента.
- **A5b, стратегии выкладки** показывает, почему маленькие партии и откат снижают долю неудачных изменений, со ссылкой на E10 «Пять приборов».

Экран «Конвейер» с тремя «воротами» (CI, Delivery, Deployment на отрезках конвейера) передаётся в 07 как раскадровка в стиле R4, без фигуры человека у кнопки.

---

## 2. Блок G. Git

Git разрезан на две части по графу: **G-local** — последний модуль блока Linux, **G-remote** — первый модуль блока CI/CD (0.1). Отдельной проверки уровня у Git нет: G-local закрывается проверкой уровня Linux (задания пула ниже добавляются в неё с `block: linux`), G-remote — проверкой «CI/CD (с Git)» из 01, 4.3.

### 2.1. Уровни и дополнительный пул проверки

| Уровень | Что это значит для Git |
|---|---|
| L0 | Не пользовался системой контроля версий; знает файлы и каталоги из блока Linux |
| L1 | Коммитил и пушил через IDE или по инструкции; не уверен в ветках, слияниях и конфликтах |
| L2 | Работает с ветками и merge request каждый день; не обязательно знает объекты, ссылки, reflog и разницу merge, rebase и squash для истории |

Пул (`key: false`, у каждого 3–5 вариантов имён файлов и веток):

1. *(L1, П)* «В `~/site` изменён `index.html` и есть новый `notes.txt`. Закоммитьте только `index.html` с сообщением `Fix title`.» Цель: `git.repos[path=~/site].log[0]` меняет ровно `index.html`; статус `notes.txt` — `[notes.txt, 0, 2, 0]` (неотслеживаемый). Понятия C16, C02.
2. *(L1, П)* «Создайте ветку `feature/contacts`, добавьте в ней `contacts.html`, вернитесь в `main` и влейте ветку.» Цель: в `main` есть файл, ветка существует, коммит ветки — предок `main`. Понятия C17, C03.
3. *(L1, П)* «`git pull` сообщил о конфликте в `about.html`. Оставьте обе строки и завершите слияние.» Цель: нет маркеров `<<<<<<<`, `=======`, `>>>>>>>`, обе строки есть, у последнего коммита два родителя. Понятия C03, C04.
4. *(L2, П)* «В ветке `feature/x` пять коммитов, три из них — `wip`. Перед merge request оставьте в ветке один коммит с осмысленным сообщением, не меняя итоговое содержимое.» Цель: у вершины ветки один родитель, и это текущий `main` (если ученик сначала сделал `rebase main`, тоже верно); дерево вершины равно дереву исходной вершины, перенесённому на текущий `main`. Принимаются `rebase -i`, `reset --soft main && git commit`, `merge --squash`. Понятие C18.
5. *(L2, П)* «Вы сделали `git reset --hard HEAD~2` и потеряли два коммита. Верните их.» Цель: ветка указывает на исходный коммит; подсказок нет. Работает благодаря собственному слою reflog (0.3). Понятие C20.
6. *(L2, О)* «Чем `revert` отличается от `reset`, и почему в общей ветке используют первый?» Рубрика: revert добавляет новый коммит; reset двигает ссылку и переписывает историю; переписанная история расходится с копиями коллег; на сервере нужен force-push. Зачёт — 3 из 4.

### 2.2. Программа

| Модуль | Тезис главы | L0 | L1 | L2 |
|---|---|---|---|---|
| G1. Зачем версии | Репозиторий помнит каждое сохранённое состояние проекта и позволяет к нему вернуться | полностью | пропуск по проверке | пропуск |
| G2. Три места файла | Файл живёт в рабочем каталоге, попадает в индекс командой `add` и становится частью истории командой `commit` | полностью | повтор с интерактивом | обзорно |
| G3. История | Коммит называется своим хэшем, а история — это цепочка родителей | `log`, `show`, `diff` между коммитами | `log --oneline --graph`, `blame` | — |
| G4. Ветки | Ветка — подвижная бумажка с именем на одном коммите, HEAD — бумажка «я здесь» | полностью | полностью | обзорно |
| G5. Слияние и конфликт | Слияние объединяет две линии истории; конфликт — место, где Git не может решить за человека | fast-forward, merge-коммит, конфликт | то же | merge, rebase, squash: что остаётся в истории |
| G8a. Гигиена локально | Что не попало в репозиторий, не утечёт; что попало, остаётся в истории навсегда | `.gitignore`, секреты не коммитим, сообщения коммитов | Conventional Commits | — |
| G9. Внутри Git | Всё в Git — объекты, названные хэшем содержимого; ветка — файл с одним хэшем | — | обзорно (E-GIT) | полностью (E-GIT + `cat-file`) |
| G6. Удалённый репозиторий | Удалённый репозиторий — ещё одна копия истории; push принимается, только если продолжает её | remote, `clone`, `push`, `fetch`, `pull`, origin/main | upstream, `pull --rebase` | форки |
| G7. Совместная работа | Merge request — предложение влить ветку, которое видят, обсуждают и проверяют | merge request в учебном forge, ревью, защищённая ветка | trunk-based и GitHub flow | GitFlow и почему он плохо сочетается с CI (M14) |
| G8b. Отмена и восстановление | Отменить можно двумя способами: добавить обратный коммит или передвинуть ссылку | теги и semver | `revert` против `reset`, `cherry-pick` | `reflog`, `bisect` |

### 2.3. План учебника и объяснение E-GIT

**G2. Три места файла.** Тезис: файл проходит три места, и `git status` всегда говорит, где он сейчас.
1. Рабочий каталог — обычные файлы, которые вы правите редактором (опирается на L04).
2. Репозиторий помнит снимки, которые вы сохранили явно, а не каждое нажатие клавиши.
3. Между ними стоит индекс: сюда вы складываете то, что войдёт в следующий снимок.
4. `git add` кладёт текущее содержимое файла в индекс; если правите файл после `add`, в индексе остаётся старое.
5. `git commit` превращает индекс в снимок с автором, временем и сообщением.
6. `git status` и `git diff` / `git diff --staged` отвечают на вопрос «где что отличается».
7. `git restore` и `git restore --staged` возвращают файл на шаг назад.
Проверка понимания: `predict` — «что покажет `git status` после правки файла, уже добавленного в индекс?».

**G4–G5. Ветки и слияние.** Тезис: ветка ничего не копирует, она только указывает на коммит, поэтому её создание стоит ноль.
1. Коммит знает своего родителя, поэтому история — цепочка, которую можно пройти назад (опирается на G3).
2. Ветка — имя, приклеенное к одному коммиту; при новом коммите имя переезжает на него.
3. HEAD — указатель на текущую ветку; `git switch` переклеивает HEAD.
4. Если одна ветка — прямое продолжение другой, слияние просто передвигает имя (fast-forward).
5. Если ветки разошлись, Git создаёт коммит с двумя родителями.
6. Конфликт возникает, когда обе ветки меняли одни и те же строки; Git помечает их маркерами и ждёт решения человека.
7. После разрешения конфликта файл добавляется в индекс и слияние завершается коммитом.
Проверка понимания: режим «предсказание» в G-I2 на пяти последовательностях команд.

**E-GIT «Что делает `git commit` и `git push`».** Сцена `mechanism`, степпер над живым репозиторием ученика.

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. Файл → blob | Слева файл `index.html` (`--c-code`), справа пустое хранилище объектов. Стрелка «`git add`: сжать и назвать хэшем содержимого» рисуется, появляется карточка blob `a1b2c3…` | Поле «изменить одну строку» | — | При правке строки появляется новый blob с другим хэшем, старый остаётся: «Git не меняет объекты, он создаёт новые» |
| 2. Индекс | Таблица индекса: путь → хэш blob. Строка `index.html` переключается на новый хэш | Переключатель «правка после `add`» | — | Пометка «в индексе старая версия, `git status` покажет файл дважды» |
| 3. Tree | Из индекса собирается tree: список имён и хэшей. Неизменённые файлы ссылаются на те же blob | Число файлов в проекте 1–20 | — | Счётчик «новых объектов при коммите»: меняется только то, что изменилось, плюс tree |
| 4. Commit | Карточка commit: tree, parent, author, время, сообщение. Стрелка к родителю | — | «Пустое сообщение» → отказ `Aborting commit due to empty commit message` | — |
| 5. Ссылка | Файл `refs/heads/main` с хэшем переписывается; строка добавляется в журнал reflog | — | — | «Ветка — 41 байт: хэш и перевод строки» |
| 6. Push | Справа появляется forge. По линии `git push (HTTPS)` уезжают только объекты, которых там нет; на линии счётчик объектов | Переключатель «на forge уже есть чужой коммит» | Включённый переключатель → `! [rejected] main -> main (fetch first)`, стрелка красная | «Forge принимает push, только если ваш коммит продолжает его историю» |

Клик по любой карточке выполняет `git cat-file -p <oid>` в терминале ученика и показывает настоящий вывод. Источник шагов — события `git.object` и `git.ref`.

### 2.4. Интерактивы

**G-I1. «Три места файла».** Три колонки: «Рабочий каталог», «Индекс», «Репозиторий», внизу терминал. Файл — карточка; `add`, `restore --staged`, `commit`, `restore` двигают карточки между колонками, и наоборот, перетаскивание карточки печатает соответствующую команду в терминал, Enter нажимает ученик. Изменённые строки на карточке подсвечены; в колонке «Репозиторий» растёт цепочка коммитов.

**G-I2. «Граф коммитов».** Живой граф по данным репозитория: кружки коммитов, ярлыки веток, отдельный ярлык HEAD; обновляется после каждой команды. При fast-forward ярлык ползёт без нового кружка. Режим «предсказание»: перед командой ученик перетаскивает ярлыки туда, где они окажутся; затем команда выполняется и показывает расхождение. Главный тренажёр понимания веток.

**G-I3. «Конфликт».** Редактор с тремя панелями (наша версия, их версия, результат) и кнопками «взять нашу / их / обе», параллельно сырой файл с маркерами. Разрешать можно в панели или правкой в терминале (`nano`/`vi` Стенда).

**G-I4. «Учебный forge».** Страница проекта, ветки, merge requests с diff, кнопкой Merge, обсуждением и статусом пайплайна (используется в блоке A). Удалённый репозиторий — второй gitdir в памяти; push и fetch идут через обёртку из 0.3, отказ non-fast-forward даёт текст настоящего Git. Чтобы ученик столкнулся с отставанием и конфликтом, forge сам добавляет коммит от `bot@forge`, и в ленте MR появляется нейтральная строка «`4e1f0c2` добавлен в main».

### 2.5. Тренажёры

| ID | Задание | Цели |
|---|---|---|
| G-D1 | 10 микрозадач «переведите карточку»: в индекс, из индекса, отменить правку | `git.repos[].status` после каждой; подсказка ступени 2 — вырезка `git-restore(1)` |
| G-D2 | «Предскажи граф»: 15 последовательностей команд | совпадение позиций веток и HEAD |
| G-D3 | Три конфликта возрастающей сложности: одна строка; пересекающиеся блоки; изменение против удаления (modify/delete) | нет маркеров, содержимое равно эталону, у коммита два родителя; для modify/delete — файл сохранён или удалён по условию задачи |
| G-D4 | «Push отклонён»: в forge появился чужой коммит; `pull --rebase` или `pull` + merge, снова push | ветка в forge содержит оба коммита; для варианта rebase история линейна |
| G-D5 | «Секрет в истории»: в коммите `config.env` с паролем, коммит уже в forge | `git rm --cached`, `.gitignore`; квиз: пароль нужно сменить, потому что история уже на сервере (`misconception: git.rm-erases-history`) |
| G-D6 | «Отменить чужой коммит в общей ветке» | новый коммит `revert`, история `main` в forge не переписана (`keep`: старые хэши на месте) |
| G-D7 *(L2)* | «Найдите коммит, после которого перестал проходить `./test.sh`» | введённый хэш; ступень 3 — ссылка на `git-bisect` |
| G-D8 | Задачи ступени 4 из таблицы 0.5 (`log -S`, `blame -w -L`, `worktree`) | по эффекту + поле «где нашёл» |

### 2.6. Практический экзамен G-remote (самопроверка, `envs: [sim]`)

Сценарий «Первый день в команде», 60 минут, `doc_ladder: { step: 5, allowed: [git-scm.com/docs] }`.

| Задача | Вес | Что сделать | Проверки |
|---|---|---|---|
| t1 | 25 | Склонировать проект из forge, создать ветку под задачу, исправить два файла, сделать два осмысленных коммита | `critical`: ветка в forge с двумя коммитами; 5 баллов: сообщения не пустые и не «fix»; `.gitignore` не пропустил `node_modules/` |
| t2 | 25 | `main` ушёл вперёд: обновить ветку, разрешить конфликт, открыть merge request | `critical`: в MR нет маркеров конфликта; ветка содержит текущий `main` |
| t3 | 20 | Ревью от `bot@forge`: «убери отладочный print» — исправить отдельным коммитом, влить | MR влит, в `main` нет отладочной строки |
| t4 | — (вариант из сида) | Одна из четырёх поломок: потерянный коммит после `reset --hard` (reflog); секрет в последнем коммите; сломанный тест после чужого коммита (`bisect`); ветка случайно влита в `main` (revert) | цели поломки; `keep`: история `main` в forge не переписана |
| explain | 30 | «Тимлид: почему ты обновил ветку rebase, а не merge, или наоборот?»; «Что будет, если сделать force-push в `main`?» | рубрика: история и её читаемость; копии коллег расходятся; защищённая ветка |

`pass: { critical: all, total_min: 70 }`.

### 2.7. Y1 для блока Linux (L31) и урок Y-traps

**Y1. YAML и JSON** передаётся в блок Linux (02) как урок L31 после скриптов. Экраны по одному facet: документ и ключ-значение → словарь → список → вложенность отступами (только пробелы) → строки и многострочные блоки `|` и `>` → тот же документ в JSON. Интерактив **Y-I1 «YAML глазами парсера»**: слева YAML, справа дерево данных и JSON; ошибка отступа подсвечивает строку и показывает, как изменилось дерево. Тренажёр **Y-D1**: 20 сломанных фрагментов (табуляция, лишний отступ, двоеточие без пробела, незакрытая кавычка) — парсер без ошибок, дерево равно эталону. Парсер — `yaml` (eemeli) v2.

**Y-traps. Ловушки типов** (C30) — первый урок блока CI/CD, перед A1. Тот же интерактив с переключателем режимов парсера YAML 1.1 и 1.2: `version: 1.10` становится числом 1.1; `mode: 0755` в YAML 1.1 — восьмеричное число 493; `country: NO` в YAML 1.1 — `false`; ключ `on:` в GitHub Actions разбирается YAML 1.1-парсером как `true`, но сам GitHub читает его как ключ. Объяснение: разные инструменты понимают один и тот же текст по-разному, поэтому строковые значения берут в кавычки. Тренажёр **Y-D2**: 8 фрагментов из реальных файлов CI и compose, где ученик ставит кавычки так, чтобы дерево совпало в обоих режимах.

### 2.8. Источники G и YAML

- EN: Pro Git — https://git-scm.com/book/en/v2 ; Git reference — https://git-scm.com/docs ; Learn Git Branching — https://learngitbranching.js.org/ ; isomorphic-git, alphabetic API list — https://isomorphic-git.org/docs/en/alphabetic ; isomorphic-git fs — https://isomorphic-git.org/docs/en/fs ; git reflog format — https://git-scm.com/docs/git-reflog ; YAML 1.2.2 spec — https://yaml.org/spec/1.2.2/
- RU: Pro Git на русском — https://git-scm.com/book/ru/v2 ; Learn Git Branching (русская локаль) — https://learngitbranching.js.org/?locale=ru_RU ; GitHub Docs на русском — https://docs.github.com/ru/get-started/using-git

---

## 3. Блок A. CI/CD на практике

### 3.1. Главные решения

**Первичная платформа — GitLab CI, вторичная — GitHub Actions.** Чек-лист и его пет-проекты построены на GitLab CI, на российском рынке он преобладает; на международном и в open source преобладает GitHub Actions. Ученик проходит модули на GitLab CI, а в A6g переносит тот же пайплайн на GitHub Actions и видит, что понятия те же, а синтаксис другой. EN-версия продукта ставит обе платформы равноправно с выбором при старте блока; RU-версия — GitLab по умолчанию.

**Один симулятор, два входных синтаксиса.** И `.gitlab-ci.yml`, и `.github/workflows/*.yml` переводятся в общее промежуточное представление, которое исполняет один движок; поведение раннера, кэша, артефактов и логов реализовано и показано одинаково.

```ts
// pipeline IR — общее для GitLab CI и GitHub Actions
interface PipelineIR {
  source: 'gitlab' | 'github';
  trigger: { event: 'push' | 'merge_request' | 'tag' | 'schedule' | 'manual'; ref: string; changedFiles: string[] };
  stages: string[];                    // в GitHub Actions вычисляются из needs
  jobs: JobIR[];
}
interface JobIR {
  id: string;
  stage?: string;
  needs: { job: string; optional: boolean; artifacts: boolean }[];   // явные needs или «все джобы предыдущих стадий»
  image?: string;                      // GitLab image / GitHub container
  runsOn?: string[];                   // GitLab tags / GitHub runs-on
  services: string[];
  steps: StepIR[];                     // before_script + script + after_script или steps[]
  variables: Record<string, string>;
  rules: RuleIR[];                     // rules / if / on.paths / when
  when: 'on_success' | 'manual' | 'always' | 'on_failure' | 'never';
  allowFailure: boolean;
  artifacts?: { paths: string[]; expireIn?: string; reports?: { junit?: string } };
  cache?: { key: string; paths: string[]; policy: 'pull-push' | 'pull' | 'push' }[];
  environment?: { name: string; url?: string; action?: 'start' | 'stop' };
  resourceGroup?: string;              // GitLab resource_group / GitHub concurrency
  retry?: { max: number; when: string[] };
  interruptible?: boolean;
  timeoutSec?: number;
  matrix?: Record<string, string[]>;
  srcRange: { file: string; line: number };
}
type StepIR = { kind: 'run'; script: string } | { kind: 'uses'; action: string; with: Record<string, string> };
```

**Скрипты джоб выполняются по-настоящему, тяжёлые инструменты — моделями с закрытым списком поведения.** Каждая джоба получает чистую машину Стенда из профиля образа (`alpine`, `node`, `python`, `docker` — профили поставляет роль Docker; версии берутся из `content/versions.yaml`), клонированный репозиторий и переменные. Строки скрипта исполняет оболочка Стенда; тесты учебных проектов — настоящие скрипты. `docker build/push` исполняет dsim (04), `kubectl` и `helm` — kube-lite (05), `npm ci`, `pip`, `go build` — модели из 0.3.

**Формат лога копирует настоящий GitLab Runner**, потому что читать лог джобы — переносимый навык. Версия раннера подставляется из `versions.yaml`, текст сверяется с настоящим раннером той же версии (9.2):

```
Running with gitlab-runner {{versions.gitlab_runner}} (edu)
  on edu-docker-runner-1 t3_xY9k, system ID: s_4f1e
Preparing the "docker" executor
Using Docker executor with image node:{{versions.node_lts}}-alpine ...
Pulling docker image node:{{versions.node_lts}}-alpine ...
Preparing environment
Getting source from Git repository
Fetching changes with git depth set to 20...
Checking out 1a2b3c4d as detached HEAD (ref is main)...
Restoring cache
Checking cache for npm-main-protected...
No URL provided, cache will not be downloaded from shared cache server. Instead a local version of cache will be extracted.
Successfully extracted cache
Downloading artifacts
Executing "step_script" stage of the job script
$ npm ci
added 214 packages in 9s
$ npm run build
Saving cache for successful job
Creating cache npm-main-protected...
node_modules/: found 4120 matching artifact files and directories
No URL provided, cache will not be uploaded to shared cache server. Cache will be stored only locally.
Created cache
Uploading artifacts for successful job
Uploading artifacts...
dist/: found 12 matching artifact files and directories
Cleaning up project directory and file based variables
Job succeeded
```

**Линтинг — настоящими схемами.** GitLab — официальная JSON Schema `ci.json` (draft-07, из репозитория GitLab, `app/assets/javascripts/editor/schema/ci.json`) через ajv плюс семантические проверки, которых схема не делает: `needs` на несуществующую джобу; `needs` на джобу более поздней стадии; `needs` на джобу, которую `rules` могут исключить, без `optional: true`; стадия, не объявленная в `stages`; цикл в `needs`; джоба без `script`. GitHub Actions — **actionlint** в wasm (так работает его официальный playground) плюс схема `github-workflow.json` из SchemaStore. Ошибки показываются в редакторе (CodeMirror 6 + `@codemirror/lang-yaml`) на нужной строке.

### 3.2. Уровни и дополнительный пул проверки

| Уровень | Что это значит для CI/CD (01, 4.3) |
|---|---|
| L0 | Не видел пайплайнов; прошёл Linux, сети, Docker и G-local |
| L1 | Коммитил и пушил, видел зелёные галочки CI, сам пайплайн не правил; путает кэш и артефакты |
| L2 | Работает с ветками и merge request, правил CI-файл, но не строил пайплайн от коммита до выкладки: DAG, правила для MR и тегов, защищённые переменные, окружения, переиспользование |

Пул (`key: false`; цели — по фактам `ci`):

1. *(L1, П)* «Три джобы в одной стадии `test`. Сделайте так, чтобы `build` выполнялась раньше `test`, а `deploy` — последней.» Цель: `finishedAt(build) < startedAt(test) < startedAt(deploy)`, `stages` объявлены. Понятие facet «стадия» C08.
2. *(L1, Т, match)* «`node_modules` между пайплайнами; `dist/` от сборки к деплою; отчёт JUnit для MR» — с `cache`, `artifacts`, `artifacts:reports:junit`. Неверные пары — `misconception: ci.cache-passes-results`. Понятия C09, C23.
3. *(L1, Т)* «В ветке `feature/x` `$DEPLOY_TOKEN` пустая, в `main` есть. Почему?» Верно: переменная Protected. Понятие C12.
4. *(L1, П)* «Почини YAML»: стадия не объявлена, `script` строкой вне списка, `needs` с опечаткой. Цели: `lint` = 0, прогон success.
5. *(L2, П)* «Тесты бэкенда и фронтенда независимы, деплой ждёт оба, линтер фронтенда не задерживает тесты бэкенда — перестройте на `needs`.» Цель: модельное время ≤ эталон + 5%, в графе `needs` нет лишних рёбер. Понятие C26.
6. *(L2, П)* «Production — только из тегов `vX.Y.Z` и только вручную; в MR — только тесты.» Цель: прогоны на `push main`, `merge_request`, `tag v1.4.0`, `tag test-1` дают ожидаемые наборы джоб. Понятие C24.
7. *(L2, Т)* «Секрет утёк в лог, хотя переменная Masked.» В скрипте `echo $TOKEN | base64`. Верно: маскирование ищет точное значение, преобразованное не маскируется. `misconception: ci.masked-is-encryption`.

### 3.3. Программа

| Модуль | Тезис главы | Содержание | L0 | L1 | L2 |
|---|---|---|---|---|---|
| A1. Первый пайплайн | Пайплайн — файл в репозитории, который forge читает при каждом push и превращает в джобы | раннер (C07), файл пайплайна, джоба, скрипт, лог, статус (C08), код возврата (C10) | полностью | кратко | пропуск |
| A2. Стадии и раннеры | Джоба выполняется не на forge, а на раннере, который сам забирает работу | стадия, раннер, исполнитель shell/docker, образ джобы (C22), теги раннера, «зависшая» джоба; исполнитель kubernetes — `forward: [K01]` с карточкой «раннер умеет запускать джобы в кластере, вернёмся в A7» | полностью | полностью | раннеры и исполнители |
| A3. Артефакты и кэш | Артефакт передаёт результат дальше и должен дойти; кэш только ускоряет и может пропасть | артефакт (C09), кэш (C23), ключи кэша, `policy: pull`, распределённый кэш на общем хранилище | полностью | полностью | ключи по lock-файлу |
| A4. Переменные и секреты | Секрет живёт в настройках forge, а не в репозитории, и выдаётся только тем джобам, которым положен | предопределённые переменные (`CI_COMMIT_SHA`, `CI_COMMIT_REF_NAME`, `CI_PIPELINE_SOURCE`), свои, Masked, Masked and hidden, Protected, область окружения, File-переменные (C12); OIDC-токены — `forward` с карточкой для L2 | полностью | полностью | + OIDC обзор |
| A4b. Образ в CI | Пайплайн собирает образ один раз и публикует его с тегом коммита | `docker build` в джобе через сервис `docker:dind`, тег `$CI_COMMIT_SHORT_SHA`, реестр forge (C11) | полностью | полностью | кратко |
| A5. Окружения и деплой | Окружение — место, куда выкатывается версия, и forge помнит, что и когда туда выкатили | environment staging/production, ручной запуск, история деплоев, откат перезапуском старой джобы (C25); A-I6 «Одна строка» | полностью | полностью | + review apps, `resource_group` |
| A5b. Как выкладывают | Выкладка — замена старой версии новой, и способ замены решает, сколько пользователей пострадает от ошибки | выкладка на VPS по SSH и compose (C13); recreate, rolling, blue-green, canary, откат (C14); объяснение E-DEPLOY | полностью | полностью | полностью |
| A6. Правила и форма | Пайплайн одного файла ведёт себя по-разному на MR, в `main` и на теге | `rules: if/changes/when`, `workflow: rules` (C24), `needs` (C26), `parallel:matrix`, `default`, `extends`, `include` (C27), `allow_failure`, `retry`, `timeout` | основы `rules` | полностью | полностью |
| A6g. GitHub Actions | Понятия переносятся, меняются слова | `on`, `jobs`, `runs-on`, `steps`, `uses: actions/checkout`, `actions/cache`, `upload-artifact`/`download-artifact`, `secrets`, `environment` с ревьюерами, `concurrency`, reusable workflows, `strategy.matrix` (C31) | полностью | полностью | полностью |
| A7. Деплой в Kubernetes | CI либо сам меняет кластер (push), либо пишет желаемое в Git, а кластер подтягивает его (pull) | раздел 3.7 (C28, C29) | обзорно | полностью | полностью |

### 3.4. План учебника и объяснения E-CI, E-DEPLOY

**A1. Первый пайплайн.** Тезис: пайплайн — это файл в репозитории, и всё, что делает CI, записано в нём.
1. Каждый push на forge — событие; forge смотрит, есть ли в коммите файл `.gitlab-ci.yml` (опирается на C04, C30).
2. Файл описывает джобы: у джобы есть имя и скрипт — те же команды, что вы набирали бы руками.
3. Forge не выполняет скрипт сам: он ставит джобу в очередь, а раннер на другой машине забирает её.
4. Раннер выполняет строки скрипта по очереди и отправляет вывод обратно — это лог джобы.
5. Если какая-то команда вернула ненулевой код, джоба завершается со статусом failed (опирается на L19).
6. Статус пайплайна виден в MR, и это сигнал команде: «основная ветка сломана, чините первой» (опирается на M14).
Проверка понимания: A-D2 «почему пайплайн красный» — найти строку лога.

**A3. Артефакты и кэш.** Тезис: артефакт и кэш оба «сохраняют файлы между джобами», но первый обязан дойти, а второй может пропасть.
1. Каждая джоба начинается на чистой машине: всё, что создала прошлая джоба, исчезло (опирается на C22).
2. Артефакт — файлы, которые раннер загружает на forge после джобы и выдаёт следующим джобам и людям.
3. Если артефакт не объявлен, следующая джоба падает: `dist/: No such file or directory`.
4. Кэш — файлы, которые раннер сохраняет у себя или в общем хранилище, чтобы следующий запуск был быстрее.
5. Ключ кэша решает, кто его увидит: ветка, lock-файл, общий для всех.
6. Без кэша джоба успешна, но медленнее; без артефакта — падает. Это и есть проверка «что вам нужно».
Проверка понимания: A-I3 «Две полки» с выключением второго раннера.

**A5b. Как выкладывают.** Тезис: способ замены старой версии новой решает, сколько пользователей увидит ошибку и как быстро её отменить.
1. Выкладка на один сервер из CI: ключ SSH в File-переменной, `ssh deploy@host 'docker compose pull && docker compose up -d'`, `resource_group: production` против двух одновременных выкладок (опирается на N18, D21, C25).
2. Recreate: остановить старую, запустить новую — простой есть всегда.
3. Rolling: заменять по одному экземпляру — простоя нет, но какое-то время работают обе версии.
4. Blue-green: поднять новую рядом и переключить трафик сразу — мгновенный откат, двойные ресурсы.
5. Canary: пустить на новую 5% трафика, смотреть на долю ошибок, затем 50%, 100% — ошибка задевает немногих (опирается на N19; доля ошибок из мониторинга — `forward: [O06]`).
6. Откат — тоже выкладка: предыдущий тег образа, Re-deploy старой джобы окружения.
Проверка понимания: E-DEPLOY, тумблер «новая версия отдаёт 500» с предсказанием.

**E-CI «От `git push` до работающей версии».** Схема слева направо: `рабочий каталог` (`--c-code`) → `forge` → `пайплайн` → `очередь джоб` → `раннер` → `реестр образов` (`--c-store`) → `staging` → `production`. Квадрат коммита `1a2b3c4` — единственный движущийся объект.

| Экран | На экране и что движется | Параметры и переключатели | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. Push | Стрелка `git push (HTTPS/SSH)` с подписью «объекты + ссылка main»; квадрат коммита едет к forge | — | «push отклонён (не fast-forward)» → стрелка красная, в терминале `! [rejected]` | «Forge принимает push только поверх своей истории» |
| 2. Пайплайн создан | Forge читает `.gitlab-ci.yml`; появляются карточки джоб со статусом created | Событие: push в ветку / MR / тег | «файл пайплайна с ошибкой» → пайплайна нет, `jobs config should contain at least one visible job` или ошибка схемы со строкой | При смене события набор джоб пересчитывается по `rules`; справа список «почему эта джоба есть / её нет» |
| 3. Очередь | Джобы pending; от раннеров к forge стрелки `POST /api/v4/jobs/request` с подписью «опрос каждые 3 с» | Число раннеров 1–4; `concurrent` 1–4; теги раннеров | «выключить раннер с тегом docker» → `This job is stuck because you don't have any active runners online or available with any of these tags assigned to them` | Счётчик «ожидание в очереди» пересчитывается сразу: «`concurrent: 1` — +40 с» |
| 4. Внутри раннера | Полоса времени джобы делится на сегменты: pull образа → clone → restore cache → script → save cache → upload artifacts | `cache: on/off`; `GIT_DEPTH` 1/20/0 | «образ не существует» → `ERROR: Job failed: failed to pull image`; «кэш недоступен» → джоба зелёная, но длиннее | Без кэша сегмент `npm ci` растёт с 9 до 52 с: «кэш ускоряет, но может пропасть — сборка всё равно успешна» |
| 5. Артефакт | `dist/` едет из `build` в `deploy` по стрелке «через forge, не через раннер» | `needs` / стадии | «артефакт не объявлен» → `deploy` падает с `dist/: No such file` | С `needs` полоса пайплайна перестраивается в граф, подпись «−N с» |
| 6. Образ | `build-image` → реестр: стрелка `docker push registry/web:$CI_COMMIT_SHORT_SHA` | Тег: `:sha` / `:latest` | «тесты стоят после деплоя» → непроверенная версия на staging, smoke-test ловит ошибку уже там | Пояснение: «неизменяемый тег — по нему всегда видно, что выкачено» |
| 7. Окружения | `deploy` → staging → production; у production кнопка ▶ | `when: manual` на production вкл/выкл | «тест падает» → стрелка до staging не рисуется, подпись «код возврата 1 → джоба failed → следующие стадии skipped» | Подпись последнего отрезка меняется: «Continuous Delivery» ↔ «Continuous Deployment» (M15, M16) |
| 8. Обратная связь | Статус возвращается в MR, в истории окружения появляется запись | — | — | — |

Клик по любой стрелке открывает карточку «что это, кто инициирует, где увидеть» (`CI_PIPELINE_SOURCE`, лог раннера, страница Jobs, Environments). В A7 тот же степпер получает девятый экран: «`kubectl`/`helm` в джобе → API-сервер kube-lite → новый ReplicaSet».

**E-DEPLOY «Как выкладывают».** Схема: балансировщик слева, справа ряд из четырёх экземпляров приложения, у каждого метка версии (`v1` / `v2`). По линиям к экземплярам идут точки-запросы; запрос, получивший 500, гаснет красным крестиком. Под схемой — счётчики «пользователей с ошибкой», «секунд простоя», «экземпляров сейчас» и полоса времени выкладки.

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. Один сервер по SSH | Джоба CI → стрелка `ssh deploy@host` → `docker compose pull && up -d`; контейнер `v1` гаснет, `v2` загорается | `resource_group` вкл/выкл | «два пайплайна выкладывают одновременно» без `resource_group` → на сервере версия, которая выкатилась последней, а не новая | «`resource_group` ставит выкладки в одно окружение в очередь» |
| 2. Recreate | Все четыре `v1` гаснут, затем загораются `v2`; точки-запросы в промежутке гаснут | Время старта новой версии 1–30 с | — | Счётчик простоя = время старта |
| 3. Rolling | Экземпляры меняются по одному | `maxSurge`, `maxUnavailable` 0–2 (те же слова будут в K12) | «новая версия отдаёт 500» → ошибки растут ступеньками, пока выкладку не остановили | «Обе версии работают одновременно: API должно быть совместимо» |
| 4. Blue-green | Рядом поднимается вторая четвёрка `v2`, балансировщик переключает стрелку одним движением | Задержка переключения | «новая версия отдаёт 500» → ошибки у всех сразу, но откат — одно переключение назад | Счётчик «экземпляров сейчас» показывает 8: цена мгновенного отката — двойные ресурсы |
| 5. Canary | На линию к одному `v2` уходит доля трафика | Ползунок «доля на новую» 5 / 25 / 50 / 100%; порог автоостановки по доле 5xx | «новая версия отдаёт 500» → страдают 5%, выкладка останавливается по порогу | «Ошибку увидел каждый двадцатый, а не каждый» |
| 6. Откат | Re-deploy предыдущего тега на странице окружений | Способ: Re-deploy / `git revert` + новый пайплайн | — | «Откат по старому тегу быстрее: образ уже собран и проверен» |

Источник шагов — события `deploy.shift`, `ci.job` и `net.packet`.

### 3.5. Интерактивы

**A-I2. Конструктор пайплайна.** Главный интерактив блока (виджет `constructor` 08, 3.7).
- *Холст.* Палитра готовых джоб учебного проекта (`lint`, `unit-test`, `build`, `build-image`, `scan-image`, `push-image`, `deploy-staging`, `smoke-test`, `deploy-production`, пустая джоба); колонки — стадии, карточки — джобы, линии — зависимости (неявные «вся предыдущая стадия» серым пунктиром, явные `needs` сплошными, подпись на линии — что передаётся: «артефакт `dist/`», «ничего, только порядок»). Справа YAML; связь двусторонняя (Document API `yaml` сохраняет комментарии). Раскладка — ручная сетка 8 px по стадиям, без автоматической перестановки узлов между шагами (08, 3.2).
- *Прогон.* «Запустить» коммитит файл и запускает пайплайн на выбранном событии. Карточки красятся по статусам с формой-дублем (0.7); полоса времени показывает параллельность и ожидание раннера. Клик по карточке открывает лог.
- *Раннеры.* Две-три карточки с тегами и `concurrent`; выключение раннера сразу меняет очередь.
- *Сломать.* Тумблеры: тест падает; артефакт не объявлен; образ не существует; переменная не задана; кэш недоступен; таймаут; нестабильный тест с `retry: 2`; деплой раньше тестов. Каждый тумблер — с предсказанием.

**A-I3. «Две полки».** Два пайплайна подряд. Над раннерами — полка кэша (`--c-store`) с ярлыками ключей, над пайплайном — коробка артефактов. Пайплайн 1: кэша нет, `npm ci` долгий, полка наполняется; `build` кладёт `dist/` в коробку, `deploy` достаёт. Пайплайн 2 на другой ветке: ключ другой, полка пуста; ученик меняет `key` на `$CI_COMMIT_REF_SLUG` или `files: [package-lock.json]` и видит разницу. Выключение второго раннера показывает, что локальный кэш одного раннера не виден другому без общего хранилища.

**A-I4. «Настройки переменных».** Экран Settings → CI/CD → Variables: ключ, значение, тип (Variable/File), Protected, Masked, Masked and hidden, область окружения. Справа лог джобы; изменение флага перезапускает джобу. Видны `[MASKED]` в логе, пустое значение в незащищённой ветке, отказ сохранить слишком короткое значение с флагом Masked, утечка через `base64`. Для GitHub — Secrets and variables и правило, что секреты не передаются в workflow из форков.

**A-I5. «Окружения».** Страница Environments: staging и production, последний деплой, коммит, кто запустил, Re-deploy у старых деплоев. Откат инцидента C13 делается здесь.

**A-I6. «Одна строка».** Мост от M15/M16: переключатель `when: manual` у `deploy_production` в YAML, рядом подпись практики; вариант с правилами — Deployment для staging, Delivery для production.

```yaml
deploy_production:
  stage: deploy
  script: ./deploy.sh production
  environment: production
  rules:
    - if: '$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/'
      when: manual     # есть — Continuous Delivery; нет — Continuous Deployment
```

### 3.6. Тренажёры

L0 проходит A-D1…A-D8, L1 — все, кроме помеченных «L2», L2 — все.

| ID | Тип | Задание | Цели |
|---|---|---|---|
| A-D1 | build | Пайплайн из одной джобы, которая запускает `./test.sh` | `lint`; прогон success; в логе `$ ./test.sh` |
| A-D2 | read | «Почему пайплайн красный?» — 8 логов, найти строку причины | номер строки ± 1 |
| A-D3 | fix | `dist/` не найден в deploy (пример 0.4) | цели из 0.4 |
| A-D4 | fix | Джоба pending навсегда: тег `dokcer` | джоба взята раннером; ступень 2 — вырезка `tags` |
| A-D5 | fix | Тест падает; чинить **код**, а не пайплайн | прогон success; `keep`: тестовая джоба на месте, без `allow_failure` |
| A-D6 | build | Кэш зависимостей: второй прогон в той же ветке быстрее, смена `package-lock.json` сбрасывает кэш | второй прогон < 60% первого; третий после правки lock-файла — `ci.cache.hit=false` |
| A-D7 | fix | Секрет напечатан в лог через `echo` | в логе нет значения; `keep`: нет `set -x` при наличии секрета |
| A-D8 | build | Staging автоматически из main, production вручную | на `push main`: staging success, production manual |
| A-D9 | build | `rules`: тесты на MR и main, образ только в main и тегах, docs-джоба только при изменении `docs/**` | 5 событий с разными `changedFiles` и ref |
| A-D10 | build | DAG на `needs` (пул, задание 5) | модельное время, граф |
| A-D11 | build | Матрица: тесты на Node {{versions.node_prev_lts}} и {{versions.node_lts}} (на дату документа — 22 и 24) | два экземпляра джобы с разными образами |
| A-D12 | port | Перенести готовый `.gitlab-ci.yml` на GitHub Actions | actionlint без ошибок; те же шаги; артефакт через upload/download-artifact |
| A-D13 (L2) | fix | Два деплоя в production одновременно затирают друг друга | `resource_group: production` или `concurrency`; проверка одновременным запуском двух пайплайнов |
| A-D14 (L2) | build | Вынести общий `before_script` в ключевое слово `default:`, общую часть деплоев — в скрытую джобу `.deploy` с `extends`, подключить шаблон через `include:local` | итоговый развёрнутый конфиг равен эталону; исходный файл короче на ≥ 30%; `fail` на джобу с именем `.default`: «`.default` — скрытая джоба, она молча ничего не делает; общие настройки задаёт ключевое слово `default:`» (`term: C27`) |
| A-D15 | build | Выкладка на staging-VPS по SSH и compose из main; production вручную; откат — Re-deploy предыдущего тега | на модели VPS в Стенде запущен образ с нужным SHA; после отката — с предыдущим |
| A-D16 (L2) | build | Canary в compose-окружении: два сервиса за nginx с весами `upstream`, переключение 10% → 100% отдельной ручной джобой | веса в конфиге nginx на каждом шаге; при `fault: v2-500` выкладка не дошла до 100% |
| A-L1…A-L20 | lint | 20 сломанных фрагментов: `script` строкой; `stage` не из `stages`; `only` вместе с `rules`; `needs` на джобу более поздней стадии; `needs` на джобу, которую `rules` исключают, без `optional: true`; `on: push` с опечаткой в `branches`; нет `runs-on`; `uses` без версии | `lint` = 0, семантическая проверка эталона |
| A-D17…A-D20 | — | Деплой в Kubernetes, раздел 3.7 | — |

### 3.7. A7. Деплой в Kubernetes из CI

Джоба A7 исполняется раннером симулятора, а команды `kubectl` и `helm` в её скрипте выполняет kube-lite того же воркера (05, 5.2; 09, 1.7). Поэтому визуализатор цикла сверки и схема «Kubernetes из блоков» показывают выкладку, запущенную пайплайном, а не её правдоподобный лог.

План (понятия C28, C29; требует K12, K25, K28, K29):
1. **Чем входить в кластер.** ServiceAccount `deployer` в namespace `staging`, Role с `get/list/watch/create/update/patch` на `deployments`, `services`, `configmaps`, RoleBinding; токен — `kubectl create token deployer --duration=1h` в File-переменной `KUBECONFIG`, Protected, область окружения `staging`. Рекомендуемый путь GitLab — GitLab agent for Kubernetes с `ci_access` (интеграция кластеров по сертификату в GitLab снята); для облачных кластеров — OIDC. Анти-пример — kubeconfig `cluster-admin`: `kubectl auth can-i delete nodes` из джобы должна вернуть `no`.
2. **Неизменяемый тег.** Образ `registry/web:$CI_COMMIT_SHORT_SHA`; `kubectl set image` или `helm upgrade --install web ./chart --set image.tag=$CI_COMMIT_SHORT_SHA`. Через цикл сверки: новый тег → новый `pod-template-hash` → новый ReplicaSet. С `:latest` и неизменённым манифестом Deployment не меняется, выкладки нет.
3. **Ждать и откатывать.** `kubectl rollout status deploy/web --timeout=120s` (джоба падает, если выкладка не завершилась); `helm upgrade --install --wait --rollback-on-failure` — имя флага в Helm 4, прежнее `--atomic` даёт предупреждение об устаревании, `--force` переименован в `--force-replace`; ручной откат — `kubectl rollout undo`, `helm rollback` или Re-deploy старой джобы окружения.
4. **Push против pull.** CI с правами в кластере (push) против CI, который коммитит тег в репозиторий конфигурации, а `argocd-lite` из 05 его подтягивает (pull). GitOps как понятие (K29) вводит 05; здесь только сторона CI. Связь с E-REC (5.5).

| ID | Задание | Цели |
|---|---|---|
| A-D17 | «Джоба зелёная, а сайт старый»: тег `latest` и `imagePullPolicy: IfNotPresent` | `k8s.objects[kind=Deployment][metadata.name=web].spec.template.spec.containers[0].image=~':[0-9a-f]{8}$'`; rollout завершён |
| A-D18 | «Деплой упал с Forbidden»: Role без `patch` | джоба success; `keep`: у SA нет ClusterRoleBinding; `fail.term: K25` |
| A-D19 | «Сломанный образ ушёл в прод»: добавить `rollout status --timeout` и откат | при образе `trainer/web:2.0` (CrashLoopBackOff, 05, 5.2) джоба failed **и** за всё время у Deployment `readyReplicas ≥ 2` прежней ревизии (журнал kube-lite) |
| A-D20 (L2) | «Переведите деплой на GitOps»: CI коммитит тег в `deploy/values.yaml`, Application `argocd-lite` Synced | Application Synced/Healthy с новой ревизией; `fail`: `kubectl` в скрипте джобы |

### 3.8. Практический экзамен A (самопроверка, `envs: [sim]`)

Сценарий: учебный проект «сайт-визитка» (nginx + статический сайт, Dockerfile, тесты-скрипты) в forge, пустой файл пайплайна, два раннера, пустые настройки переменных. 90 минут, `doc_ladder: { step: 5, allowed: [docs.gitlab.com/ci, docs.github.com/actions] }`.

| Задача | Вес | Карточка | Проверки |
|---|---|---|---|
| t1 | 20 | Проверка (lint + тесты) на каждом MR | `critical`: на событии MR прогоняются lint и тесты; `fail`: `allow_failure` у тестов |
| t2 | 20 | Образ с тегом `$CI_COMMIT_SHORT_SHA` в учебный реестр только из main; пароль реестра — переменной | `critical`: `ci.registry[ref~':<sha>']`; в репозитории нет строки, совпадающей с секретом |
| t3 | 15 | Staging — автоматически из main; production — вручную, только из тегов `vX.Y.Z`; параллельные выкладки в одно окружение исключены | прогоны на MR, push main, тег `v1.0.0`, тег `test`; staging отдаёт новую версию; одновременный запуск двух пайплайнов |
| t4 | 15 | Вариант из сида: лог `This job is stuck`; кэш по ключу ветки не ускоряет MR; секрет в логе через `base64`; `needs` на джобу, исключённую `rules`; задача ступени 5 (`workflow:rules` + `auto_cancel` или `rules:exists`) | цели варианта |
| explain | 30 | «Это Continuous Delivery или Continuous Deployment? Что поменять, чтобы стало другим?»; «Чем ваш кэш отличается от артефакта, и что будет, если кэш пропадёт?» | рубрика: ручной шаг; готовый к выпуску артефакт; кэш — ускорение, артефакт — передача результата |

L2 дополнительно: время пайплайна в main ≤ N, версия для GitHub Actions проходит actionlint. `pass: { critical: all, total_min: 70 }`.

### 3.9. Источники A

- EN: GitLab CI/CD YAML reference — https://docs.gitlab.com/ci/yaml/ ; caching — https://docs.gitlab.com/ci/caching/ ; job artifacts — https://docs.gitlab.com/ci/jobs/job_artifacts/ ; CI/CD variables — https://docs.gitlab.com/ci/variables/ ; environments — https://docs.gitlab.com/ci/environments/ ; GitLab agent for Kubernetes, CI/CD workflow — https://docs.gitlab.com/user/clusters/agent/ci_cd_workflow/ ; GitLab Runner — https://docs.gitlab.com/runner/ ; CI schema — https://docs.gitlab.com/development/cicd/schema/ ; GitHub Actions — https://docs.github.com/en/actions ; actionlint playground — https://rhysd.github.io/actionlint/ ; gitlab-ci-local — https://github.com/firecow/gitlab-ci-local ; Helm 4 overview — https://helm.sh/docs/overview ; Helm 3 end of life — https://helm.sh/blog/helm-v3-end-of-life ; Martin Fowler, BlueGreenDeployment — https://martinfowler.com/bliki/BlueGreenDeployment.html ; CanaryRelease — https://martinfowler.com/bliki/CanaryRelease.html
- RU: GitHub Actions на русском — https://docs.github.com/ru/actions ; Хабр, cache и artifacts в GitLab CI — https://habr.com/ru/articles/869422 ; Хабр, стадии и первый пайплайн — https://habr.com/ru/articles/841474 ; книги: Хамбл, Фарли, «Непрерывное развёртывание ПО» (Вильямс, 2011 — перевод «Continuous Delivery»); Форсгрен, Хамбл, Ким, «Ускоряйся! Наука DevOps» (Альпина, 2020 — перевод «Accelerate»).

---

## 4. Блок B1. Ansible

### 4.1. Главные решения

**Основной движок — симулятор ansim на TypeScript; настоящий ansible-core — в лаборатории на многоузловой сети v86 и на настоящих ВМ.** ansible-core в Pyodide не запускается без глубокой переделки: он порождает рабочие процессы через `fork` и ходит на хосты по SSH. ansim реализует семантику ansible-core на подмножестве: инвентарь, группы, переменные с полной таблицей приоритетов, плеи, задачи, модули, факты, handlers, `when`, `loop`, `register`, теги, check mode и diff, роли, `serial`, стратегии `linear` и `free`, `forks`. Модули работают с «машинами» Стенда — теми же VFS, куда ученик заходит `ssh web1` и видит изменённый `/etc/nginx/nginx.conf` и запущенный сервис. Вывод повторяет стандартный callback Ansible (`PLAY [...]`, `TASK [...]`, `ok: [web1]`, `changed: [web2]`, `PLAY RECAP`).

**Модули ansim.** Имена в уроках и упражнениях — полные (FQCN), потому что лаборатория и практика работают на настоящем ansible-core, где модуля вне `ansible.builtin` без коллекции нет. Экран «полное имя модуля и откуда оно берётся» (I24) стоит в B1-3 до первого модуля из коллекции. Каждый модуль реализует `check_mode`, `diff` и честный `changed`.

| Модуль (FQCN) | Что моделирует | Ключевые параметры |
|---|---|---|
| `ansible.builtin.ping`, `ansible.builtin.setup` | связь, факты (`ansible_facts.os_family`, `distribution`, `default_ipv4`, `memtotal_mb`, `processor_vcpus`) | `gather_subset` |
| `ansible.builtin.apt`, `ansible.builtin.dnf`, `ansible.builtin.package` | пакетная база машины | `name`, `state: present/absent/latest`, `update_cache`, `cache_valid_time`, `deb` |
| `ansible.builtin.service`, `ansible.builtin.systemd_service` | сервисы systemd | `name`, `state`, `enabled`, `daemon_reload` |
| `ansible.builtin.copy`, `template`, `file`, `lineinfile`, `blockinfile` | файлы VFS | `src`, `dest`, `content`, `owner`, `group`, `mode`, `backup`, `regexp`, `line`, `create`, `state` |
| `ansible.builtin.user`, `ansible.builtin.group` | пользователи | `name`, `groups`, `append`, `shell` |
| `ansible.posix.authorized_key` (коллекция `ansible.posix`) | ключи SSH | `user`, `key`, `state` |
| `ansible.posix.sysctl` | параметры ядра | `name`, `value`, `sysctl_set` |
| `ansible.builtin.command`, `ansible.builtin.shell` | выполнение в оболочке Стенда; всегда `changed` без `creates`/`removes`/`changed_when` | `cmd`, `creates`, `removes`, `chdir` |
| `ansible.builtin.uri`, `ansible.builtin.wait_for` | HTTP к учебному сервису, ожидание порта | `url`, `status_code`, `port` |
| `ansible.builtin.cron`, `ansible.builtin.get_url` | только для заданий ступеней 4–5 | — |
| `ansible.builtin.debug`, `set_fact`, `assert`, `fail`, `include_tasks`, `import_tasks`, `include_role`, `meta` | управление | — |
| `community.general.ufw`, `community.general.timezone`, `community.docker.docker_container` | только L1/L2 и только как задания ступени 4 лестницы документации | — |

Межсетевой экран в основной программе настраивается шаблоном `/etc/nftables.conf` и handler `nft -f /etc/nftables.conf` — это опирается на N17 из блока сетей; `ufw` в курсе как понятие не вводится. Неподдерживаемый модуль даёт ошибку в формате Ansible (`couldn't resolve module/action 'x'`) с пояснением, что в браузерном тренажёре его нет, и ссылкой на лабораторию.

**Шаблоны.** В ansim шаблоны выполняет nunjucks: синтаксис совпадает с Jinja2 для используемого подмножества (`{{ }}`, `{% if %}`, `{% for %}`, фильтры). Фильтры Ansible (`default`, `bool`, `join`, `to_nice_yaml`, `regex_replace`, `combine`, `dict2items`) реализованы как фильтры nunjucks. Фильтр `ipaddr` живёт в коллекции `ansible.utils` и требует Python-пакета `netaddr`, поэтому в курс не входит; адреса в шаблонах берутся из фактов. Контентный линтер запрещает конструкции, где nunjucks и Jinja2 расходятся, а все шаблоны курса прогоняются в CI на настоящем ansible-core (9.2).

**Лаборатория «Настоящий Ansible» на многоузловой сети (R11).** Три машины v86 в Web Workers на общем JS-коммутаторе платформы (09, 1.6; R11): сегмент `10.0.0.0/24`, адреса раздаёт `dnsmasq`, имена — его DNS (`node-1.lab`). Управляющий узел `lab-ansible` — `lab-alpine` + `python3`, ansible-core закреплённой версии, `openssh-client`, коллекции `ansible.posix` и `community.general` с закреплёнными версиями, прогретый кэш `.pyc` в снимке; 256 МБ. Управляемые узлы — `lab-alpine` + `python3` + `openssh-server` (не dropbear: у него нет sftp-сервера, а Ansible по умолчанию передаёт модули по sftp, затем scp), 96 МБ каждый. В `ansible.cfg` лаборатории `pipelining = True`, в упражнениях `gather_facts: false` по умолчанию. Коммутатор визуализирует ssh-сессии: при `forks: 5` видно пять одновременных потоков, и это та же схема, что в E-ANS. Только для компьютера (`navigator.deviceMemory ≥ 8`); на телефоне — записанный режим или QR-передача. Образ `lab-ansible` добавляется в таблицу образов 09, 1.4; снимки трёх машин ≈ 90–110 МБ zstd, загрузка только по явному запуску. Те же управляемые узлы годятся гибридному Kubernetes (05, R11): Ansible настраивает узел, на котором потом работает наш агент kubelet.

**Порог приёмки спайка (фаза 0, 09, 7).** Плейбук из 5 задач на двух хостах из прогретого снимка проходит ≤ 90 с. v86 работает на 1–2% нативной скорости, а каждая задача — SSH, передача и запуск Python-модуля, поэтому реалистично десятки секунд на задачу; если порог не достигнут, лаборатория остаётся только в записанном режиме (кадры настоящего прогона в степпере), а настоящий ansible-core ученик запускает на своих ВМ в B3 и пет-проекте 5.

### 4.2. Уровни и дополнительный пул проверки

| Уровень | Что это значит для Ansible (01, 4.3) |
|---|---|
| L0 | Знает Linux (пакеты, systemd, файлы, ssh) и YAML; Ansible не видел |
| L1 | Запускал готовые плейбуки; путается в handlers, переменных и идемпотентности. Сюда же — программист, который писал скрипты настройки на bash или Python и не знает модели «желаемого состояния» |
| L2 | Писал небольшие плейбуки; не работал с ролями, приоритетами переменных, vault, не думал об идемпотентности |

Пул (`key: false`):
1. *(L1, П)* Инвентарь: группы `web` (web1, web2) и `db` (db1), `http_port=8080` для группы web. Цель: `ansible-inventory --list` даёт ожидаемый JSON.
2. *(L1, П)* Плейбук ставит nginx и запускает его на группе web. Цель: на web1 и web2 пакет есть, unit active и enabled; db1 без изменений.
3. *(L1, П)* «Почему `ansible.builtin.shell: echo 'max_conn=100' >> /etc/app.conf` плоха? Перепишите.» Цель: `ansible.runs[n=2].hosts[*].changed=0`, в файле одна строка после трёх прогонов.
4. *(L2, П)* «Конфиг nginx — шаблоном; nginx перезагружается только при изменении конфига.» Цели: прогон 1 — handler выполнен; прогон 2 — нет; прогон 3 после смены переменной — да.
5. *(L2, Т)* «`app_port` задан в `group_vars/all`, `group_vars/web`, `host_vars/web1` и в `vars:` плея с `hosts: all`. Какое значение получат web1, web2 и db1? Какое — с `-e app_port=9000`?» Ответ — по лестнице приоритетов.
6. *(L2, П)* «Превратите плейбук в роль `webserver` с `defaults` и handler; плейбук вызывает роль.» Цели: структура каталогов, прогон и идемпотентность, переопределение `defaults` из инвентаря работает.

### 4.3. Программа

| Модуль | Тезис главы | Содержание | L0 | L1 | L2 |
|---|---|---|---|---|---|
| B1-1. Зачем | Описание того, каким сервер должен быть, воспроизводимо, а набор команд — нет | пять серверов вручную → скрипт → желаемое состояние; управляющая машина и хосты, агент не нужен, нужны ssh и python (I01, I02) | полностью | кратко | кратко |
| B1-2. Инвентарь | Ansible знает о хостах только то, что написано в инвентаре | INI и YAML, группы, `children`, `all`, переменные хоста и группы, `ansible-inventory --graph` (I09) | полностью | полностью | кратко |
| B1-3. Модули | Модуль сначала смотрит, как есть, и меняет только разницу | ad-hoc `ansible all -m ansible.builtin.ping`, `-m ansible.builtin.apt -a ... -b`, FQCN и коллекции (I24), `ansible-doc` | полностью | кратко | кратко |
| B1-4. Первый плейбук | Плейбук — список задач, которые выполняются на всех хостах по очереди | плей, `hosts`, `become`, задачи, порядок «задача на всех хостах, потом следующая», RECAP (I10) | полностью | полностью | полностью |
| B1-5. Идемпотентность | Второй прогон, который ничего не меняет, — главный тест плейбука | ok/changed, почему `command` всегда changed, `creates`, `changed_when`, второй прогон как тест | полностью | полностью | полностью |
| B1-6. Факты | Ansible сначала спрашивает хост, кто он | `gather_facts`, `ansible_facts`, `setup` (I15) | полностью | полностью | кратко |
| B1-7. Переменные и шаблоны | Один шаблон даёт разный конфиг на разных хостах | `vars`, `group_vars/`, `host_vars/`, Jinja2, `ansible.builtin.template` (I11) | полностью | полностью | полностью |
| B1-8. Handlers | Перезапуск сервиса — следствие изменения, а не отдельный шаг | `notify`, выполнение в конце плея, один раз, `flush_handlers`, `--force-handlers` (I16) | полностью | полностью | полностью |
| B1-9. Управление ходом | Условие, цикл и результат задачи | `when`, `loop`, `register`, `failed_when`, `block/rescue`, теги | основы | полностью | полностью |
| B1-10. Роли | Роль — плейбук, разложенный по каталогам так, что его можно переиспользовать | `ansible-galaxy init`, структура, `defaults` против `vars`, зависимости ролей (I12) | обзорно | полностью | полностью |
| B1-11. Приоритет переменных | Значение побеждает по месту, где оно задано, а не по порядку чтения | лестница из 9 ступеней для курса и ссылка на полную таблицу (I17) | — | полностью | полностью |
| B1-12. Проверка и безопасность | Сначала посмотреть, что изменится, потом менять, и по одному хосту | `--check --diff` (I25), `--limit`, `serial`, `ansible-vault` (I14) | `--check` | полностью | + `ansible-lint`, Molecule обзорно |

Лестница приоритетов для курса — 9 ступеней снизу вверх: role defaults → инвентарь `group_vars/all` → инвентарь `group_vars/<группа>` → инвентарь `host_vars/<хост>` → факты хоста → `vars:` плея → role vars → `set_fact` и `register` → extra vars (`-e`). ansim реализует полную таблицу из документации Ansible, курс учит упрощённую там, где они совпадают; полная таблица показывается L2 как справка.

### 4.4. План учебника и объяснение E-ANS

**B1-5. Идемпотентность.** Тезис: правильный плейбук можно запускать сколько угодно раз, и второй прогон ничего не меняет.
1. Модуль получает желаемое состояние и сначала проверяет текущее (опирается на B1-3).
2. Если они совпадают, модуль отвечает `ok` и ничего не делает; если нет — меняет и отвечает `changed`.
3. `command` и `shell` не знают, каким должно быть состояние, поэтому всегда отвечают `changed` (опирается на L21).
4. `creates`, `removes` и `changed_when` сообщают Ansible, как понять, что команда уже была выполнена.
5. Второй прогон с `changed=0` — проверка, что плейбук описывает состояние, а не действия.
6. Скрытая неидемпотентность: шаблон с текущим временем меняет файл каждый раз и каждый раз перезапускает сервис.
Проверка понимания: визуализатор B1-I4 и тренажёр B1-D3.

**E-ANS «Идемпотентный прогон Ansible».** Слева управляющая машина, справа три–шесть хостов (`--c-node`), между ними линии с подписями `ssh`, `python3 ~/.ansible/tmp/…/AnsiballZ_apt.py`, `JSON: {"changed": false}`. Внизу сетка идемпотентности (задачи × прогоны). Движутся только точки по линиям ssh и заполнение ячеек сетки.

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. Подключение | От управляющей машины к хостам одновременно идут `forks` стрелок ssh | Число хостов 1–6; `forks` 1–5 | «у хоста нет python» → `/usr/bin/python3: not found`, хост помечен `UNREACHABLE`/`MODULE FAILURE` | «Ansible без агента, но не без python — кроме модуля `raw`» |
| 2. Факты | С каждого хоста возвращается карточка `ansible_facts` (семейство ОС, адрес, память) | `gather_facts` вкл/выкл | — | Без фактов задача с `when: ansible_facts.os_family == 'Debian'` падает; показано, на какой строке |
| 3. Задача | Модуль на хосте сравнивает «как надо» с «как есть»; ячейка сетки красится ok / changed | Тип задачи: `lineinfile` / `shell: echo >>` / `template` с `ansible_date_time` | — | При `shell >>` файл растёт на строку каждый прогон, ячейка всегда жёлтая |
| 4. Порядок | Курсор задачи проходит все хосты, прежде чем перейти к следующей строке | `strategy: linear / free`; `serial: 1 / 2 / all` | «второй хост падает на задаче 2 при `serial: 1`» → хосты 3–4 нетронуты | «Вот зачем `serial`: ошибка останавливает выкладку на одном хосте» |
| 5. Handlers | `notify` кладёт фишку handler в очередь сбоку; в конце плея handler выполняется один раз | `--force-handlers` вкл/выкл | «задача после `notify` упала» → handler на этом хосте не выполнен | С `--force-handlers` — выполнен |
| 6. Прогоны | Переключатель «прогон № 1→2→3» заполняет столбцы сетки | `--check` вкл/выкл | — | В `--check` стрелки пунктиром, на хостах ничего не меняется: «модуль сообщает, что изменил бы» |
| 7. RECAP | `PLAY RECAP` с цифрами по хостам | — | — | Клик по цифре показывает задачи, из которых она сложена |

Клик по хосту открывает терминал `ssh web1` и вкладки «Пакеты», «Сервисы», «Файлы». Источник шагов — `ans.ssh` и `ans.task`; в лаборатории v86 те же события строятся из JSON-колбэка настоящего ansible-core.

### 4.5. Интерактивы

**B1-I1. «Ручная настройка против описания».** Пять серверов и список ручных шагов; каждый сервер настроен немного иначе (дрейф конфигурации подсвечен в таблице «сервер × параметр»). Затем тот же список как описание состояния: «пакет есть», «файл такой», «сервис запущен». Чертёж, без персонажей.

**B1-I2. «Карта хостов».** Карточки хостов в рамках групп (группа внутри группы — рамка в рамке), слева файл инвентаря. Правка файла перестраивает карту, перетаскивание хоста между рамками правит файл. Клик по хосту — итоговые переменные с источником каждого значения (готовит B1-11).

**B1-I3. «Прогон плейбука».** Редактор плейбука, карточки хостов с вкладками «Пакеты», «Сервисы», «Файлы», справа вывод `ansible-playbook`. Текущая задача подсвечена в редакторе, на карточках вспыхивает то, что изменилось. Это рабочее место; объяснение процесса — E-ANS.

**B1-I4. Визуализатор идемпотентности.** Сетка: строки — задачи, столбцы — прогоны (до пяти), ячейки — по хостам; модель — секвенсор Sankofa. Под сеткой — «плёнка» содержимого одного файла по прогонам. Примеры: `shell: echo ... >>` (жёлтый столбец всегда, файл растёт) → `lineinfile` (зелёные столбцы со второго); `command: useradd deploy` падает на втором прогоне («user already exists») → модуль `user`; шаблон с `{{ ansible_date_time.iso8601 }}` перезапускает nginx каждый раз.

**B1-I5. «Очередь handlers».** Временная шкала плея: три задачи уведомляют один handler, в конце плея он выполняется один раз; при упавшей задаче — не выполняется, с `--force-handlers` — выполняется.

**B1-I6. «Лестница переменных».** Девять ступеней; ученик расставляет источники значений, затем отвечает на 10 вопросов «какое значение получит хост». Каждый ответ подтверждается прогоном `ansible.builtin.debug: var=app_port`.

**B1-I7. «Что внутри роли».** Дерево, созданное `ansible-galaxy init webserver`: `tasks/main.yml`, `handlers/main.yml`, `templates/`, `files/`, `defaults/main.yml`, `vars/main.yml`, `meta/main.yml`. Клик по каталогу объясняет, когда Ansible его читает, и подсвечивает строки «плоского» плейбука, из которого роль получена.

### 4.6. Тренажёры

| ID | Задание | Цели |
|---|---|---|
| B1-D1 | 10 ad-hoc команд: пинг группы, пакет на одном хосте, свободная память всех хостов через факты | вывод и состояние хостов |
| B1-D2 | nginx, `index.html` с именем хоста (`{{ inventory_hostname }}`), сервис запущен | файл на каждом хосте содержит своё имя; второй прогон `changed=0`; ступень 2 — вырезка OPTIONS `template` |
| B1-D3 | «Найдите неидемпотентные задачи»: плейбук из 8 задач, отметить 3 | выбор + исправленный плейбук идемпотентен; ступень 2 — вырезка `lineinfile` |
| B1-D4 | Handler не срабатывает: опечатка в имени `notify` | после изменения шаблона сервис перезагружен |
| B1-D5 | `when` по `ansible_facts.os_family`: Debian — apt, RedHat — dnf (машины разных семейств) | прогон на смешанном инвентаре |
| B1-D6 | `loop` по списку пользователей с ключами (`ansible.posix.authorized_key`) | пользователи и `authorized_keys` на хостах |
| B1-D7 | Пароль БД в vault | файл начинается с `$ANSIBLE_VAULT;1.1;AES256`; прогон с `--ask-vault-pass` успешен; в репозитории нет пароля открытым текстом |
| B1-D8 | Поочерёдная выкладка на 4 web-хоста с проверкой `uri` после каждого (`serial: 1`) | сломанный второй хост останавливает выкладку, хосты 3–4 не тронуты |
| B1-D9 | Межсетевой экран шаблоном `nftables.conf` + handler `nft -f`: открыть 22 и 80 | правила в `net.nft` фактов; доступ по 80 есть, по 8080 нет; второй прогон `changed=0` |
| B1-D10 | Рефакторинг в роль (пул, задание 6) | структура, прогон, идемпотентность |
| B1-D11 | `--check --diff` перед изменением: предсказать diff | совпадение предсказанных строк |
| B1-D12 | Задачи ступени 4 из 0.5 (`--start-at-task`, `run_once`, `delegate_to`, `apt: deb:`) | по эффекту + поле «где нашёл» |

### 4.7. Практический экзамен B1 (самопроверка, `envs: [sim]`; L2 — по желанию повтор в лаборатории v86)

```yaml
id: exam-ansible
block: iac
time_limit_min: 90
story: { ru: "Вы вторую неделю в «Ларьке». Под новое приложение выделили три сервера; тимлид оставил карточки.", en: "..." }
sandbox: { image: ansim-3hosts, seed: "{{seed}}" }   # app1 Debian, app2 семейство RedHat, db1 Debian
doc_ladder: { step: 5, allowed: [docs.ansible.com] }
tasks:
  - id: t1
    weight: 25
    card: { ru: "Роль common на всех хостах: пользователь deploy с ключом, пакеты curl и htop, межсетевой экран открывает только 22 и 80.", en: "..." }
    checks:
      - { id: t1a, critical: true, when: "files[/home/deploy/.ssh/authorized_keys].exists" }
      - { id: t1b, points: 10, when: "ansible.runs[n=2].hosts[*].changed=0" }
      - { id: t1c, points: 5, eval: { yaml_path: "$..['ansible.builtin.shell','ansible.builtin.command','shell','command']", not_matches: "useradd|apt-get|yum|dnf|nft add" } }
  - id: t2
    weight: 25
    card: { ru: "nginx на app-хостах проксирует на порт приложения из group_vars/app; смена порта даёт ровно один reload на каждом app-хосте.", en: "..." }
    checks:
      - { id: t2a, critical: true, when: "http.app1.status=200 && http.app2.status=200" }
      - { id: t2b, points: 15, eval: { run: { change: "group_vars/app.yml:app_port=8081" } }, when: "ansible.runs[-1].hosts[name=app1].tasks[handler=true][status=changed]#=1 && ansible.runs[-1].hosts[name=app2].tasks[handler=true][status=changed]#=1" }
  - id: t3
    weight: 20
    card: { ru: "PostgreSQL на db1: пакет, сервис, listen_addresses на частный адрес, пароль только в vault.", en: "..." }
    checks:
      - { id: t3a, critical: true, when: "units[postgresql.service].active=active" }
      - { id: t3b, points: 10, eval: { grep_repo: "{{secret.db_password}}" }, expect: absent }
  - id: t4
    weight: 0              # вес задачи берётся из поломки
    variant_of: [fault-handler-typo, fault-when-family, fault-vault-missing, fault-become, task-cron-module]
    card: { ru: "После вашего прогона пришла жалоба: на одном из app-хостов сайт старый. Найдите и устраните причину.", en: "..." }
    checks: "{{fault.checks}}"
explain:
  weight: 30
  questions:
    - { id: e1, q: { ru: "Тимлид: «Почему второй прогон ничего не меняет, и зачем нам это?»" }, key_points: [desired-state, module-checks-current, changed-zero-as-test] }
    - { id: e2, q: { ru: "Где лежит пароль базы и кто может его прочитать?" }, key_points: [vault-encrypted, key-outside-repo, ci-variable] }
pass: { critical: all, total_min: 70 }
```

`forbid`-цели во всех задачах: `ignore_errors: true`; `shell`/`command` там, где есть модуль из списка; пароль открытым текстом.

### 4.8. Источники B1

- EN: Getting started — https://docs.ansible.com/ansible/latest/getting_started/index.html ; inventory — https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html ; variable precedence — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#understanding-variable-precedence ; roles — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html ; handlers — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html ; check mode — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html ; collections and FQCN — https://docs.ansible.com/ansible/latest/collections_guide/index.html ; ansible.posix.authorized_key — https://docs.ansible.com/ansible/latest/collections/ansible/posix/authorized_key_module.html ; connection settings (pipelining, transfer) — https://docs.ansible.com/ansible/latest/collections/ansible/builtin/ssh_connection.html ; v86 networking — https://github.com/copy/v86/blob/master/docs/networking.md
- RU: Хабр (Слёрм), основы Ansible inventory — https://habr.com/ru/companies/slurm/articles/786700/ ; Хабр, роли Ansible и особенности check mode — https://habr.com/ru/articles/746864/ (источник к B1-12); второй русскоязычный источник к `changed_when` подбирается отдельно, до этого утверждения B1-5 о `changed_when` держатся на документации и эталонном прогоне; книга: Хохштейн, Мозер, «Запускаем Ansible» (ДМК Пресс — перевод «Ansible: Up and Running»).

---

## 5. Блок B2. Terraform и OpenTofu

### 5.1. Главные решения

**Учебное облако Edu Cloud и провайдер `edu`.** Ученик работает против учебного облака в браузере: у него есть API (с задержками, квотами, ошибками 429), консоль (страница со списком ресурсов, где их можно менять руками — так создаётся дрейф) и провайдер `edu`. Ресурсы подобраны так, чтобы переход к Yandex Cloud, Hetzner, AWS или тенанту Cozystack в B3 был прямым.

| Ресурс | Атрибуты (F — пересоздание при изменении, U — изменение на месте, C — вычисляется облаком) |
|---|---|
| `edu_network` | `name` (U), `id` (C) |
| `edu_subnet` | `network_id` (F), `cidr` (F), `availability_zone` (F), `id` (C) |
| `edu_security_group` | `network_id` (F), `ingress {port, protocol, cidr}` (U), `egress` (U) |
| `edu_vm` | `name` (U), `availability_zone` (F), `image_id` (F), `cores` (U, требует остановки: `allow_stopping_for_update`), `memory_gb` (U, то же), `subnet_id` (F), `security_group_ids` (U), `ssh_key` (F), `labels` (U), `id`, `private_ip`, `public_ip` (C) |
| `edu_disk` | `size_gb` (U, только рост; уменьшение — F), `type` (F) |
| `edu_dns_record` | `zone` (F, DNS-зона), `name` (F), `type` (F), `ttl` (U), `value` (U) |
| `edu_bucket` | `name` (F, глобально уникально — учебная ошибка «name already taken»), `versioning` (U) |
| data `edu_image` | `family` → `id` |

Документацию провайдера `edu` пишем сами в анатомии страницы Registry (Example Usage / Argument Reference / Attributes Reference / Import): на ней учится ступень 2 лестницы, и у неё нет лицензионных ограничений.

**Движок tfsim: Go → WebAssembly на настоящем HCL, в узком объёме заданий.** Писать свой разбор HCL на TypeScript — учить диалекту, поэтому tfsim собран на `hashicorp/hcl/v2` (разбор, диагностики с диапазонами строк, вычисление выражений), `zclconf/go-cty` (типы, неизвестные значения, библиотека функций) и `hclwrite` (настоящий `fmt`). Ядро сверх библиотек ограничено тем, что используют задания курса: локальные модули, `variable`/`locals`/`output`/`data`, `count`, `for_each`, `depends_on`, `lifecycle` (`create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`), блоки `import`, `moved`, `removed`, `check`, `precondition`; граф и обход с параллелизмом 10, refresh, diff, план с неизвестными значениями, `-replace`, `-refresh-only`, `-refresh=false`, `-target`, `-generate-config-out`, `state list/show/mv/rm/pull`, `workspace` (list/new/select). Каждое упражнение курса прогоняется в CI на настоящем OpenTofu с провайдером-заглушкой того же API (9.2): это и проверка, и второй источник поведения. Бюджет — ≤ 2,5 МБ gzip (09, 1.3); если не помещаемся, сборка `-ldflags="-s -w"` + `wasm-opt -Oz`, затем TinyGo. Размер измеряется в спайке фазы 0.

**Спайк «форк OpenTofu вместо tfsim» (3 дня, фаза 0).** Собрать OpenTofu (MPL-2.0) под `GOOS=js GOARCH=wasm` с провайдером `edu`, вкомпилированным в процесс (как встроенный провайдер `terraform`), с отключённым поиском плагинов, заглушёнными `os/exec` и файловыми блокировками; замерить размер и время `plan` на 10 ресурсах. Правило решения: если ≤ 2,5 МБ gzip и `plan` ≤ 1 с — движком становится форк, а tfsim не пишется; если больше — tfsim в описанном узком объёме, форк остаётся эталоном в CI. Ожидаемый результат — второй вариант (у OpenTofu много платформенного кода и бэкендов), но проверка дешевле, чем молчаливо переписывать ядро.

**Форматы — настоящие.** State — `terraform.tfstate` формата version 4 (`resources[].instances[].attributes`, `serial`, `lineage`). `show -json plan.out` — формат плана из документации (`format_version`, `resource_changes[].change.actions`, `before`, `after`, `after_unknown`, `action_reason`). На этом JSON строятся цели `plan_expect` и визуализации. Человекочитаемый вывод повторяет OpenTofu/Terraform 1.x: `+ create`, `~ update in-place`, `- destroy`, `-/+ destroy and then create replacement`, `+/- create replacement and then destroy`, `<= read (data resources)`, `# forces replacement`, `Plan: 2 to add, 1 to change, 0 to destroy.`, `Note: Objects have changed outside of Terraform`, `Warning: Resource targeting is in effect`.

**Terraform и OpenTofu.** `terraform` и `tofu` в Стенде — одна команда. Уроки называют OpenTofu открытым форком Terraform после смены лицензии Terraform в 2023 году и показывают, что понятия курса одинаковы. Различия, которые курс называет, но не изучает: в OpenTofu с версии 1.7 есть шифрование state и плана на стороне клиента (блок `encryption`) и `for_each` у провайдеров; в Terraform — ephemeral-ресурсы и `terraform test`. Документация лестницы — opentofu.org/docs (MPL-2.0); developer.hashicorp.com — ссылкой.

### 5.2. Уровни и дополнительный пул проверки

| Уровень | Что это значит для Terraform (01, 4.3) |
|---|---|
| L0 | Знает из блока сетей сеть, подсеть, IP, DNS; облачную ВМ заказывал руками на втором этапе Kubernetes (K31); Terraform не видел |
| L1 | Запускал `plan`/`apply` на готовом коде; не понимает state, дрейф, пересоздание, `count`/`for_each`. Сюда же — программист, который понимает декларативность в общем, но не модель «код — state — реальность» |
| L2 | Писал небольшие конфигурации; не работал с удалённым state, модулями, импортом и рефакторингом |

Пул (`key: false`):
1. *(L1, П)* Сеть, подсеть `10.0.1.0/24`, VM в ней, `output` с публичным IP. Цели: `tf.plan` — 3 create; после `apply` `tofu output public_ip` непустой.
2. *(L1, Т)* Прочитать план: сколько ресурсов пересоздаётся и почему? Ответ: 1, `image_id` с `# forces replacement`.
3. *(L1, П)* «`cores` VM изменили в консоли. Что покажет `plan` и как вернуть желаемое?» Цели: `plan` показывает дрейф и update; после `apply` значение из кода.
4. *(L2, П, `key: false`, отдаётся в 01 как кандидат в ключевые)* «Три VM через `count` по `["a","b","c"]`. Удалите `b` так, чтобы `c` не пересоздалась.» Цель: `plan_expect: { destroy: ['edu_vm.this["b"]'], create: [], update: [] }` после перехода на `for_each` с `moved`; `fail` на `-target`.
5. *(L2, П)* «`edu_bucket.assets` создан вручную. Возьмите его под управление без пересоздания.» Цель: блок `import` или `tofu import`, затем `plan` — No changes.
6. *(L2, О)* «Два инженера одновременно делают `apply` с локальным state. Что сломается и как это исправляют?» Рубрика: запись state одного затирает другого; ресурс есть в облаке, нет в state; удалённый backend; блокировка.

### 5.3. Программа

| Модуль | Тезис главы | Содержание | L0 | L1 | L2 |
|---|---|---|---|---|---|
| B2-1. Облако и его API | Каждая кнопка консоли — запрос к API, и его можно сделать кодом | ресурс, консоль, API, почему кликать опасно (не воспроизводимо, не ревьюится) (I03) | полностью | кратко | кратко |
| B2-2. Первый код | Код описывает ресурсы и связи между ними, а не шаги | провайдер, `resource`, атрибуты, ссылки `edu_subnet.main.id`, `init`, `fmt`, `validate` (I04); карточка «две разные zone» | полностью | полностью | кратко |
| B2-3. План и применение | Terraform сначала говорит, что сделает, и делает только после подтверждения | `plan`, `apply`, чтение плана, `destroy` (I05) | полностью | полностью | полностью |
| B2-4. Три правды | Terraform знает об облаке только то, что записано в state, и каждый `plan` сравнивает три версии мира | код, state, облако; вычисляемые атрибуты; `state list/show`; refresh (I06) | полностью | полностью | полностью |
| B2-5. Изменить и пересоздать | Одни атрибуты облако меняет на месте, другие — только заменой ресурса | update in-place и replacement, `forces replacement`, `create_before_destroy`, `prevent_destroy` (I19) | полностью | полностью | полностью |
| B2-6. Граф | Порядок создания следует из ссылок, а не из порядка строк | неявные зависимости, `depends_on`, параллельность, порядок удаления (I18) | полностью | полностью | полностью |
| B2-7. Параметры и модули | Один и тот же код описывает разные окружения | `variable` (типы, `default`, `validation`, `sensitive`), `tfvars`, `output`, `locals`, `data`, локальный модуль (I07) | полностью | полностью | полностью |
| B2-8. Дрейф | Изменение руками не исчезает, оно ждёт следующего `plan` | ручные изменения, `plan -refresh-only`, `ignore_changes` (I08) | полностью | полностью | полностью |
| B2-9. Много однотипного | Адрес экземпляра решает, что Terraform считает «тем же» ресурсом | `count` и `for_each`, сдвиг индексов, `moved` (I20) | основы `count` | полностью | полностью |
| B2-10. Командная работа | State общий, а значит его хранят в одном месте и блокируют | бакет (I26), удалённый state, блокировка, секреты в state, `.gitignore` для `.terraform/` и `*.tfstate`; OpenTofu `encryption` для L2 | обзорно | полностью | полностью |
| B2-11. Чужие ресурсы и рефакторинг | Переименовать или забрать ресурс можно, не трогая облако | `import`, `state mv/rm`, `moved`, `removed` (I21) | — | полностью | полностью |
| B2-12. Terraform и Ansible вместе | Terraform создаёт машины, Ansible их настраивает; связывает их вывод одного и вход другого | `output -json` → инвентарь Ansible (I13) | обзорно | полностью | полностью |
| B2-13. Terraform в CI | План — артефакт MR, `apply` — ручная джоба из main | `fmt -check`, `validate`, `plan -out` в MR с планом в комментарии, `apply` вручную (I27) | — | полностью | полностью |
| B2-14. Три исполнителя сверки | Ansible, Terraform и контроллер Kubernetes решают одну задачу; отличаются тем, кто и когда запускает сравнение | объяснение E-REC (I22) | полностью | полностью | полностью |

### 5.4. План учебника, объяснение E-TF и интерактивы

**B2-4. Три правды.** Тезис: Terraform знает об облаке только то, что записано в state, и каждый `plan` — сравнение трёх версий мира.
1. Облако хранит ресурсы и знает о них всё, но не знает, что они «ваши» (опирается на B2-1).
2. Код описывает, какими ресурсы должны быть, но не знает, какие есть.
3. State — файл, где Terraform записал связь «адрес в коде ↔ ID в облаке» и последние известные атрибуты (опирается на B2-3).
4. Атрибуты, которые знает только облако (`id`, `public_ip`), до первого `apply` показаны как `(known after apply)`.
5. `plan` сначала обновляет state по облаку (refresh), затем сравнивает код с обновлённым state.
6. Отсюда три вида расхождения: нет в state — `+`; есть, но иначе — `~` или `-/+`; есть в state, нет в коде — `-`.
7. Потеря state не трогает облако, но отнимает у Terraform память; поэтому state хранят удалённо и блокируют (`forward: [I26]`, B2-10).
8. В state лежат значения атрибутов, включая секреты: доступ к нему — как к паролям.
Проверка понимания: `predict` «что покажет `plan` после удаления state».

**E-TF «`terraform plan` и `apply`: код, state, облако».** Три колонки: **Код** (`--c-code`), **State** (`--c-state`), **Облако API** (`--c-cloud`); внизу строка фаз `read → parse → graph → refresh → diff → plan → confirm → apply → write state`, текущая фаза подсвечена. Объяснение заменяет прежнюю сцену прокрутки B2-I7 и работает над кодом ученика.

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. Разбор и граф | Файлы `.tf` → граф ресурсов; параллельные ветки подсвечены | Добавить или удалить ссылку между ресурсами | «цикл» → `Error: Cycle: edu_vm.a, edu_vm.b` красным | Граф перестраивается: «порядок задают ссылки, а не строки» |
| 2. Refresh | Из State к API идут стрелки `GET /v1/vms/vm-7`, ответы возвращаются; у расходящегося атрибута метка drift | Дрейф в облаке вкл/выкл (`cores` изменён в консоли); `-refresh=false` | «state удалён» → refresh пуст | На линии State ↔ Облако появляется `Note: Objects have changed outside of Terraform`; при `-refresh=false` — «дрейф не виден, план врёт» |
| 3. Diff | У каждого ресурса значок `+ ~ - -/+`, на линии подпись причины (`image_id changed → forces replacement`) | Изменяемый атрибут: `name` / `availability_zone` / `image_id` / `size_gb` ↓ / `cores` | — | Символ пересчитывается сразу; рядом — почему этот атрибут нельзя изменить на месте |
| 4. План и подтверждение | Итог `Plan: X to add, Y to change, Z to destroy` | `create_before_destroy` вкл/выкл | — | Порядок `-/+` ↔ `+/-` и счётчик «простой VM: 40 с ↔ 0 с» |
| 5. Apply | Вызовы `POST/PATCH/DELETE` к API в порядке графа; узлы загораются; `serial` в state растёт после каждого ресурса | `-parallelism` 1–10 | «квота API исчерпана на 3-м ресурсе» (429) → apply останавливается | «State пишется после каждого ресурса: после сбоя в нём два из пяти, и следующий `plan` продолжит с этого места» |
| 6. Итоговый state | `serial` +1, `lineage` прежний | Локальный / удалённый state с блокировкой | «второй apply без блокировки» → потерянная запись | С блокировкой второй получает `Error acquiring the state lock` с ID блокировки |
| 7. `-target` | Подсвечены цель и всё, от чего она зависит; остальное серое | Цель: `edu_vm.web` / `edu_dns_record.web` | — | `Warning: Resource targeting is in effect`; «сеть и подсеть создадутся как зависимости, DNS-запись — нет, поэтому следующий обычный `plan` не пуст» |

**B2-I1. «Три правды».** Рабочее место к E-TF: те же три колонки, но ученик сам набирает команды. Линии соответствия по адресам и ID; клик по атрибуту показывает происхождение (задан в коде, вычислен облаком, известен после apply); кнопка «потерять state» в учебном режиме.

**B2-I2. «Граф зависимостей».** DAG из `tofu graph`, ручная раскладка по уровням графа; при `apply` узлы загораются по мере создания, при `destroy` — в обратном порядке; `depends_on` дорисовывает ребро.

**B2-I3. «Читаем план».** Настоящий вывод плана с подсветкой; наведение на строку объясняет её. Режим тренировки: ученик до применения отвечает, сколько создастся, изменится, пересоздастся и будет ли простой VM.

**B2-I4. «Консоль облака».** Страница Edu Cloud: VM, сети, бакеты, кнопки «Изменить», «Удалить», «Создать». Всё, что ученик делает здесь, следующий `plan` видит. В сценариях ручное изменение приходит строкой журнала консоли: «14:02 через консоль изменён `size_gb` диска `disk-db` (источник: console, пользователь `ops-2`)».

**B2-I5. «Сдвиг индексов».** `count = length(var.names)`: адреса `[0] [1] [2]`. Удаление имени из середины показывает, как адреса съезжают и план хочет изменить или пересоздать соседнюю VM. Переключатель на `for_each = toset(var.names)` — адреса `["a"] ["b"] ["c"]`; затем блок `moved` для перехода без пересоздания.

**B2-I6. «Блокировка».** Две панели терминала: ученик и второй сеанс `ops-2`. Локальный state: второй `apply` перезаписывает state первого — ресурс есть в облаке, нет в state. Удалённый backend с блокировкой: второй получает `Error acquiring the state lock`, ждёт; пояснение, почему `force-unlock` — крайняя мера.

### 5.5. E-REC «Четыре исполнителя сверки» (мост к циклу сверки Kubernetes, R10)

Ученик уже видел цикл сверки в блоке Kubernetes (K03, 05, 6.2): желаемое слева, фактическое справа, контроллер в середине сравнивает и исправляет всегда. B2-14 показывает, что Ansible и Terraform решают ту же задачу, но иначе, — и это лучший ответ на вопрос собеседования «чем Terraform отличается от Kubernetes».

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. Одна схема — четыре раза | Четыре одинаковые колонки «желаемое ← сравнение → фактическое»: Ansible (плейбук ↔ хосты), Terraform (`.tf` + state ↔ облако), контроллер Kubernetes (YAML в etcd ↔ поды), Argo CD (Git ↔ объекты кластера). Подписи на линиях: «запуск человеком или CI → сравнить → изменить → уйти»; «plan: сравнить код со state и облаком → apply по подтверждению → записать state → уйти»; «watch → сравнить → изменить → снова watch»; «poll Git → сравнить → sync → снова poll» | — | — | Клик по колонке открывает карточку исполнителя: кто запускает, где хранит желаемое, где фактическое |
| 2. Ручное изменение | Ползунок «время» 0–60 мин; в минуту 20 кто-то меняет фактическое во всех четырёх колонках | — | — | Ansible и Terraform остаются в дрейфе до следующего запуска (счётчик «минут в дрейфе» растёт), контроллер и Argo CD исправляют за секунды |
| 3. Как сделать цикл из запуска | — | Переключатели «Ansible по расписанию каждые 15 мин», «`plan` в CI каждый час с алертом на дрейф» | — | Дрейф сокращается до интервала запуска: «вечный цикл — свойство исполнителя, а не языка описания» |
| 4. Что ломается | — | — | «удалить state» (Terraform теряет знание о фактическом); «удалить объект в etcd» (контроллеру нечего сравнивать, и он удаляет поды); «уронить SSH» (Ansible не может даже посмотреть); «Git недоступен» (Argo CD держит последнее известное) | В блоке «Почему» — где у каждого исполнителя хранится желаемое и что значит его потеря |
| 5. Свой маленький контроллер | Редактор с функцией `reconcile(desired, actual)` на 20 строк и кнопка «запустить цикл каждые 5 с» над API Edu Cloud (тот же изолированный Worker, что крошечный контроллер блока Kubernetes, 05, 6.2) | Интервал цикла 1–30 с | «ручное удаление VM в консоли» → цикл создаёт её снова | «Вы написали контроллер для облака: так устроены Crossplane и операторы — тот же цикл, что у Deployment, для своего вида ресурсов» (связь с пет-проектом 8 «оператор на Go») |

Проверка: `explain` «Почему Argo CD называют контроллером, а Terraform — нет?». Рубрика: постоянное наблюдение; сравнение с фактическим; исправление без запуска человеком. Цель экрана 5: после ручного удаления VM в консоли она снова есть через ≤ 2 интервала цикла, и цикл не создаёт дублей (`keep`: число VM с меткой `managed-by=learner` равно желаемому).

### 5.6. Тренажёры

| ID | Задание | Цели |
|---|---|---|
| B2-D1 | 15 карточек «какой символ будет у изменения»: `name` VM — `~`; `availability_zone` — `-/+`; уменьшили диск — `-/+`; добавили метку — `~`; удалили ресурс из кода — `-` | выбор; ступень 2 — вырезка страницы `edu_vm` |
| B2-D2 | Сеть + подсеть + группа безопасности (22, 80) + VM + DNS-запись на её IP | `plan_expect` 5 create; после apply запись указывает на `public_ip` |
| B2-D3 | Вынести захардкоженные значения в переменные с `validation` (cores ∈ {2,4,8}) | `validate`; `plan -var cores=3` падает с сообщением валидации |
| B2-D4 | Дрейф: принять изменение (`ignore_changes` или правка кода) или откатить | `plan` — No changes; `explain` выбора |
| B2-D5 | Смена образа VM без простоя | `create_before_destroy`, в плане `+/-` |
| B2-D6 | `count` → `for_each` без пересоздания | итоговый план — No changes (через `moved`) |
| B2-D7 | Импорт ручного бакета | `plan` — No changes, бакет в state |
| B2-D8 | Переименовать `edu_vm.web` → `edu_vm.frontend` без пересоздания | `moved` или `state mv`, план — No changes |
| B2-D9 | Вынести VM в модуль `modules/vm`, вызвать дважды | `plan_expect` адреса `module.web.edu_vm.this`, `module.api.edu_vm.this` |
| B2-D10 | «Сделано через `apply -target=edu_vm.web`, всё прошло. Что из конфигурации не создано и почему следующий обычный `plan` не пустой?» | ответ: `edu_dns_record.web` и всё, что не связано с VM ссылками; сеть и подсеть созданы как зависимости. Цель: `plan_expect` после `-target` содержит `create: [edu_dns_record.web, …]`; неверный вариант «сеть не создана» — `misconception: iac.target-skips-dependencies`. Во всех последующих экзаменах — цель-запрет на `-target` |
| B2-D11 | Найти секрет в state: `sensitive` скрывает значение в выводе, но не шифрует state | ответ + перенос state в удалённый backend с ограниченным доступом; L2 — вторая часть: как это решает OpenTofu (`encryption`) и Terraform (шифрование бакета и доступ к нему) |
| B2-D12 | Задачи ступени 4 из 0.5 (`-generate-config-out`, `-replace`, `removed`) | по эффекту + поле «где нашёл» |
| B2-L1…L15 | `validate`/`fmt`: незакрытая скобка, ссылка на несуществующий ресурс, неверный тип переменной, `count` и `for_each` вместе, цикл | `validate` без ошибок, `fmt -check` чистый |

### 5.7. Практический экзамен B2 (самопроверка, `envs: [sim]`)

«Окружение для приложения», 90 минут, `doc_ladder: { step: 5, allowed: [opentofu.org/docs, developer.hashicorp.com/terraform, edu-provider-docs] }`.

| Задача | Вес | Карточка | Проверки |
|---|---|---|---|
| t1 | 25 | Переменные `env` и `web_count`; модуль `vm`; сеть, две подсети в разных `availability_zone`, группа безопасности, `web_count` VM через `for_each`, VM базы с `prevent_destroy`, DNS-записи web-VM, удалённый state в бакете с блокировкой | `critical`: `tf.state` содержит ожидаемые адреса; `fmt -check`, `validate` |
| t2 | 15 | `output` с IP в формате инвентаря Ansible | вывод `output -json` разбирается как инвентарь |
| t3 | 20 | Увеличить `web_count` с 2 до 3; сменить образ web-VM без простоя | `plan_expect`: ровно +1 VM +1 DNS; `+/-` у web-VM |
| t4 | 10 (вариант из сида) | Дрейф, внесённый консолью во время экзамена; бакет, созданный руками; переименование ресурса; задача ступени 5 (`check {}` или `precondition`) | цели варианта; итоговый `plan` — No changes |
| explain | 30 | «Почему `destroy` базы был отклонён и как удалить её, когда это действительно нужно?»; «Что будет, если два инженера применят ваш код одновременно?» | рубрика: `prevent_destroy`; снять в коде через ревью; блокировка state; удалённое хранение |

`critical`: `destroy` VM базы отклоняется `prevent_destroy`. Цели-запреты: `-target`, секреты в `.tf`. `pass: { critical: all, total_min: 70 }`.

### 5.8. Источники B2

- EN: OpenTofu docs — https://opentofu.org/docs/ ; OpenTofu state encryption — https://opentofu.org/docs/language/state/encryption/ ; Terraform language — https://developer.hashicorp.com/terraform/language ; state — https://developer.hashicorp.com/terraform/language/state ; JSON output format — https://developer.hashicorp.com/terraform/internals/json-format ; resource targeting (`-target`) — https://developer.hashicorp.com/terraform/cli/commands/plan#resource-targeting ; resource drift tutorial — https://developer.hashicorp.com/terraform/tutorials/state/resource-drift ; refactoring with `moved` — https://developer.hashicorp.com/terraform/language/modules/develop/refactoring ; import blocks — https://developer.hashicorp.com/terraform/language/import ; HCL — https://github.com/hashicorp/hcl ; go-cty — https://github.com/zclconf/go-cty ; Kubernetes controllers — https://kubernetes.io/docs/concepts/architecture/controller/ ; Crossplane concepts — https://docs.crossplane.io/latest/concepts/
- RU: Yandex Cloud, начало работы с Terraform — https://yandex.cloud/ru/docs/terraform/quickstart ; Yandex Cloud, блокировка state — https://yandex.cloud/ru/docs/terraform/tutorials/terraform-state-lock ; Yandex Cloud, модули — https://yandex.cloud/ru/docs/terraform/tutorials/terraform-modules ; книга: Брикман, «Terraform: инфраструктура на уровне кода» (Питер — перевод «Terraform: Up & Running»). Yandex Cloud документирует практический для RU-аудитории факт: реестр HashiCorp недоступен с российских адресов, нужно зеркало провайдеров; B3 и пет-проекты RU-версии учитывают это при `init`.

---

## 6. Блок B3. Кластер Kubernetes из кода (третий этап Kubernetes, R12)

### 6.1. Место, уровни, среда

Третий этап Kubernetes по R12 — полная установка kubeadm на 3+ ВМ: control plane, присоединение рабочих узлов, CNI (Cilium), хранилище, сертификаты, обновление версии, резервная копия и восстановление etcd, «сломай и почини» узла; ВМ заказывает Terraform, настраивает Ansible. Этапы 1 (симулятор и гибридный кластер) и 2 (k3s на одной ВМ или трёх, треки R1 и R2 документа 05) проходят в блоке Kubernetes, где ученик заказывает ВМ руками командами `hcloud`/`yc` или кнопкой тенанта. Этап 3 (треки R3 и R4 документа 05) открывается здесь, после B1 и B2: Kubernetes-содержание (kubeadm, PKI, etcd, обновление) остаётся за 05, а этот документ даёт инфраструктуру из кода, роли Ansible, проверку, стоимость и уборку. В графе 01 у K32 добавляются предпосылки I05 и I10.

Тренажёр на этом этапе ничего не исполняет: он ведёт по шагам, показывает стоимость и проверяет результат агентом `trainer-check` (09, 5.4). Это ярус C: `envs: [vm]`, результат подписывается (`attest`), если ученик работает в нашем тенанте или проходит трек как предъявляемый. Уровни: этап обязателен для всех (01 §3.3); L0 — по полному чеклисту с готовыми ролями, которые ученик читает, запускает и дописывает в отмеченных местах (поддержка S0–S1); L1 — по каркасу (даны структура каталогов, имена ролей и переменных, пустые файлы задач); L2 — с нуля, дан только `providers.yaml`. Время — 6–8 часов с перерывами; набор ВМ можно уничтожать между занятиями, потому что всё восстанавливается кодом.

### 6.2. Программа

| Шаг | Тезис | Что делает ученик |
|---|---|---|
| 0. Выбор и стоимость | Перед `apply` известно, сколько это стоит и сколько будет стоить, если забыть | Выбирает провайдера; тренажёр считает по `providers.yaml` (05, 10.2): `ВМ × цена_в_час × часы + IPv4 × часы`, крупно — «если забыть на месяц». Цифры берутся из той же таблицы, что в 05 и 09, и в уроке не пишутся |
| 1. Узлы кодом (Terraform) | Узел кластера — модуль с ролью на входе и адресами на выходе | `modules/k8s-node` (вход: `name`, `role` = control-plane / worker, `size`; выход: `private_ip`, `public_ip`), корневой модуль с `for_each = { cp-1 = "control-plane", worker-1 = "worker", worker-2 = "worker" }`, ВМ 2 vCPU / 4 ГБ, частная сеть, группа безопасности (ниже), метка `trainer=devops` на всех ресурсах, `output "inventory"` в формате YAML-инвентаря Ansible с группами `control_plane` и `workers`. State — в бакете облака с блокировкой; для тенанта — backend `kubernetes` (Secret с lease-блокировкой) |
| 2. Подготовка узлов (Ansible) | Узел готов к kubeadm, когда ядро, рантайм и пакеты настроены одинаково на всех | Роль `k8s_prereq`: swap off и удаление из `/etc/fstab`; модули `overlay` и `br_netfilter` в `/etc/modules-load.d/`; `net.ipv4.ip_forward=1` через `ansible.posix.sysctl`. Роль `containerd`: `SystemdCgroup = true` в `config.toml`, handler restart. Роль `kube_packages`: репозиторий `pkgs.k8s.io/core:/stable:/v1.36/deb/`, `kubeadm`, `kubelet`, `kubectl` с закреплённой версией и удержанием (`ansible.builtin.dpkg_selections: hold`). Второй прогон `changed=0` |
| 3. Первый раз руками | kubeadm надо один раз увидеть без автоматизации, иначе роль — заклинание | По чеклисту 05 (трек R3): `kubeadm init --config` на `cp-1`, установка Cilium, `kubeadm join` на рабочих узлах. Ученик записывает, какие файлы появились (`/etc/kubernetes/admin.conf`, `/etc/kubernetes/kubelet.conf`, `/etc/kubernetes/pki/`) — это станут условия `creates` |
| 4. Кластер из кода | То, что сделано руками один раз, превращается в роль и проверяется пересозданием с нуля | Роль `kubeadm_init` на `cp-1`: `kubeadm init --config` из шаблона с `creates: /etc/kubernetes/admin.conf` — главный урок идемпотентности для «команды без модуля» (B1-5 на настоящих машинах). Роль `kubeadm_join`: команда присоединения через `kubeadm token create --print-join-command` с `delegate_to: cp-1` и `run_once`, затем join с `creates: /etc/kubernetes/kubelet.conf`. Cilium через `helm upgrade --install` с той же защитой. Затем `tofu destroy` → `tofu apply` → `ansible-playbook site.yml` — кластер поднимается без ручных шагов |
| 5. Эксплуатация (содержание 05) | — | Хранилище (local-path или CSI провайдера), сертификаты (`kubeadm certs check-expiration`), `etcdctl snapshot save/restore`, «сломай и почини» узла (агент вносит поломку). Обновление v1.36 → v1.37 (трек R4) — плейбук с `serial: 1`: `kubectl drain` с `delegate_to: cp-1`, обновление пакетов, `kubeadm upgrade node`, `uncordon`. Здесь `serial` из B1-12 перестаёт быть учебным |
| 6. Проверка | — | `trainer-check run --track b3-iac --nonce …` (6.4) |
| 7. Уборка (обязательно) | — | 6.5 |

**Группа безопасности.** Между узлами: 6443/tcp (API), 2379–2380/tcp (etcd, только на control plane), 10250/tcp (kubelet), 10257/tcp и 10259/tcp (controller-manager и scheduler, только на control plane), 4240/tcp (проверка здоровья Cilium), 8472/udp (VXLAN Cilium). Снаружи — 22/tcp и 6443/tcp только с адреса ученика (переменная `admin_cidr`, `validation` запрещает `0.0.0.0/0`).

**Провайдеры.**

| Вариант | Провайдер | Особенности |
|---|---|---|
| Наш тенант Cozystack | `kubernetes` (ресурс `kubernetes_manifest` с ВМ Cozystack на KubeVirt) в квоте тенанта ученика; kubeconfig с правами только на пространство тенанта выдаёт брокер `dt-api` | Вид и `apiVersion` ресурса ВМ сверяются с текущей версией Cozystack перед публикацией, до проверки раздел `hold: true`. Входящих публичных адресов нет (09, 5.3): Ansible ходит через бастион (`ansible_ssh_common_args: '-o ProxyJump=dt-<id>@bastion.<домен>'`), `kubectl` — с `cp-1` через веб-терминал или туннель `ssh -J … -L 6443:localhost:6443` |
| Hetzner Cloud | `hetznercloud/hcloud` | `hcloud_network`, `hcloud_firewall`, метка `trainer=devops` |
| Yandex Cloud | `yandex-cloud/yandex` через зеркало провайдеров | `labels = { trainer = "devops" }` |
| Selectel, Timeweb Cloud, VK Cloud | провайдеры этих облаков из их документации | конфигурация модуля `k8s-node` отличается только ресурсами ВМ и сети; варианты публикуются после эталонного прогона |

Список провайдеров и цены — `providers.yaml` из 05, 10.2 и 09, 5.2; в этом документе своего списка нет.

### 6.3. Объяснение E-K8S-CODE «От `tofu apply` до трёх узлов Ready»

Слева колонка «код» (`--c-code`: `infra/`, `site.yml`, роли), в центре три ВМ (`--c-cloud`, затем `--c-node`), справа control plane (`--c-cp`). Движутся только индикаторы готовности на каждой ВМ и стрелки вызовов.

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. ВМ из кода | `tofu apply` → три карточки ВМ с адресами; `output "inventory"` стрелкой уходит в инвентарь Ansible | Число рабочих узлов 1–4; тариф | — | Счётчик стоимости в час и «за месяц, если забыть» пересчитывается сразу |
| 2. Подготовка | На каждой ВМ загораются чек-боксы «swap off», «модули ядра», «sysctl», «containerd», «пакеты»; стрелки ssh от управляющей машины | `forks` 1–3 | «забыть `br_netfilter`» → на шаге 4 поды Cilium не доходят до Ready, подпись «трафик моста не проходит через netfilter» | Сетка идемпотентности второго прогона — все зелёные |
| 3. `kubeadm init` | На `cp-1` появляются `/etc/kubernetes/pki/`, статические поды apiserver, etcd, controller-manager, scheduler | — | «swap не выключен» → `[ERROR Swap]` preflight | Карточка: какие файлы создаёт init и почему это `creates` для роли |
| 4. CNI | Поды Cilium на каждом узле; между узлами туннель VXLAN 8472/udp с подписью | — | «закрыть 8472/udp в группе безопасности» → поды на разных узлах не видят друг друга | Связь с сетевой частью 05 (R9): под на одном узле → VXLAN → под на другом |
| 5. Join | Рабочие узлы получают команду присоединения стрелкой `delegate_to: cp-1`, затем `NotReady → Ready` | — | «токен истёк» → `couldn't validate the identity of the API Server` | `run_once` подписан на стрелке: токен создаётся один раз на весь плей |
| 6. Пересоздание | `destroy` гасит всё, `apply` + плейбук поднимают снова; таймер «от нуля до Ready» | — | — | «Кластер, который нельзя пересоздать кодом, — питомец; этот — нет» |
| 7. Обновление | Узлы по одному: drain → пакеты → `kubeadm upgrade` → uncordon | `serial` 1 / all | `serial: all` → все узлы в drain одновременно, приложение недоступно | Счётчик «готовых реплик приложения» не падает ниже 2 только при `serial: 1` |

### 6.4. Проверка

`trainer-check run --track b3-iac --nonce …` (09, 5.4). Агент собирает факты: `k8s` (узлы, поды `kube-system`), `tf` (ученик рядом кладёт вывод `tofu show -json`, агент читает файл), `ansible` (агент сам выполняет `ansible-playbook site.yml --check` с `ANSIBLE_STDOUT_CALLBACK=json` на управляющей машине ученика), `files` (`/etc/kubernetes/pki/*.crt` — срок действия).

```yaml
goals:
  - { id: nodes, envs: [vm], needs: [k8s], when: "k8s.nodes#=3 && k8s.objects[kind=Node][status.conditions[type=Ready].status=True]#=3" }
  - { id: same-version, envs: [vm], when: "k8s.nodes[*].kubelet=@first(k8s.nodes).kubelet" }
  - { id: cilium, envs: [vm], when: "k8s.objects[kind=Pod][metadata.labels.k8s-app=cilium][status.phase=Running]#=3" }
  - { id: idempotent, envs: [vm], needs: [ansible], when: "ansible.runs[-1].hosts[*].changed=0" }
  - { id: labelled, envs: [vm], needs: [tf], when: "tf.state.resources[addr~'k8s_node'][attrs.labels.trainer!=devops]#=0" }
  - { id: no-changes, envs: [vm], needs: [tf], when: "tf.plan.resource_changes[actions!=no-op]#=0" }
  - id: etcd-restore
    envs: [vm]
    probe: { script: probes/etcd-restore-marker.sh, expect_exit: 0, timeout: 120s }   # действие нужно: проверяется, что ConfigMap-маркер пережил restore
```

### 6.5. Обязательная уборка

Трек не засчитан, пока не выполнены три вещи: `tofu destroy`; `tofu state list` пуст; вывод `hcloud server list -l trainer=devops -o json` или `yc compute instance list --filter 'labels.trainer="devops"' --format json` пуст (тренажёр принимает вставленный JSON). В тенанте ВМ удаляются сами через 8 часов (09, 5.3), но `destroy` всё равно обязателен: он входит в навык. Через сутки после начала трека тренажёр напоминает о незакрытой уборке при следующем входе (05, 10.5).

---

## 7. Блок C. Мониторинг: метрики, логи, трейсы, Prometheus, Grafana

### 7.1. Главные решения

**Учебная система «Shop».** Все упражнения смотрят на одну вымышленную систему, чтобы ученик привык к её нормальному виду и замечал отклонения: `frontend` (2 экземпляра), `api` (3), `worker` (1), `postgres` (1), узлы `node-1..3`. Каждый сервис отдаёт метрики, логи и трейсы.

| Метрика | Тип | Метки |
|---|---|---|
| `http_requests_total` | counter | `job`, `instance`, `method`, `route`, `code` |
| `http_request_duration_seconds_bucket/_sum/_count` | histogram, `le` = `"0.005"` … `"10.0"`, `"+Inf"` | `job`, `instance`, `route` |
| `db_connections_in_use`, `db_connections_max` | gauge | `job`, `instance`, `pool` |
| `db_query_duration_seconds_*` | histogram | `query` |
| `worker_queue_length` | gauge | `queue` |
| `process_resident_memory_bytes`, `process_start_time_seconds`, `go_gc_duration_seconds` | gauge, summary | `job`, `instance` |
| `node_cpu_seconds_total` | counter | `instance`, `cpu`, `mode` |
| `node_memory_MemAvailable_bytes`, `node_memory_MemTotal_bytes` | gauge | `instance` |
| `node_filesystem_avail_bytes`, `node_filesystem_size_bytes` | gauge | `instance`, `mountpoint`, `fstype` |
| `node_network_receive_bytes_total` | counter | `instance`, `device` |
| `up`, `scrape_duration_seconds` | синтетические Prometheus | `job`, `instance` |
| `app_build_info` | gauge = 1 | `version`, `commit` |

**Генератор метрик — детерминированная функция времени.** Значение ряда в момент `t` — `f(seriesId, t, seed, incidents)`: дневная сезонность, шум из сидированного генератора, рост счётчиков как интеграл скорости, сброс при перезапуске процесса. Инциденты — YAML-сценарии, которые меняют скорости и распределения на интервале. Хранить данные не нужно: движок запрашивает сэмплы на сетке scrape-интервала для любого диапазона. Тот же генератор отвечает на `curl http://api-1:8080/metrics` текстом в формате экспозиции (`# HELP`, `# TYPE`, строки сэмплов): метрика — просто строка текста по HTTP. Значения меток `le` и `quantile` генератор выдаёт в нормализованном виде Prometheus 3 (`"1.0"`, а не `"1"`).

В режиме C16 генератор получает второй источник — состояние kube-lite (7.10): ряды `kube_*` строятся из объектов кластера, ряды `container_*` — из модели cgroup каждого контейнера. В гибридном кластере (05, R11) ряды `container_*` берутся из настоящих `/sys/fs/cgroup` узлов v86 через область фактов `cgroups` служебного агента (09, 1.4).

```yaml
# content/blocks/monitoring/incidents/db-pool.yaml
id: db-pool-exhaustion
seed: 4711
window: { start: "-3h", end: "now" }
events:
  - at: "-55m"
    deploy: { job: api, version: "2.3.1", commit: "9f3c2ab" }   # меняет app_build_info, пишет аннотацию
  - at: "-52m"
    effect:
      - series: 'db_query_duration_seconds{query="get_cart_items"}'
        calls_per_request: { route: "/checkout", from: 1, to: 38 }   # N+1 запрос
      - series: 'db_connections_in_use{pool="main"}'
        saturate_to: db_connections_max
      - series: 'http_request_duration_seconds{route="/checkout"}'
        shift_quantiles: { p50: 0.4, p99: 4.8 }
      - series: 'http_requests_total{route="/checkout",code="503"}'
        rate_per_sec: 0.6
    logs:
      - { service: api, level: error, line: 'pool exhausted: timeout acquiring connection after 2s route=/checkout', rate_per_min: 30 }
    traces:
      - { route: /checkout, pattern: n_plus_one }   # трейс с 38 одинаковыми спанами db
root_cause: { kind: deploy, version: "2.3.1", component: api, mechanism: "N+1 query in get_cart_items" }
fix: { action: rollback, to_version: "2.3.0" }
```

**Движок PromQL — свой на TypeScript, поверх официальной грамматики, с семантикой Prometheus 3.x и проверкой на тестах Prometheus.** Готового движка PromQL для браузера нет: в JavaScript существуют только парсеры (`@prometheus-io/lezer-promql`, на котором работает веб-интерфейс Prometheus, и `@prometheus-io/codemirror-promql`), а вычислители (Prometheus, Thanos promql-engine, Mimir) — на Go и на сервере. Сборку движка Prometheus в wasm я отклоняю: модуль в разы больше бюджета, сборка под `GOOS=js` не подтверждена (у TSDB есть платформенный код), и главное — нам нужны промежуточные результаты каждого узла дерева для объяснения, а их проще отдать из своего вычислителя.

- Версия семантики закреплена: `prometheus_version` в `content/versions.yaml` (ветка 3.x), тесты `promqltest` берутся с того же тега. Селекторы диапазона открыты слева: сэмпл ровно на левой границе окна не входит, поэтому при scrape 15 с окно `[1m]`, выровненное по сэмплам, содержит 4 сэмпла, а не 5.
- Разбор — `@prometheus-io/lezer-promql` (те же сообщения об ошибках синтаксиса); редактор — CodeMirror 6 с `@prometheus-io/codemirror-promql`, автодополнение по метаданным генератора.
- Вычисление — свой обходчик дерева: instant и range-запросы с шагом, все четыре матчера, range vectors, `offset`, `@`, подзапросы; функции `rate`, `irate`, `increase`, `delta`, `idelta`, `deriv`, `predict_linear`, `*_over_time`, `histogram_quantile` (классические гистограммы), `abs`, `ceil`, `floor`, `round`, `clamp_min/max`, `time`, `timestamp`, `vector`, `scalar`, `absent`, `absent_over_time`, `changes`, `resets`, `label_replace`, `label_join`, `sort`, `sort_desc`; агрегации `sum`, `avg`, `min`, `max`, `count`, `count_values`, `group`, `stddev`, `topk`, `bottomk`, `quantile` с `by`/`without`; бинарные операторы с `on`/`ignoring`/`group_left`/`group_right`, сравнения с `bool`, `and`/`or`/`unless`; lookback 5 минут; экстраполяция в `rate`/`increase` как в закреплённой версии.
- Корректность — тесты `promqltest` (`functions.test`, `aggregators.test`, `operators.test`, `histograms.test` без нативных гистограмм, `subquery.test`, `at_modifier.test`, `staleness.test`) в CI продукта против нашего движка; непройденный тест — дефект движка. Нативные гистограммы в курс не входят.
- Объяснение — каждый узел дерева возвращает свой вектор; вкладка «Разбор» показывает дерево запроса с результатом каждого узла.

**Grafana — не встраивается, а повторяется её модель.** Конструктор дашбордов использует модель панели Grafana (`timeseries`, `stat`, `gauge`, `bargauge`, `table`, `heatmap`; `targets[].expr`, `legendFormat`, `fieldConfig.defaults.unit`, `thresholds`, `gridPos`; `templating.list` с `label_values(...)`) и экспортирует **настоящий JSON дашборда**, который ученик импортирует в Grafana в пет-проекте 6. Графики рисует uPlot; внешне панели узнаваемы, но без бренда Grafana.

**Логи и трейсы — ради связи трёх сигналов.** Просмотр логов в стиле Loki с подмножеством LogQL: `{service="api", level="error"}`, `|=`, `!=`, `|~`, `| logfmt`, `| json`, фильтр по меткам, `count_over_time`, `rate`, `sum by`. Трейсы — водопад спанов одного запроса, поиск по сервису, маршруту и длительности; переход от точки графика к трейсу (exemplar) и от спана к логам по `trace_id`. Путь трейса от кода до хранилища — OpenTelemetry (C14b). Эксплуатацию Loki и Tempo курс не учит.

**Конфигурация Prometheus и Alertmanager — настоящие файлы.** `prometheus.yml` (`global.scrape_interval`, `scrape_configs`, `static_configs`, `relabel_configs` в объёме `keep`/`drop`/`replace`/`labelmap`, `kubernetes_sd_configs` в C16), файлы правил (`record` или `alert`, `expr`, `for`, `keep_firing_for`, `labels`, `annotations` с `{{ $labels.instance }}`, `{{ $value }}`), файлы юнит-тестов правил для `promtool test rules` и `alertmanager.yml` (`route` с `group_by`, `group_wait`, `group_interval`, `repeat_interval`, вложенные `routes` с `matchers`, `receivers`, `inhibit_rules`). Страница **Targets** показывает таргеты ученика со статусом и причиной (`connection refused`, `context deadline exceeded`, `server returned HTTP status 404`).

### 7.2. Уровни и дополнительный пул проверки

| Уровень | Что это значит для мониторинга (01, 4.3) |
|---|---|
| L0 | Не видел дашбордов; знает процессы, память и диск (Linux), HTTP и коды ответа (сети), контейнеры и поды |
| L1 | Смотрел готовые дашборды Grafana, знает слово «метрика»; копировал запросы. Сюда же — программист, который добавлял метрики в код клиентской библиотекой, но не проектировал алерты |
| L2 | Настраивал алерты или писал простые запросы PromQL, либо работал с Zabbix; не знает SLO, burn rate, кардинальности как эксплуатационной проблемы |

Пул (`key: false`; запросы проверяются `promql_equiv`, 7.6):
1. *(L1, П)* «Сколько экземпляров `api` сейчас недоступны?» Эталон: `count(up{job="api"} == 0) or vector(0)`, правило `empty_equals_zero: true` — принимается и `sum(1 - up{job="api"})`. Понятия O04, O17.
2. *(L1, П)* «Запросов в секунду к `api` за 5 минут по маршрутам.» Эталон: `sum by (route) (rate(http_requests_total{job="api"}[5m]))`. Понятия O16, O17.
3. *(L1, Т)* «Почему `http_requests_total` нельзя выводить на график как есть?» Верно: счётчик только растёт и сбрасывается при перезапуске, на графике нужна скорость. `misconception: mon.counter-is-current-value`.
4. *(L2, П)* «Алерт `up == 0` без `for` будит дежурного от каждого пропущенного scrape. Исправьте.» Цели: `for` ≥ 1m; на данных с одиночным пропуском алерт не перешёл в firing. Понятие O21.
5. *(L2, П)* «p99 латентности `/checkout` по всем экземплярам вместе.» Эталон: `histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{route="/checkout"}[5m])))`; `forbid_pattern: avg(histogram_quantile`. Понятие O19.
6. *(L2, П)* «Свободное место на диске закончится в ближайшие 4 часа — алерт.» Эталон: `predict_linear(node_filesystem_avail_bytes{fstype!="tmpfs"}[6h], 4*3600) < 0`.
7. *(L2, Т, число)* «SLO 99,9% за 30 дней: бюджет ошибок в минутах полного простоя? При каком burn rate бюджет закончится за 2 дня?» Ответы: 43,2 минуты; 15.

### 7.3. Программа

| Модуль | Тезис главы | Содержание | L0 | L1 | L2 |
|---|---|---|---|---|---|
| C1. Зачем мониторинг | Мониторинг нужен, чтобы узнать о проблеме раньше клиента и понять её причину | метрики, логи, трейсы — на какой вопрос отвечает каждый (O01) | полностью | кратко | кратко |
| C2. Временной ряд | Метрика — имя и набор меток; каждая уникальная комбинация меток — отдельный ряд | имя, метки, сэмплы (O02), кардинальность (O15) | полностью | полностью | полностью |
| C3. Типы метрик | Тип метрики решает, какие вопросы к ней можно задать | counter, gauge, histogram, summary; сброс счётчика (O03) | полностью | полностью | полностью |
| C4. Как Prometheus собирает | Prometheus сам ходит к сервисам по расписанию и спрашивает их | pull-модель, `/metrics`, `prometheus.yml`, таргеты, `up` (O04); экспортёры node_exporter, blackbox_exporter, экспортёр БД (O05); Pushgateway — только для пакетных задач | полностью | полностью | кратко |
| C5. PromQL: выбрать | Запрос начинается с выбора рядов по имени и меткам | instant vector, селекторы, четыре матчера (O06), `offset` | полностью | полностью | кратко |
| C6. PromQL: скорость | Счётчик читают через скорость его роста за окно | range vector, `rate`, `increase`, `irate`, окно ≥ 4 scrape-интервалов (O16) | полностью | полностью | полностью |
| C7. Агрегировать и сравнивать | Агрегация выбрасывает метки, сопоставление склеивает ряды по оставшимся | `sum by`, `without`, `topk` (O17); арифметика векторов, `on`/`ignoring`, `group_left` для `app_build_info` (O18) | основы | полностью | полностью |
| C8. Гистограммы | Квантиль считают из суммы бакетов, а не усредняют готовые квантили | бакеты, `le`, `histogram_quantile` (O19) | обзорно | полностью | полностью |
| C9. Что мерить | Для сервиса меряют то, что чувствует пользователь, для ресурса — насколько он занят | RED, USE, четыре золотых сигнала (O10) | полностью | полностью | полностью |
| C10. Дашборды | Дашборд идёт от общего к частному, единицы и пороги — часть смысла | панель, запрос, единицы, пороги, переменные (O07) | полностью | полностью | полностью |
| C11. Алерты | Алерт будит человека, поэтому он стоит на симптоме и терпит короткий всплеск | правило (O08), `for`, pending/firing (O21), аннотации; Alertmanager: маршрут, группировка, тишина, подавление (O22) | полностью | полностью | полностью |
| C12. Recording rules | Дорогой запрос считают заранее и хранят как новый ряд | зачем, именование `level:metric:operations` (O20) | — | полностью | полностью |
| C13. Инцидент | Каждое утверждение о причине подтверждается запросом | сценарий 7.7 | полностью | полностью | полностью |
| C14. Логи и трейсы | Метрика говорит «что», лог — «что именно», трейс — «где» | LogQL-подмножество (O11), водопад трейса, переход метрика → трейс → лог | обзорно | полностью | полностью |
| C14b. OpenTelemetry | Один стандарт передачи для трёх сигналов от кода до любого хранилища | SDK → OTLP → Collector (receivers, processors, exporters) → Prometheus, Tempo, Loki; объяснение E-OTEL (O12) | — | обзорно | полностью |
| C15. SLO | Надёжность задают числом и тратят как бюджет | SLI, SLO, бюджет ошибок (O09), многоокновой burn rate алерт (O23) | — | обзорно | полностью |
| C16. Kubernetes как источник метрик | Метрики контейнера — это файлы cgroup, которые вы уже читали, а цели Prometheus находит через те же EndpointSlice, что Service | раздел 7.10 (O25, O24, O13) | обзорно | полностью | полностью |
| C17. Zabbix и агентная модель | Та же задача, другая модель: агент на хосте, шаблоны и триггеры | агент, активные и пассивные проверки, шаблоны, триггеры; сравнение с Prometheus: кто к кому ходит, где хранятся данные, как задаются пороги (O14) | обзорно | один урок | один урок |

### 7.4. План учебника, объяснения E-MON и E-OTEL

**C2. Временной ряд.** Тезис: метрика — не число, а множество рядов, по одному на каждую комбинацию меток.
1. Сервис считает события в памяти — например, число запросов (опирается на L17).
2. У счётчика есть имя и метки: метод, маршрут, код ответа.
3. Каждая уникальная комбинация меток — отдельный ряд со своей лентой сэмплов «время — значение».
4. Prometheus хранит ряды, а не «метрику целиком»: число рядов — главный расход памяти.
5. Метка с неограниченными значениями (`user_id`) умножает число рядов на число пользователей — это кардинальность.
6. Правило: метка описывает измерение, по которому вы будете группировать, а не каждый объект.
Проверка понимания: C-I1 с ползунком «добавить метку `user_id`».

**C6. Скорость.** Тезис: счётчик показывает, сколько всего было; на графике нужна скорость его роста.
1. Сырое значение счётчика растёт с запуска процесса и падает в 0 при перезапуске (опирается на C3).
2. Range vector — сэмплы ряда за окно `[5m]`, а не одно значение (опирается на C5).
3. `rate` — средняя скорость роста за окно в секунду; сброс счётчика она учитывает.
4. `increase` — прирост за окно, то есть `rate` × длина окна; из-за экстраполяции он не целый.
5. `irate` смотрит на две последние точки окна и дёргается — для быстрых графиков, не для алертов.
6. Если в окне меньше двух сэмплов, результата нет; поэтому окно берут не меньше четырёх интервалов scrape.
7. В Prometheus 3 окно открыто слева: сэмпл ровно на его левой границе не входит.
Проверка понимания: C-I6 с выбором окна и предсказанием «будет ли результат».

**C11. Алерты.** Тезис: алерт будит человека, поэтому он должен говорить о том, что чувствует пользователь, и не реагировать на одиночный всплеск.
1. Правило алерта — запрос PromQL с условием; Prometheus вычисляет его по расписанию (опирается на C6, C7).
2. Пока условие выполняется меньше `for`, алерт в состоянии pending; дольше — firing.
3. Prometheus не отправляет уведомлений сам: он передаёт алерты в Alertmanager.
4. Alertmanager выбирает получателя по меткам алерта, объединяет похожие алерты в одно сообщение и не повторяет его чаще `repeat_interval`.
5. Подавление гасит следствия при причине: при `NodeDown` не нужны алерты всех сервисов этого узла.
6. Алерт ставят на симптом (доля ошибок, латентность), а не на причину (CPU 80%): причин много, симптом один.
Проверка понимания: C-D8 «алерт-шум».

**E-MON «От счётчика в коде до сообщения дежурному».** Блоки слева направо: `процесс api (counter в памяти)` (`--c-user`) → `/metrics` → `Prometheus scrape` → `TSDB` (`--c-store`, форма «бочка») → `вычисление правил` → `Alertmanager` → `получатель (pager / чат)`. Подписи на линиях: `HTTP GET /metrics каждые 15s`, `append sample (t, v)`, `eval every 1m`, `POST /api/v2/alerts`, `group_wait 30s`, `webhook`. Под схемой — формула «время от поломки до сообщения = scrape + eval + for + group_wait» с текущими значениями.

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение при изменении |
|---|---|---|---|---|
| 1. Счётчик | Число в процессе растёт с каждым запросом-точкой | Нагрузка, запросов/с | «процесс перезапущен» → счётчик в 0 | — |
| 2. Scrape | Prometheus делает GET, текст экспозиции раскрывается в строки; точка уезжает в TSDB | `scrape_interval` 5 / 15 / 60 с; `scrape_timeout` | «таргет недоступен» → `up=0`, причина `connection refused` | Лента сэмплов реже или чаще |
| 3. TSDB | Сэмпл с меткой времени scrape дописывается в ряд | Метка `user_id` вкл/выкл | — | Счётчик рядов и шкала памяти: «+N тысяч рядов» |
| 4. PromQL | Окно `rate(x[w])` скользит по ленте, рядом линия результата | Окно `w` 30 с – 15 мин | «окно меньше двух сэмплов» → пусто | «В окне 1 сэмпл — скорость не вычислить»; при 60 с и `[1m]` результат пропадает |
| 5. Правило | Шкала inactive → pending → firing | `for` 0 / 1 / 5 / 10 мин; порог | «одиночный пропуск scrape» | Без `for` алерт загорается на всплеске — видно на шкале |
| 6. Alertmanager | Алерт падает в дерево маршрутов, подсвечивается путь по `matchers`, `group_by` собирает алерты в одно сообщение | `group_wait`, `group_interval`, `repeat_interval`, `group_by` | «нет маршрута для severity» → default receiver; «inhibit_rules выключены» → 12 сообщений вместо одного | Счётчик «сообщений дежурному за ночь» пересчитывается сразу |
| 7. Уведомление | Сообщение в получатель и, после устранения, resolved | `send_resolved` вкл/выкл | «Alertmanager остановлен» → правило firing, сообщения нет | «Кто следит за следящим: постоянно горящий алерт Watchdog и внешняя проверка, что он приходит» |

Источник шагов — `prom.scrape`, `prom.rule`, `am.notify`. Клик по любому блоку открывает его страницу в учебном Prometheus или Alertmanager.

**E-OTEL «Путь трейса».** Схема: `код (SDK)` → `OTLP` → `Collector: receivers → processors → exporters` → три хранилища (`--c-metric`, `--c-log`, `--c-trace`). Движутся спаны одного запроса; на экране 2 они собираются в водопад.

| Экран | На экране | Параметры | «Сломай» | Пояснение |
|---|---|---|---|---|
| 1. Спан | Вызов функции открывает и закрывает спан; `trace_id` переходит в следующий сервис в заголовке `traceparent` | — | «заголовок не передан» → трейс распадается на два | «Связь сервисов держится на одном заголовке» |
| 2. Водопад | Спаны трёх сервисов складываются в водопад по времени | — | — | Клик по спану — его атрибуты и логи по `trace_id` |
| 3. Collector | Батчи уходят в Collector по OTLP, процессор семплирования отбрасывает часть | Семплирование 100% / 10% / tail-based «только ошибки» | «Collector недоступен» → счётчик потерянных спанов растёт | Счётчик сохранённых и потерянных трейсов пересчитывается сразу |
| 4. Хранилища | Экспортёры отправляют метрики в Prometheus, трейсы в Tempo, логи в Loki | — | — | «Код один раз, хранилища меняются в конфиге Collector» |

### 7.5. Интерактивы

**C-I1. «Анатомия временного ряда».** Строка `http_requests_total{job="api",instance="api-1:8080",route="/cart",code="200"} 18342` разбирается на имя, метки, значение; справа лента сэмплов. Ползунок «добавить метку `user_id`» умножает число рядов, счётчик рядов и шкала памяти Prometheus показывают кардинальность.

**C-I2. «Четыре типа».** Четыре живых графика: counter (ступенька вниз при перезапуске), gauge (`db_connections_in_use`), histogram (кумулятивность `le` — вложенными прямоугольниками), summary (готовые квантили, которые нельзя сложить между экземплярами). Кнопка «перезапустить api-2» сбрасывает счётчик; `rate` это переживает, сырое значение — нет.

**C-I4. «Targets».** Редактор `prometheus.yml` и страница Targets. Поломки: опечатка в порту, неверный `metrics_path`, таргет за межсетевым экраном (правило nftables на узле — связь с N17), слишком короткий `scrape_timeout`. Ученик чинит и видит, как `up` переходит в 1.

**C-I5. Верстак PromQL.** Главный интерактив блока.
- *Редактор* с автодополнением имён метрик, меток и значений; ошибки синтаксиса на месте.
- *Таблица и График*: instant-результат с метками; range-результат с выбором диапазона и шага.
- *Разбор*: дерево запроса; у каждого узла тип результата, число рядов, первые строки, оставшиеся после агрегации метки. Клик по узлу подсвечивает часть запроса. Для `rate(x[5m])` узел range vector показывает окно на графике сырых сэмплов (левая граница — открытая), узел `rate` — линию результата; ползунок времени двигает окно.
- *Сопоставление*: левый и правый векторы колонками, линии между рядами с совпавшими метками, ряды без пары серые. Объясняет `on`, `ignoring`, `group_left` и `many-to-many matching not allowed`.
- Кнопка «Объясни» передаёт запрос, дерево и промежуточные результаты нейросети ученика.

**C-I6. «Окно rate».** Сырые сэмплы счётчика точками, окно `[1m]`, `[5m]`, `[15m]`, линии `rate`, `irate`, `increase`. Если в окне меньше двух сэмплов, результата нет — причина подписана. Переключатель «Prometheus 2 / 3» показывает, как левая граница окна меняет число сэмплов.

**C-I7. «Квантиль из бакетов».** Столбики кумулятивных бакетов, линия на уровне 0,99 × count, точка пересечения и линейная интерполяция внутри бакета. Переключение границ бакетов показывает, что точность квантиля определяется бакетами.

**C-I8. Конструктор дашборда.** Сетка 24 колонки (`gridPos`); панель: тип, запрос (верстак встроен), `legendFormat`, единицы (`reqps`, `s`, `percentunit`, `bytes`), пороги; переменные `$job`, `$instance` из `label_values(up, job)`; экспорт JSON для Grafana.

**C-I9. «Дерево маршрутов».** Рабочее место к экрану 6 E-MON: `alertmanager.yml` слева, дерево маршрутов справа; алерт с метками падает в дерево и подсвечивает путь до получателя; `inhibit_rules` гасят `ServiceDown` при `NodeDown` на том же узле. `amtool config routes test --config.file=alertmanager.yml severity=critical team=payments` в терминале даёт тот же результат.

### 7.6. Логика проверки запросов `promql_equiv`

Сравнивать текст запросов нельзя: одну величину выражают по-разному. Проверка выполняет запрос ученика и эталон на **K = 5 наборах данных**: разные сиды и моменты времени и обязательно краевые случаи — сброс счётчика, исчезнувший ряд, новый экземпляр, ряд с нулевыми значениями. Результаты совпадают, если совпадает множество наборов меток (с нормализацией по правилу задания: `labels: exact`, `labels: superset` или `labels: by [route]`) и значения совпадают с относительной погрешностью 1e-6 (для range-запросов — по каждой точке шага). Правило `empty_equals_zero: true` считает пустой результат равным вектору из нуля — для заданий, где «ничего нет» и «ноль» значат одно. Задание может требовать или запрещать узлы дерева: `require: [rate]`, `forbid: [irate]`, `forbid_pattern: avg(histogram_quantile`. При несовпадении ученик получает различие: «у эталона 4 ряда с меткой route, у вас 12 — вы не агрегировали по instance»; «на наборе со сбросом счётчика ваш результат отрицательный — используйте rate вместо delta».

```yaml
id: c7-d3
kind: promql
level: [L1, L2]
task:
  ru: "Какая доля запросов к каждому маршруту api заканчивается ошибкой 5xx (за 5 минут)?"
  en: "What share of requests to each api route ends in a 5xx error (over 5 minutes)?"
reference: >
  sum by (route) (rate(http_requests_total{job="api",code=~"5.."}[5m]))
  / sum by (route) (rate(http_requests_total{job="api"}[5m]))
goals:
  - id: g-equiv
    eval:
      promql_equiv: { datasets: [seed:1, seed:2, reset:api-2, new-instance, zero-errors], labels: { by: [route] }, tolerance: 1e-6, require: [rate] }
    fail:
      - if: "result.labels~instance"
        say: { ru: "В ответе есть метка instance: доля считается по маршруту для всех экземпляров вместе, агрегируйте by (route).", en: "Your result keeps the instance label: aggregate by (route)." }
        term: O17
```

### 7.7. Инцидентный сценарий C13 «Почему выросла латентность»

Сценарий — практика, а не викторина: каждое утверждение ученика опирается на запрос, результат которого показывает доказательство.

1. **Вызов.** Карточка алерта `HighLatencyP99` с аннотациями `service=api`, `p99 > 1s for 10m`, ссылкой на дашборд. Тональный сигнал пейджера выключен по умолчанию. Данные — за 3 часа.
2. **Обзорный дашборд.** RED по сервисам: у `api` выросли длительность и доля 5xx, трафик обычный. Ученик отмечает изменения (клик по панели → «отметить как наблюдение»).
3. **Гипотезы.** Панель гипотез: свободный текст или типовые (нагрузка выросла; один экземпляр болен; зависимость тормозит; релиз; ресурсы узла). Каждая гипотеза закрывается доказательством.
4. **Сужение.** Верстак рядом с дашбордом. Ожидаемые шаги: латентность по `route` — растёт только `/checkout`; по `instance` — все одинаково; трафик не вырос; `db_connections_in_use / db_connections_max` = 1; `app_build_info` и аннотация деплоя — версия 2.3.1 выкачена за 3 минуты до роста. Прикреплённый к гипотезе запрос проверяется предикатом на его результате («у `/checkout` значение ≥ 3× медианы остальных маршрутов»; «отношение пула ≥ 0,95»).
5. **Трейс и лог.** Exemplar из графика `/checkout` → трейс: 38 одинаковых спанов `SELECT ... FROM cart_items`. Из спана — логи по `trace_id`: `pool exhausted: timeout acquiring connection`. Ученик формулирует механизм: новый релиз делает запрос к БД на каждый товар корзины (N+1), пул соединений заканчивается, запросы ждут.
6. **Действие.** Страница окружений (A-I5): Re-deploy версии 2.3.0. Через несколько модельных минут латентность возвращается, алерт уходит в resolved; ученик подтверждает это запросом.
7. **Постмортем.** Шаблон: хронология (собирается из отметок ученика), влияние (доля ошибочных запросов за период — запрос `increase`), время восстановления после неудачного развёртывания (M13), причина, что сработало и что нет, действия (тест на число запросов к БД в CI, алерт на насыщение пула, canary из A5b). Линзы ролей: та же хронология с точки зрения дежурного SRE, автора релиза и руководителя продукта; пояснение, почему в постмортеме нет виноватого (M12).

Оценка — обратная связь: время до первой верной гипотезы, число проверенных неверных, все ли утверждения подтверждены запросами, сделан ли откат до долгого расследования (первый приоритет — восстановить сервис). Для экзаменов и повторной практики есть ещё пять вариантов с той же отправной точкой, вариант выбирается сидом:
- один экземпляр на перегруженном узле (виден `instance`, CPU узла и троттлинг контейнера);
- утечка памяти с перезапусками (сбросы счётчиков, `process_start_time_seconds`, `changes()`, `OOMKilled` в C16);
- заканчивается диск на узле БД (`node_filesystem_avail_bytes`, ошибки записи в логах);
- медленная внешняя зависимость (спан внешнего вызова; латентность растёт на всех маршрутах, использующих платёжный API);
- **«504 на входе»** (связь с R9 и 05): Gateway отвечает 504, потому что у Service пустой EndpointSlice — readiness падает после релиза, а NetworkPolicy из того же релиза режет трафик от контроллера Gateway к подам. Доказательства: `kube_endpoint_address{ready="true"}` (или ряд EndpointSlice) = 0 для `api`, рост 5xx на уровне Gateway при нуле запросов на уровне `api`, `up` таргетов `api` отсутствует, а не равен 0. Цепочка разбора DNS → Service → EndpointSlice → под → NetworkPolicy та же, что в сетевой части блока Kubernetes, только по метрикам.

### 7.8. Тренажёры

| ID | Задание | Цели |
|---|---|---|
| C-D1 | Разметка строки экспозиции: имя, метки, значение; 10 строк, включая `_bucket{le="+Inf"}` и карточку `le="1.0"` против `le="1"` (Prometheus 3 нормализует, запрос с `le="1"` ничего не найдёт) | выбор |
| C-D2 | «Какой тип у метрики?» — 12 описаний | выбор |
| C-D3 | Почините `prometheus.yml`, чтобы все таргеты стали UP | `prom.targets[*].health=up`; `promtool check config` чистый |
| C-D4 | 25 запросов возрастающей сложности: метка, regex-матчер, `rate`, сумма по маршрутам, топ-3 маршрута по ошибкам, доля 5xx, CPU узла в процентах (`1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))`), память, диск, версия сервиса через `group_left` по `app_build_info` | `promql_equiv`; ступень 2 — вырезка `histogram_quantile` |
| C-D5 | «Найдите ошибку в запросе»: `rate(sum(http_requests_total)[5m])`; `sum(rate(x[30s]))` при scrape 1m; `histogram_quantile(0.99, rate(..._bucket[5m]))` без `sum by (le)` при агрегации по instance; деление векторов с разными метками | исправленный запрос — `promql_equiv`; ступень 2 — вырезка `rate` |
| C-D6 | Recording rule для доли ошибок и алерт на него; юнит-тест правила | `promtool check rules`; правило вычисляется; алерт firing на наборе с инцидентом и inactive на спокойном |
| C-D7 | Маршрутизация Alertmanager: critical команды payments — в pager, warning — в чат, остальное — в почту; подавить алерты сервиса при `NodeDown` того же узла | `amtool config routes test` на 8 наборах меток; подавление на сценарии |
| C-D8 | «Алерт-шум»: 6 правил, отметить плохие (на причину вместо симптома, без `for`, порог на сыром счётчике, CPU > 80% без влияния на пользователей) и переписать | выбор + прогон правил на 3 наборах |
| C-D9 | Дашборд RED для `api`: три панели (rate, доля ошибок, p50/p95/p99), переменная `$instance`, правильные единицы | `grafana.dashboards[uid=red-api]`: типы панелей, `unit` ∈ {`reqps`, `percentunit`, `s`}, `expr` каждой панели проходит `promql_equiv`, переменная используется во всех запросах |
| C-D10 | LogQL: ошибки api за час по маршрутам | результат равен эталону |
| C-D11 (L2) | Многоокновой burn rate алерт (1h и 5m при 14,4; 6h и 30m при 6) по SRE Workbook | `promql_equiv`; firing на «быстром сгорании», нет — на «медленном шуме» |
| C-D12…C-D14 | Kubernetes как источник метрик (7.10) | — |
| C-D15 | Zabbix: прочитать триггер `last(/web1/system.cpu.util)>90` и выражение с `avg(...,5m)`; написать эквивалентное правило PromQL | `promql_equiv` эталона `avg_over_time(...)` + `for` |
| C-D16 | Задачи ступени 4 из 0.5 (`label_replace`, `amtool silence add`, `promtool test rules`) | по эффекту + поле «где нашёл» |

### 7.9. Практический экзамен C (самопроверка, `envs: [sim]`)

«Новый сервис `worker` поставлен в Shop без мониторинга», 120 минут, `doc_ladder: { step: 5, allowed: [prometheus.io/docs, grafana.com/docs] }`.

| Задача | Вес | Карточка | Проверки |
|---|---|---|---|
| t1 | 15 | Добавить таргеты `worker` в `prometheus.yml` | `critical`: `prom.targets[job=worker][health=up]#=1` |
| t2 | 20 | Дашборд из четырёх панелей (обработано задач в секунду, ошибки, длина очереди, p95 длительности задачи) с переменной экземпляра | правила C-D9 |
| t3 | 20 | Два алерта — очередь растёт 15 минут подряд, доля ошибок выше 5% 10 минут — и маршрут critical в pager; юнит-тест одного правила (`promtool test rules`, задача ступени 5) | алерты срабатывают на инцидентном наборе и молчат на спокойном (по 3 набора); маршрут по `amtool` |
| t4 | 15 | Запускается неизвестный вариант инцидента (из сида, 7.7): найти причину по своему дашборду и алертам | `critical`: причина названа и подтверждена прикреплённым запросом |
| explain | 30 | «Почему алерт на CPU > 80% не нужен при наличии алерта на долю ошибок?»; «Что вы сделаете, если Alertmanager сам упадёт?» | рубрика: симптом против причины; влияние на пользователя; Watchdog; внешняя проверка |

L2 дополнительно: SLI и SLO для `api`, recording rules и burn rate алерт. `pass: { critical: all, total_min: 70 }`.

### 7.10. C16. Kubernetes как источник метрик (R6, R9)

В режиме C16 генератор берёт ряды из состояния kube-lite: `metrics-server-lite` из 05, 5.2 расширяется до экспортёров `kube-state-metrics-lite` (ряды из объектов) и `cadvisor-lite` (ряды из модели cgroup каждого контейнера на узле). Действия ученика в `kubectl` сразу видны в PromQL; в гибридном кластере ряды `container_*` строятся из настоящих cgroup узлов v86.

Ряды: `kube_pod_status_phase`, `kube_pod_container_status_restarts_total`, `kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}`, `kube_deployment_spec_replicas`, `kube_deployment_status_replicas_available`, `kube_node_status_condition`, `kube_endpoint_address`; `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`, `container_spec_memory_limit_bytes`, `container_oom_events_total`, `container_cpu_cfs_periods_total`, `container_cpu_cfs_throttled_periods_total`.

План главы:
1. **Откуда берутся метрики контейнера** (O24). cgroup пода лежит в `/sys/fs/cgroup/kubepods.slice/…`; файлы `memory.current`, `memory.max`, `memory.events`, `cpu.max`, `cpu.stat` (`nr_periods`, `nr_throttled`) ученик уже читал в блоке Linux на уроке «Как ядро изолирует и ограничивает» (R6, D04) и в лимитах пода (K22). `container_memory_working_set_bytes` — это `memory.current` за вычетом неактивного файлового кэша; `container_spec_memory_limit_bytes` — `memory.max`; `limits.cpu: 200m` — `cpu.max` = `20000 100000`.
2. **Как Prometheus находит поды** (O25). `kubernetes_sd_configs` с ролями `node`, `pod`, `endpointslice`; relabel `__meta_kubernetes_pod_label_app` → `app`; аннотация `prometheus.io/scrape` — договорённость конфигурации, а не встроенная функция. Роль `endpointslice` смотрит в те же EndpointSlice, что Service и kube-proxy (05, сетевая часть, R9): неверный селектор Service даёт пустой EndpointSlice, таргетов нет, и ряд `up` **отсутствует**, а не равен 0.
3. **ServiceMonitor и PodMonitor** как CRD prometheus-operator (O13, требует K30).
4. **Метрики control plane** обзорно: `apiserver_request_total`, `scheduler_pending_pods`.

**E-CG «Откуда берутся метрики контейнера».** Схема по оси 08, 5.3: внизу ядро (`--c-kernel`) с файлами cgroup, над ним процесс контейнера в рамке `--c-ns-cgroup`, справа cadvisor-lite → Prometheus → верстак.

| Экран | На экране и что движется | Параметры | «Сломай» | Пояснение |
|---|---|---|---|---|
| 1. Файл | `memory.current` растёт, рядом шкала-термометр с отметкой `memory.max` (`--c-limit`) | Нагрузка `MEM_MB` у `trainer/hog` | — | «Это тот же файл, что вы читали в Linux» |
| 2. Лимит | Ползунок `limits.memory` в манифесте пода → значение `memory.max` в файле | `limits.memory` 64–512 Mi | «нагрузка выше лимита» → OOM-kill: процесс исчезает, `memory.events oom_kill` +1, под `OOMKilled`, счётчик перезапусков +1 | В верстаке сразу растут `container_oom_events_total` и `kube_pod_container_status_restarts_total` |
| 3. CPU | Полоса периодов по 100 мс; закрашенная часть — квота `cpu.max` | `limits.cpu` 100m–2 | «квота меньше потребности» → периоды с троттлингом красные | Доля троттлинга = `nr_throttled / nr_periods` и тот же запрос PromQL рядом |
| 4. Scrape | cadvisor-lite читает файлы всех контейнеров узла и отдаёт `/metrics` | `scrape_interval` | «узел NotReady» → таргет cadvisor `up=0` | — |

**Тренажёры C16.**

| ID | Задание | Цели |
|---|---|---|
| C-D12 | «Под тормозит, CPU не 100%»: `limits.cpu: 200m` у `trainer/hog`. Запрос доли троттлинга: `sum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m])) / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))`; затем `kubectl exec` и `cat /sys/fs/cgroup/cpu.max` | `promql_equiv` + ответ «`cpu.max` = 20000 100000» |
| C-D13 | «Перезапуски»: алерт `increase(kube_pod_container_status_restarts_total[15m]) > 3`, причина по `last_terminated_reason`; поднять `limits.memory` | `prom.rules[name=PodRestarting].state=inactive` после правки; `keep`: Deployment тот же |
| C-D14 | «Реплик меньше, чем надо»: `kube_deployment_spec_replicas != kube_deployment_status_replicas_available` с `for: 10m`; поломка — `kubectl cordon` двух узлов при `requests` больше свободного | алерт firing во время поломки и resolved после `uncordon` |

### 7.11. Источники C

- EN: data model — https://prometheus.io/docs/concepts/data_model/ ; metric types — https://prometheus.io/docs/concepts/metric_types/ ; exposition formats — https://prometheus.io/docs/instrumenting/exposition_formats/ ; querying basics — https://prometheus.io/docs/prometheus/latest/querying/basics/ ; functions — https://prometheus.io/docs/prometheus/latest/querying/functions/ ; Prometheus 3.0 migration guide — https://prometheus.io/docs/prometheus/3.0/migration/ ; histograms and summaries — https://prometheus.io/docs/practices/histograms/ ; alerting rules — https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/ ; unit testing rules — https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/ ; Alertmanager — https://prometheus.io/docs/alerting/latest/alertmanager/ ; kubernetes_sd_config — https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config ; kube-state-metrics — https://github.com/kubernetes/kube-state-metrics/tree/main/docs ; cgroup v2 — https://docs.kernel.org/admin-guide/cgroup-v2.html ; OpenTelemetry concepts — https://opentelemetry.io/docs/concepts/ ; OpenTelemetry Collector — https://opentelemetry.io/docs/collector/ ; Zabbix manual (items, triggers) — https://www.zabbix.com/documentation/current/en/manual ; PromLabs PromQL cheat sheet — https://promlabs.com/promql-cheat-sheet ; Grafana, «Inside PromQL» — https://grafana.com/blog/2024/10/08/inside-promql-a-closer-look-at-the-mechanics-of-a-prometheus-query ; Grafana dashboard JSON model — https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/ ; Google SRE book, monitoring distributed systems — https://sre.google/sre-book/monitoring-distributed-systems/ ; SRE Workbook, alerting on SLOs — https://sre.google/workbook/alerting-on-slos/ ; USE method — https://www.brendangregg.com/usemethod.html ; RED method — https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/ ; lezer-promql — https://www.npmjs.com/package/@prometheus-io/lezer-promql
- RU: Хабр (OTUS), гистограммы в Prometheus и `histogram_quantile` — https://habr.com/ru/companies/otus/articles/501978/ ; Yandex Cloud, Monitoring и Managed Service for Prometheus — https://yandex.cloud/ru/docs/monitoring/ ; документация Zabbix на русском — https://www.zabbix.com/documentation/current/ru/manual ; книги: Брайан Бразил, «Запускаем Prometheus» (ДМК Пресс — перевод «Prometheus: Up & Running»); Бейер и др., «Site Reliability Engineering. Надёжность и безотказность как в Google» (Питер). Русской документации Prometheus и Grafana нет, поэтому RU-версия урока даёт определения по-русски сама и ссылается на английскую документацию как на первоисточник; книги и статьи на русском — второй источник по правилу двух источников.

---

## 8. Критерии приёмки пет-проектов 5 и 6 и частей A3, A5 итогового экзамена

Пет-проекты и итоговый экзамен принадлежат документу 10 (разделы 6.4 и 10); механику проверки даёт агент `trainer-check` (09, 5.4): `trainer-check pet 5`, `trainer-check pet 6`, `trainer-check capstone`. Этот раздел задаёт только содержательные критерии по блокам этого документа и особенности сред. Отдельного контейнера-проверяльщика нет.

| Где | Критерий | Факты и предикат |
|---|---|---|
| Пет-проект 5, часть A3 | ВМ созданы кодом, state удалённый с блокировкой | `tf.state.resources#>=3`; backend не `local` (агент читает `tofu show -json` и блок `backend` из репозитория); после `plan` — `tf.plan.resource_changes[actions!=no-op]#=0` |
| Пет-проект 5, часть A3 | Один плейбук с ролями приводит чистую ВМ к состоянию проекта 1 или 3; второй прогон ничего не меняет; секреты в vault | агент выполняет `ansible-playbook site.yml --check` с JSON-колбэком: `ansible.runs[-1].hosts[*].changed=0`; в репозитории файлы vault начинаются с `$ANSIBLE_VAULT`; gitleaks чист |
| Пет-проект 5 | Инвентарь получен из `output` Terraform, а не написан руками | в репозитории есть генерация инвентаря из `output -json` (скрипт, `local_file` или динамический инвентарь) — проверка по файлам репозитория |
| Пет-проект 6, часть A5 | Prometheus собирает node_exporter и метрики приложения | `prom.targets[job=node][health=up]#>=1 && prom.targets[job=app][health=up]#>=1` |
| Пет-проект 6, часть A5 | Дашборд с четырьмя золотыми сигналами | `grafana.dashboards[uid=<uid>]` существует; у панелей единицы из списка C-D9; дашборд можно экспортировать из конструктора C-I8 и импортировать |
| Пет-проект 6, часть A5 | Алерты на долю ошибок и заполнение диска с `for:`; алерт приходит в Telegram или почту | `prom.rules[kind=alert][name=HighErrorRate]` и `[name=DiskWillFillIn4Hours]` с `for`; «устроить сбой» — ученик останавливает контейнер приложения или заполняет диск файлом, затем вставляет текст пришедшего алерта с одноразовым кодом из аннотации |
| Пет-проект 1, часть A2 | Выкладка из CI на VPS | критерии 10, раздел 10; содержание — A5b (выкладка по SSH, `resource_group`, откат по тегу) |

**Особенности сред.**

- **Наш тенант Cozystack.** У ВМ нет входящих публичных адресов (09, 5.3), поэтому раннер GitLab регистрируется **на monitoring-ВМ** (`gitlab-runner register`, исполнитель docker): он сам опрашивает gitlab.com, входящий доступ не нужен, выкладка на app-ВМ идёт по частной сети. Это наглядно показывает pull-модель раннера из E-CI. Grafana и Prometheus открываются через веб-терминал тренажёра или `ssh -J dt-<id>@bastion.<домен> -L 3000:localhost:3000 student@monitoring`. Алерт в Telegram — исходящий HTTPS, проходит через NAT кластера.
- **Своё облако ученика.** Правило группы безопасности «3000 и 9090 только с адреса ученика» (переменная `admin_cidr`); снаружи — 22, 80, 443.
- **Провайдеры и цены** — `providers.yaml` (05, 10.2; 09, 5.2); стоимость показывается до `apply` так же, как в B3.
- **Уборка обязательна** — формулировка 6.5: `tofu destroy`, пустой `state list`, пустой список ВМ по метке `trainer=devops`; без неё проект не засчитан.
- **README** — шаблон 10, раздел 10; раздел «что сломалось по дороге и как чинил» — главный для защиты.

---

## 9. Технический стек, размеры, проверка достоверности, риски

### 9.1. Стек

| Задача | Решение | Лицензия | Почему |
|---|---|---|---|
| Git в браузере | `isomorphic-git` + адаптер к VFS Стенда + свой слой команд и reflog (0.3) | MIT | единственная зрелая реализация Git на JS; недостающие команды и reflog — 2–3 недели своей работы, сверяются с настоящим git |
| YAML | `yaml` (eemeli) v2 | ISC | позиции узлов для ошибок, сохранение комментариев, режимы 1.1/1.2 |
| Схема GitLab CI | `ci.json` из репозитория GitLab, ajv (draft-07) | MIT / MIT | та же схема, что в редакторе пайплайнов GitLab |
| Линт GitHub Actions | actionlint → wasm; `github-workflow.json` из SchemaStore | MIT / Apache-2.0 | официально работает в браузере |
| Редактор | CodeMirror 6, `@codemirror/lang-yaml`, свой Lezer-режим HCL, `@prometheus-io/codemirror-promql` | MIT / Apache-2.0 | один редактор на все блоки |
| Схемы и объяснения | примитивы 08: `diagram`, `stepper`, `breakit`, `packets`, `constructor`; ручная раскладка в сетке 8 px | — | стабильные от шага к шагу схемы (08, 3.2) |
| Графики | uPlot | MIT | быстрый на десятках тысяч точек |
| Docker в джобах | dsim и реестр (04) | — | одна модель Docker в курсе |
| Kubernetes в джобах и C16 | kube-lite, `helm-engine.wasm` (05) | — | один Kubernetes в курсе |
| Terraform/OpenTofu | tfsim: Go → wasm, `hashicorp/hcl/v2`, `zclconf/go-cty`, `hclwrite`; спайк форка OpenTofu (5.1) | MPL-2.0 / MIT | настоящий HCL, диагностики и `fmt` |
| Ansible | ansim на TypeScript, nunjucks для шаблонов | — / BSD-2 | ansible-core не работает в wasm |
| Настоящий Ansible | v86 на многоузловом коммутаторе платформы, образ `lab-ansible` | BSD-2 | реальный ansible-core на компьютере ученика |
| PromQL | `@prometheus-io/lezer-promql` + свой вычислитель; тесты `promqltest` закреплённой версии | Apache-2.0 | официальный разбор, проверяемая корректность, промежуточные результаты |
| Фрагменты документации | пакет данных `docs-snippets/` с файлом лицензий по источникам (0.5) | по источникам | ступени 2 и 5 лестницы, офлайн |
| Версии инструментов | `content/versions.yaml`: GitLab и gitlab-runner, Node.js LTS (сейчас 22 и 24), Alpine (3.22), Docker Engine (29.x), Prometheus (3.x), ansible-core, OpenTofu, Helm (4.x), Kubernetes (v1.36/v1.37) | — | логи, профили образов и тесты подставляют версии отсюда; сверка ежеквартально |
| Контент | YAML-схема уроков и упражнений, сборка с проверкой `introduces/uses` по `concepts.yaml` | — | единый формат с движком |

Бюджет загрузки (gzip): оболочка блока ≤ 400 КБ JS; tfsim ≤ 2,5 МБ, при входе в B2; actionlint ≈ 2–3 МБ, при первом открытии GitHub Actions; снимки v86 для лаборатории Ansible ≈ 90–110 МБ zstd, только по явному запуску с предупреждением о размере. Всё кэшируется Service Worker.

### 9.2. Проверка достоверности симуляторов

Если тренажёр ведёт себя не так, как настоящий инструмент, ученик выучит неправду. Поэтому каждое упражнение с эталонным решением автоматически прогоняется и в симуляторе, и в настоящем инструменте закреплённой версии (09, 1.3, «золотые записи»; тяжёлые прогоны — в тенанте курса на воркшоп-кластере), и результаты сравниваются.

| Симулятор | Эталон в CI | Что сравнивается |
|---|---|---|
| Git | настоящий git (версия из `versions.yaml`) на тех же сценариях | хэши деревьев, родители коммитов, вывод `log --oneline --graph`, `reflog`, тексты отказов |
| Пайплайн-движок | `gitlab-ci-local` для GitLab-синтаксиса, `act` для GitHub Actions на учебных проектах; лог — с настоящим gitlab-runner той же версии | порядок и состав джоб на событиях, статусы, строки лога |
| Модели инструментов | настоящие `npm`, `pip`, `go` на тех же фикстурах | строки ошибок |
| ansim | ansible-core в контейнерах (по контейнеру на хост) | состояния ok/changed/failed по задачам, итоговые файлы, RECAP |
| tfsim | OpenTofu с провайдером-заглушкой Edu Cloud (тот же API как HTTP-сервис и тонкий провайдер на terraform-plugin-framework) | JSON плана, итоговый state, тексты диагностик |
| PromQL | тесты `promqltest` того же тега + каждое `reference` упражнений через настоящий Prometheus с данными генератора (`promtool tsdb create-blocks-from openmetrics`) | результаты запросов |
| Alertmanager | настоящий `amtool config routes test` | получатели на наборах меток |

Расхождение блокирует выпуск контента и служит вторым источником по правилу двух источников для поведения инструментов (0.7).

### 9.3. Риски и решения

| Риск | Решение |
|---|---|
| Свой слой Git поверх isomorphic-git расходится с git | эталонный прогон на настоящем git (9.2); переименования при слиянии не используются в упражнениях |
| nunjucks и Jinja2 расходятся | контентный линтер запрещает расходящиеся конструкции; эталонный прогон на ansible-core |
| Модули вне ansible-core в ansim работают, а в лаборатории нет | только FQCN в контенте; коллекции закреплены в снимке `lab-ansible`; эталонный прогон на ansible-core с теми же коллекциями |
| tfsim вырастает в переписанное ядро Terraform | объём ограничен заданиями курса; спайк форка OpenTofu в фазе 0 с правилом решения (5.1) |
| tfsim не помещается в 2,5 МБ | `-ldflags="-s -w"`, `wasm-opt -Oz`, TinyGo; замер в спайке |
| Лаборатория v86 слишком медленная | порог приёмки 90 с на 5 задач и 2 хоста; иначе записанный режим |
| Семантика PromQL меняется между версиями Prometheus | версия закреплена в `versions.yaml`, тесты `promqltest` того же тега |
| Поведение GitLab и Helm меняется между версиями | версии в `versions.yaml`, ежеквартальная сверка со схемой `ci.json` и выводом `helm`; устаревшие флаги (`--atomic`) показываются с пометкой |
| Атаки на цепочку поставок npm | wasm-модули tfsim и actionlint собираем сами из исходников с фиксированными версиями; npm-зависимости — по lock-файлу с проверкой целостности, обновления только через ревью |
| Лицензии фрагментов документации | пакет `docs-snippets/` с атрибуцией; developer.hashicorp.com — только ссылкой (0.5) |
| Ученик воспринимает модели инструментов как настоящие | пометка «смоделировано» в логе; в пет-проектах шаги выполняются по-настоящему |
| Ученик забывает удалить ВМ | стоимость до `apply`, обязательная уборка с проверкой пустого списка, напоминание через сутки (6.5) |
| Своя нейросеть подсказывает решение | режимы `lab` и `lab-docs`, эталон не передаётся в контекст, `exam` — выключена; проверки не зависят от нейросети |

---

## 10. Зависимости от других ролей

- **01 (андрагогика).** Добавить в граф понятия C16–C31, I15–I27, O15–O25 и уточнить формулировки C03, I11, O06, O08 (0.2); добавить ребро K32 → I05, I10 и перенести треки kubeadm на после IaC (0.1); в проверках уровня «CI/CD (с Git)», «IaC», «Мониторинг» пометить ключевыми не меньше двух практических заданий; принять пул этого документа как дополнительные варианты (`key: false`).
- **02 (Linux).** Урок L31 «YAML и JSON» по содержанию 2.7; модуль G-local последним модулем блока; урок «Как ядро изолирует и ограничивает» (R6) с файлами `memory.current`, `memory.max`, `cpu.max`, `cpu.stat`, `memory.events` — на нём стоит C16. Стенд: реестр команд, VFS с правами, несколько машин с `ssh`, пакеты и сервисы машины как структуры данных (для ansim), `nano`/`vi`.
- **03 (сети).** N14 (HTTP), N17 (nftables), N18 (SSH), N19 (балансировка) — до блока CI/CD; межсетевой экран в B1 строится на nftables, а не на ufw.
- **04 (контейнеры).** dsim и реестр для `docker build/push` в джобах; профили образов для джоб CI; сервис `docker:dind`.
- **05 (Kubernetes).** kube-lite и `helm-engine.wasm` исполняют A7; `metrics-server-lite` расширяется до `kube-state-metrics-lite` и `cadvisor-lite` для C16; `argocd-lite` для A-D20; треки R3 и R4 открываются в B3 (после IaC), их Kubernetes-содержание остаётся за 05; зависимость GitOps `linux:git` переименовать в C05 (MR) по графу 01; изолированный Worker «крошечного контроллера» переиспользуется в E-REC, экран 5.
- **07 (методология).** Владелец M13–M17 и DORA; принимает раскадровку «Конвейер» с воротами (без фигуры человека) и вопросы квиза A0 без Git.
- **08 (движок).** Новые типы событий шины (0.6); новые токены `--c-code`, `--c-state`, `--c-cloud`, `--c-store`, `--c-metric`, `--c-log`, `--c-trace` (0.7).
- **09 (платформа).** Области фактов `git`, `ci`, `tf`, `ansible`, `prom`, `am`, `grafana` в `dt.facts/v1` (0.4); режим наставника `lab-docs` и поле `doc_ladder` в контексте (0.5); просмотрщик документации со снимками для ступени 5; образ `lab-ansible` в таблице образов 1.4; спайки фазы 0: tfsim и форк OpenTofu (5.1), скорость лаборатории Ansible (4.1); трек `b3-iac` агента `trainer-check`; kubeconfig тенанта, ограниченный пространством ученика, для провайдера `kubernetes` в B3.
- **10 (оценивание).** Экзамены блоков в формате 6.2; критерии пет-проектов 5 и 6 и частей A3, A5 итогового экзамена — ссылкой на раздел 8 этого документа; вопросы «cache против artifacts», «что такое state и drift», «count против for_each», «идемпотентность», «rate против irate», «почему не усредняют квантили», «чем Terraform отличается от Kubernetes» (E-REC), «504 — что делаете» (вариант C13) — в банк мок-интервью.

---

## 11. Изменения после ревью

Учтены две рецензии: роли Kubernetes (`reviews/06-iac-cicd-monitoring--by-05-kubernetes.md`, далее K) и роли оценивания (`reviews/06-iac-cicd-monitoring--by-10-assessment-career.md`, далее O), а также требования владельца R1–R12. Спорные факты сверены с документацией: переименование флагов в Helm 4 (`--atomic` → `--rollback-on-failure`, `--force` → `--force-replace`, старые имена дают предупреждение) подтверждено страницей Helm 4 overview и миграционными заметками проекта; семантика `-target` (зависимости цели входят в план) — документацией `plan`; открытая слева граница окна и нормализация `le` — руководством по миграции на Prometheus 3.0; принадлежность `authorized_key`, `ufw`, `timezone`, `ipaddr` коллекциям — документацией коллекций Ansible; отсутствие `rebase`, `reset`, `revert`, `cherry-pick`, `reflog`, `diff`, `blame` в isomorphic-git — его справочником API.

### Что изменено

**Каркас и порядок (K1, K2, K3, K8, O1, O6, O14).**
- Маршрут приведён к 01: Git разрезан на G-local (последний модуль Linux) и G-remote (начало блока CI/CD, после N14); YAML — урок L31 блока Linux, содержание передано в 02 (раздел 2.7), в CI/CD остался урок Y-traps (C30). Порядок «Ansible раньше Terraform» обоснован графом (0.1).
- Введены идентификаторы C16–C31, I15–I27, O15–O25 и уточнены C03, I11, O06, O08; `introduces` объявляется у сцены, не больше одного понятия; мелочи — `facet` (0.2).
- Проверки переписаны в контракт 09: `goals[]` с `when`, `keep`, `fail[].say`, `fail[].term`; предложены области фактов `git`, `ci`, `tf`, `ansible`, `prom`, `am`, `grafana` (0.4). Пример `a3-d1` и все экзамены — в этом формате.
- Уровни — L0/L1/L2 по 01; ключевые задания проверок уровня остаются в 01, 4.3, а задания 06 стали дополнительным пулом `key: false` с `misconception` и вариантами; предложено пометить ключевыми не меньше двух практических заданий (0.9). Профиль «программист» описан как L1 по IaC и мониторингу.

**Требования владельца.**
- R1: у каждого модуля тезис главы, у модулей-ядер — план текста из 5–8 утверждений (0.10, 2.3, 3.4, 4.4, 5.4, 7.4) (K15, O17).
- R2: лестница документации — общий раздел 0.5 с анатомией страниц, заданиями ступеней 1–5 для G, A, B1, B2, C, режимом наставника `lab-docs`, просмотрщиком ступени 5, лицензиями фрагментов и линтером; L2 начинает со ступени 3, L1 — со ступени 2 (K4, K19, K20, K30, O2).
- R3, R4: десять процессных объяснений в стиле «чертёж» с параметрами, «сломай», пояснением изменения и перемоткой — E-GIT, E-CI, E-DEPLOY, E-ANS, E-TF, E-REC, E-K8S-CODE, E-MON, E-OTEL, E-CG; новые события шины (0.6). Убраны тушь в схемах механизмов, «человечек», сюжет «Пятничный релиз», бот с именем «Петя»; ручные изменения приходят нейтральной строкой журнала (K5, K29, O3).
- R5: таблица токенов цвета с формами-дублями и новые токены для кода, state, облака, хранилища и трёх сигналов; что берём из Sankofa — журнальная подача, прокрутка, слои, спокойный режим, линзы ролей в постмортеме, QR, двуязычный YAML, `draft`/`hold` (0.7) (K14).
- R6, R9: C16 строит метрики контейнеров из cgroup v2 (`memory.current`, `memory.max`, `cpu.max`, `cpu.stat`) и обнаружение целей через EndpointSlice; тренажёры C-D12…C-D14; вариант инцидента «504 на входе» (7.7, 7.10) (K10, O16).
- R10: мост E-REC — четыре исполнителя сверки и свой маленький контроллер над Edu Cloud (5.5) (K13).
- R11: лаборатория Ansible на многоузловом коммутаторе платформы, DHCP `dnsmasq`, `openssh-server` вместо dropbear, 256 МБ для управляющего узла и 96 МБ для управляемых, бюджет снимков 90–110 МБ, порог скорости спайка, связь с гибридными узлами Kubernetes (4.1) (K11, O12).
- R12: новый блок B3 «Кластер Kubernetes из кода» — Terraform-модуль `k8s-node` с портами kubeadm и Cilium, роли Ansible, ручной первый проход kubeadm, пересоздание кодом, обновление с `serial: 1`, проверки `trainer-check`, стоимость и обязательная уборка; тенант Cozystack через провайдер `kubernetes` (6) (K6, O4).

**Соседние документы (K7, K9, K12, K18, O5, O13, O15).**
- Модуль A0 снят, M13–M17 и DORA — за 07; оставлен мост A-I6 и вопросы с Git; раскадровка «Конвейер» передана в 07 (1).
- A7 исполняется в kube-lite и `helm-engine.wasm`: ServiceAccount с Role вместо cluster-admin, GitLab agent for Kubernetes, неизменяемый тег, `rollout status`, флаги Helm 4, тренажёры A-D17…A-D20; GitOps как понятие — ссылкой на 05 (3.7).
- Добавлен модуль A5b: выкладка по SSH и compose (C13), стратегии выкладки (C14, предпосылка K12), объяснение E-DEPLOY, тренажёры A-D15, A-D16 (3.3, 3.4).
- `docker build/push` в джобах исполняет dsim; у моделей `npm ci`, `pip`, `go build` — закрытый список поведения и эталон в CI (0.3, 9.2).
- Практикум превращён в критерии приёмки пет-проектов 5 и 6 и частей A3, A5 итогового экзамена; проверяет `trainer-check`, отдельный контейнер-проверяльщик удалён; добавлены особенности тенанта: раннер на monitoring-ВМ, доступ через бастион, исходящий Telegram (8).

**Технические исправления.**
- Команды Git разделены на библиотечные и наши; свой слой reflog в формате Git; G-D3 «переименованный файл» заменён конфликтом modify/delete; эталонный прогон на настоящем git (0.3, 2.5, 9.2) (O8).
- tfsim сужен до объёма заданий, бюджет ≤ 2,5 МБ gzip с планом уменьшения, спайк форка OpenTofu с правилом решения (5.1) (K27, O9).
- B2-D10 переписан: `-target` включает зависимости цели, не создаются зависимые от неё и несвязанные ресурсы (5.6) (O10).
- Модули Ansible — полными именами, коллекции закреплены, экран о FQCN; `ipaddr` убран; `ufw` заменён шаблоном nftables, а `community.general.ufw` стал заданием ступени 4 (4.1, 4.6) (O11, K17).
- Движок PromQL закреплён на Prometheus 3.x, `le` нормализован, C-I6 и C6 объясняют открытую левую границу; формулировка «окно меньше двух интервалов» заменена на «в окне меньше двух сэмплов» (7.1, 7.4, 7.5) (K16, O21).
- Термины раньше введения: исполнитель kubernetes и OIDC — через `forward`, «S3» заменено общим хранилищем, бакет введён в B2-10 (I26) (K17).
- Омонимы «индекс / стадия / staging» и «zone» разведены, атрибут переименован в `availability_zone` (0.2, 5.1) (O18).
- Добавлены C14b OpenTelemetry и C17 Zabbix с тренажёром C-D15 (7.3) (O16).
- OpenTofu: шифрование state и различия с Terraform названы, B2-D11 дополнен (5.1, 5.6) (O22).

**Мелкие (K21–K29, O19, O20, O23, O24).** Лестница приоритетов Ansible — 9 ступеней везде. Ошибки `needs` разведены на «более поздняя стадия» и «джоба, исключённая `rules`, без `optional`». `.default` заменён ключевым словом `default:` с ожидаемой ошибкой. Пустой результат — правило `empty_equals_zero` и эталон с `or vector(0)`. Полный синтаксис `promtool query instant` и `amtool config routes test --config.file`. Лог раннера дополнен строками сохранения кэша и очистки. Утверждение про пакет `@cdktf/hcl2json` удалено, осталось правило сборки wasm из исходников. Версии вынесены в `versions.yaml`, матрица — Node 22 и 24. Источник habr 746864 переподписан как check mode (B1-12), к `changed_when` второй русскоязычный источник подбирается отдельно. Задание B1 про приоритет уточнено `hosts: all`; задание G про один коммит проверяет «родитель = текущий `main`». Звук пейджера выключен по умолчанию. Экзамен G — 60 минут с задачей-вариантом.

### Что отклонено или принято с изменением

| Замечание | Решение | Почему |
|---|---|---|
| K1: G-remote — в конце блока сетей | Отклонено в части места: G-remote открывает блок CI/CD (вариант O1) | До CI/CD удалённый репозиторий никому не нужен: блоку Docker хватает локального Git. Модуль Git внутри блока сетей разорвал бы его логику «от большой картины к пакету» (R8), а граф выполняется в обоих вариантах |
| K1: модуль Y убрать | Принято с изменением: содержание Y1 не удаляется, а передаётся в блок Linux как урок L31 (вариант O1) | В 02 урока L31 пока нет; удалив Y, мы оставили бы понятие графа без урока |
| K6: этап 3 разделить на 3a (kubeadm руками в блоке Kubernetes) и 3b (тот же кластер кодом в IaC) | Отклонено; принят вариант O4: этап 3 целиком после IaC, ручной проход kubeadm — шаг 3 внутри B3 | Два прохода — двойная аренда трёх ВМ и двойная проверка одного и того же. Боль ручного заказа ВМ ученик уже испытал на этапе 2 (k3s на трёх ВМ), а понимание kubeadm без автоматизации сохраняется ручным шагом перед ролями |
| O6: наборы 06 сделать единственным источником проверок уровня в 01 | Отклонено; принят вариант K8: источник — 01, 4.3, задания 06 — дополнительный пул | Два источника проверки одного блока расходятся при первой же правке; 01 отвечает за модель ученика и критерии, роль блока — за пул вариантов |
| O8: распознавание переименований при слиянии | Отклонено: конфликт с переименованием заменён конфликтом modify/delete | Распознавание по сходству содержимого — сложная эвристика, которая чаще всего расходится с настоящим git; для цели урока «конфликт — место, где решает человек» достаточно modify/delete |
| O9: заменить tfsim форком OpenTofu | Принято как спайк с правилом решения, а не как замена по умолчанию | Бюджет модуля 09 — 2,5 МБ gzip; ожидаемый размер форка в разы больше. Спайк дешевле, чем любое из решений вслепую |
| O12: 192 МБ для управляющего узла лаборатории | Отклонено: 256 МБ (вариант K11) | `ansible-playbook` на 32-битном Python занимает около 100 МБ, и каждый fork добавляет процесс; 192 МБ не оставляют места для `forks: 5`, который показывает E-ANS. Снимок 256 МБ помещается в бюджет 40 МБ 09 |
| O14: подуровни идентификаторов с буквами (`C08a`, `O06b`) | Принято с изменением: сквозная нумерация C16–C31, I15–I27, O15–O25 (вариант K2) | Формат 01 — плоские идентификаторы; буквенные подуровни создали бы второй уровень иерархии, которого нет ни в линтере, ни в `concepts.yaml` |
| O (таблица R5): токены `--c-pipe-*` по статусам джоб | Отклонено: статусы используют существующие `--c-ok`, `--c-err`, `--c-warn`, `--c-flow` с формами-дублями | В 08 цвет кодирует слой системы, а состояние — общими токенами; отдельные цвета на каждый статус джобы нарушили бы это правило и не дали бы ученику ничего нового |
| K20: название режима наставника `socratic-docs` | Принято с изменением названия: `lab-docs` | Режимы 09, 4.5 называются по месту (`learn`, `lab`, `exam`); `lab-docs` — тот же `lab` с правилом ступени 4 |
