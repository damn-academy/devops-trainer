# terraform-provider-lab

Провайдер Terraform и OpenTofu для облака во вкладке DevOps Trainer
(`api.cloud.lab`). Его контракт описан в `web/src/engine/cloud/openapi.yaml`.
Каждый `lab_vm` — это настоящая Linux-машина, которую v86 эмулирует прямо во
вкладке браузера.

English version: [README.md](README.md).

## Ресурсы и источники данных

Ресурсы: `lab_network`, `lab_subnet`, `lab_security_group`, `lab_ssh_key`,
`lab_vm`, `lab_disk`, `lab_lb`, `lab_dns_zone`, `lab_dns_record`,
`lab_bucket`, `lab_object`. Источники данных: `lab_images`, `lab_flavors`,
`lab_network`, `lab_subnet`.

Каждый ресурс можно импортировать командой `tofu import` по id или по имени.
Запись DNS импортируется как `<зона>/<запись>`, объект — как `<бакет>/<ключ>`.
При чтении провайдер заново берёт из API все атрибуты, поэтому правки,
сделанные в панели «Облако», видны в следующем `plan` как расхождение.
Ресурс, удалённый в обход Terraform, план создаёт заново, а объект с другим
ETag обновляет.

## Настройка

Адрес API, токен и проект задаются в блоке `provider "lab"` или переменными
окружения `LAB_ENDPOINT`, `LAB_TOKEN` и `LAB_PROJECT`. Токен — это секрет
ключа доступа. Первый ключ проекта `default` показывает панель «Облако».

## Сборка и образ

Сборку под `linux/386` описывает README.md. Сборщик образа
`web/scripts/build-lab-image.mjs` сам пересобирает провайдер, если исходники
новее бинарника. Бинарник он кладёт в локальное зеркало провайдеров
`/usr/share/terraform/plugins`, а для `root` и `learner` записывает
`~/.tofurc` и `~/.terraformrc`. Поэтому `tofu init` работает без интернета.
