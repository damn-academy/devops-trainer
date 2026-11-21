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
  и явным `--context`; реестр на узлах работает в пространстве имён `sankofa-registry`.
- node и npm, go, `ko` и `crane` (в `~/go/bin`), `openssl`, `curl`.
  Docker и виртуальные машины на рабочем компьютере не запускаются: образы
  собираются через `crane append` и `ko`.

## Выкатить заново

```sh
deploy/deploy.sh          # собрать курс и сервис, загрузить, применить, проверить
deploy/deploy.sh --lab    # заодно пересобрать образ Alpine и снимки загрузки
```

Образ лаборатории (`npm run build:lab-image`) и снимки загрузки
(`npm run build:lab-snapshots`, он загружает v86 в Chromium без окна)
используются повторно, если в `web/public/v86/lab/manifest.json` уже есть
снимки. После правок скриптов образа, каталога `lab/` или версии v86
запускайте с `--lab`. Образы указываются по дайджесту. Скрипт ждёт обе
выкатки и проверяет публичный `index.html`, заголовки изоляции и то, что
`/admin` требует пароль.

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

Пространство имён `devops-trainer`: Deployment `web` (2 реплики) и `feedback`
(1 реплика, `Recreate`), Service `web` и `feedback`, PVC `feedback-data`
(1 Гиб, StorageClass по умолчанию), Secret `feedback-secrets`, Ingress `web` и
`feedback` (у второго выключен журнал запросов: в адресах переписки есть
токен), Certificate и Secret `devops-trainer-tls` от ClusterIssuer
`letsencrypt`.
