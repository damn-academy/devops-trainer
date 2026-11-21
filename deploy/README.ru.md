# Выкладка

Курс и сервис отзывов работают на стенде Sankofa (кластер `museum` в
Cozystack воркшопов) по адресу
<https://devops-trainer.sankofa.workshop.aenix.io>.

| Путь | Кто отвечает |
|---|---|
| `/` | `web`: nginx-unprivileged с собранным курсом и образами v86 |
| `/api/feedback` | `feedback`: сервис на Go из `service/feedback`, SQLite на PVC |
| `/admin` | `feedback`: панель разбора сообщений, вход по HTTP Basic |

nginx отдаёт на каждый ответ `Cross-Origin-Opener-Policy: same-origin` и
`Cross-Origin-Embedder-Policy: require-corp`: без изоляции от чужих источников
воркеры v86 и `SharedArrayBuffer` не работают. Файлы Vite с хешем в имени,
файлы образа лаборатории и снимки загрузки кешируются на год; `index.html`,
`sw.js`, манифесты и ядро браузер каждый раз сверяет по ETag. Текстовые файлы
заранее сжаты gzip; модуля brotli в стоковом образе nginx нет.

## Что нужно

- Копия стенда Sankofa в `~/projects/sankofa-int` (или путь в `SANKOFA_ROOT`):
  `hack/stand/env.sh` задаёт `km` — это `kubectl` с kubeconfig кластера museum
  и явным `--context`. Реестр на узлах работает в пространстве имён
  `sankofa-registry`.
- На рабочем компьютере — git, `kubectl`, `curl` и `openssl`. Сам компьютер
  ничего не собирает: ни Docker, ни виртуальных машин, ни загрузки больших
  файлов.

## Выкатить заново

Закоммитьте и запушьте ветку, которую нужно выкатить, затем:

```sh
deploy/deploy.sh            # собрать запушенный HEAD в кластере, выкатить, проверить
deploy/deploy.sh --smoke    # то же и затем проверка в браузере
deploy/smoke.sh             # только проверка в браузере
```

`deploy.sh` запускает Job `build-<коммит>-<время>` (`deploy/build/job.yaml`,
скрипт `deploy/build/build.sh`). Этап на Go клонирует коммит с GitHub и
собирает сервис отзывов, провайдер OpenTofu для образа лаборатории и `crane`.
Этап в образе Playwright выполняет `npm ci`, скачивает стоковые файлы v86,
собирает образ Alpine и снимки загрузки (v86 в Chromium без окна), собирает
курс с `VITE_FEEDBACK_URL=https://<хост>/api/feedback`, собирает образ nginx
через `crane append` и кладёт оба образа в реестр каждого узла. Потом скрипт
применяет `devops-trainer.yaml` с дайджестами образов, ждёт обе выкатки и
проверяет публичный `index.html`, заголовки изоляции и то, что `/admin`
требует пароль. Сборка идёт примерно 15–25 минут, следить за ней можно
командой `km -n devops-trainer logs -f job/<имя> -c images`. Завершённые Job
удаляются через сутки.

`smoke.sh` запускает `web/scripts/smoke-public.mjs` как Job, тоже в кластере:
главная страница (и то, что она изолирована от чужих источников),
объяснялка, цель в учебном терминале, настоящий Linux в v86 со снимка
загрузки, первая цель облака во вкладке, сообщение об ошибке, отправленное
из курса и найденное в панели. Токен администратора попадает в Job из
Secret и не печатается. После каждой проверки в панели остаётся одно
сообщение с текстом «Deployment smoke check».

## Панель отзывов

Откройте <https://devops-trainer.sankofa.workshop.aenix.io/admin>. Имя
пользователя — `token`, пароль — токен администратора из Secret. `deploy.sh`
создаёт его один раз и нигде не печатает. Прочитать токен:

```sh
source ~/projects/sankofa-int/hack/stand/env.sh
km -n devops-trainer get secret feedback-secrets -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d; echo
```

Скрипты могут передавать `Authorization: Bearer <токен>`, например для
`/admin/export?format=jsonl`. Чтобы сменить токен, удалите Secret и снова
запустите `deploy/deploy.sh` либо замените значение и выполните
`km -n devops-trainer rollout restart deploy/feedback`.

Уведомления (почта, Telegram, GitHub) выключены: их переменные не заданы.
Ограничение частоты включено. Контроллер ingress работает со сквозным TLS
(SSL passthrough), поэтому сервис видит всех клиентов с одного адреса:
`REPORT_LIMIT_PER_HOUR=300` и `FOLLOW_LIMIT_PER_HOUR=3000` в
`devops-trainer.yaml` делят между собой все ученики.

## Откатить

Каждая выкатка хранит дайджест образа в истории ReplicaSet, а реестр хранит
старые образы:

```sh
source ~/projects/sankofa-int/hack/stand/env.sh
km -n devops-trainer rollout history deploy/web
km -n devops-trainer rollout undo deploy/web                 # предыдущая сборка курса
km -n devops-trainer rollout undo deploy/web --to-revision=N
km -n devops-trainer rollout undo deploy/feedback            # предыдущая сборка сервиса
```

Ученики, у которых service worker уже закешировал новую сборку, получат
старую при следующем заходе (`sw.js` браузер не кеширует). Данные SQLite при
откате не меняются.

## Резервная копия сообщений

В образе сервиса нет ни оболочки, ни `cat`, поэтому выгружайте через API панели:

```sh
token=$(km -n devops-trainer get secret feedback-secrets -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d)
curl -fsS -H "Authorization: Bearer $token" \
  'https://devops-trainer.sankofa.workshop.aenix.io/admin/export?format=jsonl' > feedback.jsonl
```

## Удалить всё

Удаление пространства имён убирает Deployment, Service, Ingress, Secret с
токеном, сертификат TLS и PVC со всеми сообщениями:

```sh
km delete namespace devops-trainer
```

Образы остаются в реестре на узлах (`sankofa/devops-trainer-web`,
`sankofa/devops-trainer-feedback`), пока реестр стенда не почистят.

## Что создаётся в кластере

Пространство имён `devops-trainer`: Job сборки и проверки (хранятся сутки),
ConfigMap `build-script`, Deployment `web` (2 реплики) и `feedback`
(1 реплика, `Recreate`), Service `web` и `feedback`, PVC `feedback-data`
(1 Гиб, StorageClass по умолчанию), Secret `feedback-secrets`, Ingress `web` и
`feedback` (у второго выключен журнал запросов: в адресах переписки есть
токен), Certificate и Secret `devops-trainer-tls` от ClusterIssuer
`letsencrypt`.
