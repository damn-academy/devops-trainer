# Рецензия на 09 «Архитектура платформы» — от автора 04 «Контейнеры»

Рецензент: инженер по контейнерным рантаймам (автор `04-containers.md`). Дата: 18.11.2026. Рецензируемый документ: `09-runtime-ai-architecture.md`, версия 1.

## Вердикт

Документ сильный там, где он сводит решения блоков в одну платформу: единый интерфейс `Machine`, контракт «факты → предикаты», одно ядро `dt-kernel` на два корня, local-first хранение, честная модель экзаменов, разбор CORS провайдеров нейросетей. Решение «v86 для настоящего ядра, TS-симуляторы для docker/kubectl» с точки зрения рантаймов верное, и я его поддерживаю. Но документ написан до требований владельца R1–R12 и в трёх местах не покрывает обязательное: многоузловая сеть в браузере со своим коммутатором и гибридный Kubernetes (R11, на них держатся R9 и R10), платформенная поддержка лестницы документации (R2) и пересчёт процесса при смене параметра в объяснениях (R4). Кроме того, я проверил исходники v86 (`src/browser/inbrowser_network.js`, `fake_network.js`, `starter.js`, ветка master на 18.11.2026): бэкенд `inbrowser` — это концентратор на BroadcastChannel, а бэкенды `fetch`/`wisp` отвечают на ping к любому адресу и на любой DNS-запрос сами. Для курса, где «каждая сетевая проблема привязана к уровню», это ложь на уровне L3, и её надо явно обойти. Схема фактов и язык предикатов в нынешнем виде не выражают половину проверок блока контейнеров и раздела «Как ядро изолирует и ограничивает» (R6), а в грамматике есть ошибки, которые дадут ложные срабатывания. Итог: 3 блокирующих, 11 существенных, 10 мелких замечаний; к каждому ниже готовый текст или схема для вставки.

---

## Блокирующие

### 1. BLOCKING — Многоузловая сеть в браузере: `inbrowser` — это концентратор, а не коммутатор; своего коммутатора и топологии нет (R11)

**Где:** 0 «Решения коротко» (строка «Сеть ярусов B»), 1.4 (таблица образов: «две машины по 192 МБ»), 1.6 «Сеть машин в браузере».

**Что не так.**
- В v86 `InBrowserNetworkAdapter` подписывает сетевую карту на один `BroadcastChannel("v86-inbrowser-<id>")` и рассылает каждый кадр всем остальным машинам этого канала; в коде он помечен как `experimental`. Это концентратор (hub): `tcpdump` на любой машине видит чужой трафик, таблицы MAC нет, сегмент один, разорвать отдельный линк, задержать или потерять пакет, нарисовать путь кадра нельзя. Блок сетей (03, N1) учит, что коммутатор «учит, за каким портом какой MAC», — тренажёр на ярусе B будет показывать противоположное.
- R11 требует 3–4 машины по 64–128 МБ в Web Worker'ах, связанные нашим JS-коммутатором с настоящим L2 (ARP, ping, tcpdump, маршрутизация, iptables, NAT, WireGuard между узлами) и визуализацией коммутатора. В документе этого нет: только «две-три машины одной лаборатории» и бюджет памяти вкладки на одну машину (≤ 600 МБ).
- Не решены проблемы клонирования: если три узла восстанавливаются из одного снимка, у них одинаковые MAC, hostname, `/etc/machine-id`, ssh host keys и адрес от DHCP. В v86 для этого есть настройки `mac_address_translation` и `preserve_mac_from_state_image` (видны в `starter.js`), но документ их не использует.
- В текущем `starter.js` сетевая карта у машины одна (`settings.net_device`, по умолчанию `ne2k`). Маршрутизатору между двумя сегментами нужны две «ноги»; это надо решать VLAN-подынтерфейсами, иначе урок «пакет через NAT/маршрутизатор» на ярусе B не собрать.
- По умолчанию эмулируется `ne2k`, а не virtio: в ядро `VIRTIO_NET` включён, но в конфигурации машины `net_device.type: "virtio"` не задан. ne2k заметно медленнее, для четырёх узлов это критично.

**Исправление — вставить новый раздел 1.8 «Несколько машин и свой коммутатор `dt-switch`»:**

> **1.8. Несколько машин и свой коммутатор**
>
> Бэкенд `inbrowser` из v86 не используем: это концентратор на BroadcastChannel, и он показывает ученику неверную модель L2. Вместо него — свой сетевой адаптер `DtSwitchAdapter`, который подписывается на события шины v86 `net0-send` и отправляет кадры в `net0-receive` (тот же механизм, что у встроенных адаптеров), и свой коммутатор `dt-switch` в выделенном воркере `net.worker.ts`.
>
> **Топология.** Каждая машина — отдельный `v86.worker.ts` (до 4 на ноутбуке, 1 на телефоне — на телефоне многоузловые лаборатории идут только в записанном режиме). Воркер машины и `net.worker.ts` связаны `MessageChannel`; кадр передаётся как transferable `ArrayBuffer` без копирования. Сценарий лаборатории описывает топологию:
>
> ```yaml
> topology:
>   switches:
>     - { id: sw1, vlans: [10, 20], mac_aging: 300s }
>   machines:
>     - { id: node-1, image: lab-node, mem: 128M, port: { switch: sw1, mode: trunk, vlans: [10, 20] } }  # маршрутизатор: eth0.10 и eth0.20
>     - { id: node-2, image: lab-node, mem: 96M,  port: { switch: sw1, mode: access, vlan: 10 } }
>     - { id: node-3, image: lab-node, mem: 96M,  port: { switch: sw1, mode: access, vlan: 20 } }
>   uplink: { switch: sw1, vlan: 10, to: lab-internet }   # «мини-интернет» из lab-net или netlab-шлюз
> ```
>
> **Что делает коммутатор.** Обучающаяся таблица MAC со старением; VLAN 802.1Q (access/trunk), поскольку у машины одна сетевая карта; широковещание и неизвестный unicast — во все порты VLAN, кроме входящего; на каждый порт — параметры `up`, `delay_ms`, `loss_pct`, `rate_kbps` (нужны для R4: «ползунок задержки» и «сломай линк» в объяснении TCP); счётчики кадров. Каждый кадр разбирается до L4 и отдаётся на шину как `net.packet` (и новое событие `l2.frame` с `{switch, in_port, out_ports, src_mac, dst_mac, vlan, ethertype}`), поэтому схема коммутатора и аниматор пакетов (08, 3.6) работают над настоящим трафиком настоящих ядер. Захват пакетов: кольцевой буфер на порт, экспорт в pcap и просмотр в нашем разборщике заголовков (тот же виджет «конверт со слоями», 08, 6.3).
>
> **Идентичность клонов.** Узлы стартуют из одного снимка `lab-node`. После `restore_state` адаптер включает `mac_address_translation` и выдаёт узлу MAC `02:dt:<lab>:<n>`; служебный агент по `ttyS1` получает команду `identity {hostname, ip, machine_id, ssh_host_key}` и до первого приглашения применяет её (`hostname`, `ip addr`, перегенерация `/etc/machine-id`, подмена ключей хоста из пакета лаборатории). Адреса статические или от `dnsmasq` одного из узлов — по сценарию.
>
> **Карта.** `net_device: { type: "virtio" }` во всех образах.
>
> **Бюджеты приёмки (фаза 0):** 3 узла × 128 МБ гостя — память вкладки ≤ 1,6 ГБ; 4 узла × 96 МБ — ≤ 1,8 ГБ; простаивающие узлы суммарно ≤ 15% одного ядра (ядро с `NO_HZ_IDLE`, `HZ_100`); `ping` между узлами — RTT ≤ 20 мс; `iperf3` между узлами — ≥ 5 Мбит/с; согласованный снимок всей лаборатории (пауза всех машин → `save_state` каждой → состояние коммутатора) ≤ 160 МБ в OPFS и ≤ 10 с. Многоузловые лаборатории не показываются при `navigator.deviceMemory` < 8 (и при его отсутствии — см. замечание 21), вместо них — записанный режим.

Добавить в таблицу 1.4 образ:

> | `lab-node` | `lab-alpine` + `bash`, `tcpdump`, `iperf3`, `wireguard-tools`, `conntrack-tools`, `ipvsadm`, `nftables`, `dnsmasq`, `dt-kubelet` (раздел 1.9) | 96–128 МБ | Многоузловые лаборатории сетей (ARP, маршрутизация, NAT, WireGuard), сеть подов, гибридный Kubernetes |

В таблице 1.6 строку «Две-три машины одной лаборатории» заменить на «Несколько машин одной лаборатории | свой адаптер `dt-switch` | раздел 1.8».

### 2. BLOCKING — Гибридный Kubernetes (kube-lite + настоящий kubelet-агент на узлах v86) отсутствует (R11, R9, R10, R12 этап 1)

**Где:** 1.7 «Симулированный слой для docker и kubectl»; 0 «Решения коротко» (строка «Docker и kubectl»); раздел 7 «План работ».

**Что не так.** В документе `kubectl apply` в итоге создаёт «docker-подобный контейнер на узле» симулятора. Требование R11 — прототипировать первым гибрид: control plane — kube-lite, на каждом узле v86 — маленький настоящий kubelet, который запускает поды через `crun`, чтобы `kubectl apply` давал настоящие процессы в настоящих пространствах имён, `kubectl exec` входил в настоящий контейнер, а убитый узел заставлял поды переехать. На гибриде держатся R9 (найти в настоящем `iptables` путь пакета к ClusterIP, veth/bridge и VXLAN между узлами на настоящем ядре) и R10 (контроллер ученика видит настоящие процессы). Ничего из этого не спроектировано, и ни одного пункта нет в плане работ.

**Исправление — вставить раздел 1.9 «Гибридный кластер»:**

> **1.9. Гибридный кластер: control plane в симуляторе, поды на настоящих ядрах**
>
> Настоящий k3s или kubeadm внутри v86 невозможен: k3s собирается только под 64-битные платформы, а control plane не помещается в 128 МБ эмулируемой памяти (05, раздел 1). Поэтому API-сервер, etcd-семантика, планировщик и контроллеры — kube-lite в `sim.worker.ts`, а узлы — машины `lab-node` из 1.8 со служебным агентом `dt-kubelet`.
>
> **`dt-kubelet`.** Статический Go-бинарник под `linux/386` (тот же код фактов, что у `trainer-check`, см. замечание 7), около 4 МБ, приходит по 9p. С kube-lite он говорит не по сети гостя, а по служебному каналу `ttyS1` через мост в основном потоке: так control plane не зависит от того, что ученик сделал с iptables узла, и это соответствует реальности (kubelet ходит к API-серверу по отдельному адресу). Протокол — строки JSON:
>
> ```json
> → {"op":"register","node":"node-2","podCIDR":"10.42.2.0/24"}                // при старте
> ← {"op":"pod.sync","pod":{...PodSpec из kube-lite...}}                       // watch назначенных подов
> → {"op":"pod.status","uid":"…","phase":"Running","containerStatuses":[…],"podIP":"10.42.2.7"}
> → {"op":"node.status","conditions":[{"type":"Ready","status":"True"}],"capacity":{"memory":"96Mi","pods":"10"}}  // раз в 10 с
> ← {"op":"exec","uid":"…","container":"app","cmd":["sh"],"tty":"ttyS2"}       // kubectl exec
> ← {"op":"logs","uid":"…","container":"app","follow":true}
> ← {"op":"svc.sync","services":[…],"endpointSlices":[…]}                      // для правил kube-proxy
> ```
>
> **Что агент делает настоящим.**
> 1. *Песочница пода:* `crun create` контейнера-паузы (`/pause` из BusyBox `sleep infinity` или свой 20-строчный `pause` на C) — у него настоящие net, ipc, uts namespaces; контейнеры пода создаются `crun` с `config.json`, где `linux.namespaces` ссылаются на `/proc/<pid паузы>/ns/net` и `ns/ipc`. Это ровно то, что 05 описывает словами «под — группа контейнеров с общими net и ipc» и что ученик собирал руками в 04, D3.
> 2. *Сеть пода (CNI-lite, режимы по сценарию):* veth в мост `cni0` узла, адрес из podCIDR; между узлами — режим `host-gw` (маршруты `10.42.N.0/24 via <IP узла N>`) или `vxlan` (`ip link add flannel.1 type vxlan id 1 dev eth0 dstport 8472`, FDB-записи от агента). Переключение режима — тумблер в объяснении «пакет между подами на разных узлах» (R9); оба режима видны в pcap коммутатора 1.8 — во втором кадр в кадре.
> 3. *kube-proxy-lite на настоящем ядре:* из `svc.sync` агент пишет цепочки `KUBE-SERVICES`, `KUBE-SVC-*`, `KUBE-SEP-*` с `-m statistic --mode random --probability` в настоящий `iptables-save` узла — те же имена и форма, что модель kube-proxy-lite в 05, раздел 5. Режим `ipvs` — по тумблеру (`ipvsadm -Ln`, интерфейс `kube-ipvs0` типа `dummy`, на котором ClusterIP *есть*, в отличие от режима iptables). Режим eBPF/Cilium в v86 не воспроизводим (Cilium не собирается под 32-битную архитектуру) и остаётся в симуляторе и на этапе 3.
> 4. *DNS кластера:* на каждом узле `dnsmasq` на адресе `10.43.0.10` (адрес добавлен на `lo` или `dummy`), агент перегенерирует его hosts-файл из Services; в `/etc/resolv.conf` подов — `search <ns>.svc.cluster.local svc.cluster.local cluster.local` и `options ndots:5`. Ученик видит, что «CoreDNS» в гибриде заменён, — это сказано в тексте урока один раз.
> 5. *Образы:* только `linux/386` из реестра курса (Service Worker, 04, 7.6) — `busybox`, `alpine`, `nginx` (Alpine-пакет x86), учебный `trainer/app`. Агент тянет index → выбирает `platform: linux/386` → manifest → слои → распаковывает в `/var/lib/dt/images/<digest>`. Попытка развернуть образ без `386` даёт настоящее сообщение `no matching manifest for linux/386 in the manifest list entries` — момент для разговора о multi-arch.
>
> **Время.** kube-lite в одиночном режиме работает на модельных часах (ускорение, перемотка). В гибридном режиме модельные часы привязываются к реальным (`clock: wall`), иначе таймауты узла и пробы расходятся с настоящими процессами. Чтобы «убить узел» было наглядно за минуту, сценарий гибрида задаёт `node-monitor-grace-period: 20s` и для подов `tolerationSeconds: 30` для `not-ready`/`unreachable` и говорит об этом в тексте: «в настоящем кластере по умолчанию это около 40–50 секунд на признание узла недоступным и 300 секунд до выселения подов; здесь мы ускорили, чтобы вы успели увидеть».
>
> **«Убить узел».** Кнопка останавливает воркер машины (или переводит порт коммутатора в `down` — это «сеть пропала», а не «питание пропало», и это два разных урока). Heartbeat `node.status` перестаёт приходить → node lifecycle controller kube-lite ставит `Ready=Unknown` → taint `node.kubernetes.io/unreachable` → выселение → ReplicaSet создаёт поды → планировщик ставит их на живые узлы → `dt-kubelet` там запускает настоящие процессы. Всё это — события шины `k8s.*` и `proc.spawn` с настоящими PID.
>
> **Проверки.** Факты `k8s.objects` берутся из kube-lite, факты `procs`, `net`, `mounts` — из узлов через `dt-kubelet`. Пример цели R9: «Найдите, куда iptables отправляет пакет к ClusterIP сервиса `web`» — `when: "answer.sep_ip=@k8s.endpoints(web).ip[*]"`, а проверка понимания — `predict`-вопрос перед `iptables -t nat -L KUBE-SVC-… -v -n` с последующим сравнением счётчиков пакетов (`pkts`) до и после `curl` из пода.
>
> **Бюджеты приёмки (фаза 0, спайк 5):** `kubectl apply` Deployment на 3 реплики → все поды `Running` с настоящими PID ≤ 10 с; `kubectl exec -it … sh` → приглашение ≤ 2 с; «убить узел» → поды на других узлах `Running` ≤ 60 с при сокращённых таймаутах; память `dt-kubelet` ≤ 15 МБ RSS.

В раздел 7 добавить: «Фаза 0, пункт 5: спайк гибрида — 3 узла `lab-node`, `dt-switch`, `dt-kubelet` с песочницей пода и `host-gw`; критерий — бюджеты 1.9» и в v1: «гибридный кластер в блоке Kubernetes (уроки сети подов, Service, reconcile)». Без этого спайка R11 «прототипировать первым» не выполнено.

### 3. BLOCKING — Нет платформенной поддержки лестницы документации (R2)

**Где:** 1.4 (состав образов), 2.4 (описание проверки), 4.5 (режимы нейросети), 4.7 и 6.4 (экзамены, CSP).

**Что не так.** Лестница из пяти ступеней — требование к каждому блоку, но почти всё, на чём она стоит, — платформа, и в 09 этого нет:
- В образах нет справочных страниц: Alpine по умолчанию ставится без `man`, а для ступеней 2–5 ученик должен открывать `man unshare`, `man 7 cgroups`, `man capsh`, `crun --help` в самой машине. В `lab-debian` `man-db` есть только «для команд из 3.3» блока Linux.
- Ступень 2 («подсказка — фрагмент man-страницы с подсвеченной строкой, ученик учит анатомию SYNOPSIS/OPTIONS/EXAMPLES») требует корпуса документации, разобранного на разделы, с якорями на конкретные опции. Его нет.
- Ступени 4–5 требуют отличать «команду/флаг, которые были в теории» от «не были». Нет реестра преподанных флагов, сборка не может проверить, что задание ступени 4 действительно требует непреподанного.
- Ступень 4: нейросеть отвечает «где вы смотрели?» и направляет в `man`, `--help`, `kubectl explain`, docs.docker.com. Такого режима в таблице режимов 4.5 нет.
- Ступень 5: на экзамене открыта только официальная документация (как на CKA). CSP 6.4 содержит `frame-src 'none'`, то есть встроить kubernetes.io в панель нельзя (и kubernetes.io сам запрещает фреймы), а выход машин в интернет — только через Wisp с белым списком. Как ученик читает документацию на экзамене, не описано.

**Исправление.**

(а) В 1.4 добавить к составу образов: `lab-alpine`/`lab-node` — `mandoc`, `man-pages`, `util-linux-doc`, `iproute2-doc`, `iptables-doc`, `libcap-doc`, `crun-doc` (если пакета нет — страницы `crun(1)` собираем сами из репозитория crun), `jq-doc`; `lab-debian` — `man-db`, `manpages`, `manpages-dev` (для `fork(2)`, `clone(2)`, `unshare(2)`), `libcap2-bin`. Страницы лежат на 9p и грузятся по требованию — на бюджет снимка не влияют.

(б) Новый раздел 1.10 «Корпус документации `dt-docs`»:

> **1.10. Корпус документации**
>
> CI собирает корпус из источников *тех же версий*, что в образах и симуляторах: man-страницы из пакетов образов (`mandoc -T html` → разбор по `.SH`), справка `docker` CLI для Engine 29.x (из docs.docker.com/reference, Apache-2.0), `kubectl` reference и `kubectl explain` из OpenAPI v1.37 (тот же, что у kube-lite), страницы kubernetes.io/docs по списку (CC BY 4.0), Terraform/Ansible по списку блока 06. Формат одной страницы:
>
> ```yaml
> id: man/unshare.1@util-linux-2.41
> title: unshare(1)
> source: { url: "https://man7.org/linux/man-pages/man1/unshare.1.html", license: GPL-2.0-or-later }
> sections:
>   - { id: NAME, text: "unshare - run program in new namespaces" }
>   - { id: SYNOPSIS, text: "unshare [options] [program [arguments]]" }
>   - id: OPTIONS
>     items:
>       - { anchor: "opt-fork", flags: ["-f", "--fork"], text: "Fork the specified program as a child process of unshare rather than running it directly. …" }
>       - { anchor: "opt-mount-proc", flags: ["--mount-proc[=mountpoint]"], text: "Just before running the program, mount the proc filesystem …" }
>   - { id: EXAMPLES, text: "…" }
> ```
>
> Просмотрщик документации — наш собственный виджет `docs` (рендер своими DOM-узлами, как ответы нейросети в 4.4), открывается справа от терминала; внешние ссылки на официальную страницу открываются в новой вкладке. Встраивания чужих сайтов нет (CSP `frame-src 'none'` сохраняется).
>
> **Реестр преподанного.** В `content/concepts.yaml` у понятий-команд появляется поле `flags_taught: { "<lesson-id>": ["-f", "--mount-proc"] }`. Сборка вычисляет для каждого маршрута множество «преподанных к этому экрану» флагов и проверяет задания по ступеням (поле `doc_step` у задания):
> - `doc_step: 1|2` — все флаги эталонного решения преподаны или перечислены в `doc_hint`;
> - `doc_step: 3` — у задания есть `doc_ref` (якорь страницы), эталонный флаг в теории не встречался;
> - `doc_step: 4` — хотя бы один обязательный флаг эталона не преподан и `doc_ref` *не показывается*; подсказки H1–H5 выключены, кроме H1;
> - `doc_step: 5` — экзамен, раздел 4.7.
>
> **Стартовая ступень по уровню:** новичок — 1, средний — 2, опытный — 3; в пределах блока ступень растёт по мере прохождения модулей (правило — в 01), но никогда не падает ниже стартовой.

(в) В 2.4 добавить поля задания и проверку «нашёл флаг»:

```yaml
- id: g-unshare-mount-proc
  doc_step: 3
  doc_ref: man/unshare.1#opt-mount-proc
  say: { ru: "Запустите sh в новом PID-пространстве так, чтобы ps показывал только процессы внутри. Нужный флаг найдите на странице unshare(1)", en: "…" }
  needs: [procs, mounts]
  when: "procs[cmd=sh][nspid.last=1] && mounts[target=/proc][type=proc][ns=@pid(sh).ns.mnt]"
  fail:
    - if: "procs[cmd=sh][nspid.last=1] && !mounts[target=/proc][ns=@pid(sh).ns.mnt]"
      say: { ru: "PID-пространство новое, но /proc внутри старый — поэтому ps показывает чужие процессы. На странице unshare(1) есть опция, которая монтирует proc заново", en: "…" }
```

Здесь проверяется *результат* использования флага, а не текст команды: ученик, который сделал `unshare -p -f -m` и потом `mount -t proc proc /proc` руками, тоже прав.

(г) В таблицу режимов 4.5 добавить строку:

> | `forcing` | задания `doc_step: 4` | Не называй команду, флаг или поле. На любой вопрос о том, как сделать, сначала спроси: «Где вы уже искали?» Если ученик не смотрел — назови *источник* (`man <команда>`, `<команда> --help`, `kubectl explain <ресурс>.<поле>`, раздел docs.docker.com) и раздел страницы (OPTIONS, EXAMPLES), но не строку. Если смотрел и не понял — объясни, как читать найденный фрагмент, который ученик вставил | Ответ фильтруется: если в нём встретился эталонный флаг задания (`solution_flags`), блок сворачивается, как в `lab` |

(д) В 4.7 и 6.4 добавить про ступень 5:

> На экзаменах ступени 5 открыт только виджет `docs` с корпусом 1.10 (для предъявляемых экзаменов на ВМ — ещё `man`, `--help` и `kubectl explain` на самой машине); нейросеть выключена. Часть заданий экзамена помечена `beyond_course: true`: эталон требует флага или поля, которого нет в `flags_taught` ни одного урока, но которое есть в корпусе. Сборка проверяет, что таких заданий в экзамене не меньше 2 и не больше 30% веса.

---

## Существенные

### 4. MAJOR — Бэкенды `fetch` и `wisp` в v86 подделывают ping и DNS; это ломает уроки «какой уровень сломался» (R8) и обещание «без сторонних серверов»

**Где:** 1.6 (таблица, «Wisp-релей», пункт 1 списка разрешённых назначений), 6.4 (CSP `connect-src https:`).

**Что не так** (проверено по `src/browser/fake_network.js`, master):
- `handle_fake_ping` отвечает на ICMP echo к *любому* адресу, подставляя его как источник ответа. `ping 10.99.99.99` или `ping 8.8.8.8` из гостя «работает» всегда, с нулевой потерей. Урок «пинг не проходит — смотрим, какой уровень» на ярусе B с этими бэкендами невозможен, а ученик получит ложную картину.
- Любой UDP-пакет DNS, куда бы он ни шёл, перехватывается и решается через DNS over HTTPS к `cloudflare-dns.com` (`DEFAULT_DOH_SERVER`, `dns_method` по умолчанию `"doh"`), а ответ приходит с адреса виртуального маршрутизатора. Следствия: (1) запросы ученика уходят третьей стороне напрямую из браузера, мимо нашего релея и его журнала — это противоречит политике 1.6 и заголовку «наш сервер — единственный выход»; (2) `dig @8.8.8.8 example.com` получит ответ не от того адреса, которому слал запрос, и `dig` ожидаемо его отбросит; (3) `dig +trace` не работает: корневые серверы «отвечают» резолвером Cloudflare.
- Клиент Wisp в v86 поддерживает только TCP (UDP в планах), поэтому пункт белого списка `1.1.1.1:53`, `8.8.8.8:53` бесполезен для обычного `dig`.
- Связи между машинами в режиме `wisp` нет (гости изолированы).

**Исправление.** В 1.6 добавить абзац и поправить список:

> **Ограничения встроенного сетевого стека v86.** Бэкенды `fetch` и `wisp` не пропускают наружу L3: v86 сам отвечает гостю на ARP, DHCP, DNS, NTP и ICMP echo к любому адресу. Поэтому:
> - `dns_method: "static"` с нашим списком имён или `doh_server: "<домен>/dns-query"` — DoH-эндпоинт в `dt-api`, который применяет тот же белый список и журнал, что релей. Встроенный `cloudflare-dns.com` не используется никогда; CSP `connect-src` получает явное исключение `cloudflare-dns.com` в `deny`-тесте Playwright (проверка, что запросов туда нет);
> - уроки, где важно, отвечает ли адрес на ping и кто отвечает на DNS (03: N8, N12, N16; R8, процессы «URL», «разрешение имени», «откуда 504»), идут только в симуляторе netlab или в многомашинной лаборатории `dt-switch` (1.8) с «мини-интернетом» `lab-net`, где каждый ответ даёт настоящий демон;
> - в режиме `wisp` над терминалом одна строка: «Эта машина выходит в интернет через учебный шлюз: ping и DNS здесь отвечает сам шлюз, а не настоящие серверы»;
> - из белого списка релея убрать `1.1.1.1:53` и `8.8.8.8:53`; оставить `:53` только для `dig +tcp`, если он нужен уроку, и сказать это в задании.

### 5. MAJOR — Схема фактов `dt.facts/v1` не выражает проверки изоляции и «шести границ» контейнера (R6, R7)

**Где:** 2.2 «Формат фактов».

**Что не так.** По схеме нельзя проверить: поток против процесса (`/proc/<pid>/task`, TGID), зомби (`state: Z`) для дрилла про PID 1 и `tini`, capabilities (`CapEff`, `CapBnd` из `/proc/<pid>/status`) для `capsh`/`setcap`, режим seccomp (`Seccomp:` в `status`), карту UID user namespace (`uid_map`), сетевое состояние *внутри* пространства имён контейнера (сейчас `net` один на машину — значит, не проверить «приложение слушает 127.0.0.1 в своём netns»), пропагацию монтирований (`shared`/`private` — ключевой момент урока mount ns), whiteout-файлы (символьные устройства 0:0 — `type` допускает только `f|d|l`), xattr (`security.capability`, `trusted.overlay.opaque`), троттлинг CPU (`cpu.stat`), `pids.current`. `user: string` неоднозначен в user namespace — нужен числовой UID. `net.links: object[]` нетипизирован, а для veth нужна связь с парой.

**Исправление — заменить соответствующие поля:**

```ts
procs?: {
  pid: number; tgid: number; ppid: number;
  uid: number; euid: number; gid: number; user?: string;      // user — имя по /etc/passwd хоста, может отсутствовать
  state: 'R' | 'S' | 'D' | 'Z' | 'T' | 'I';
  cmd: string; exe?: string; root?: string;                    // readlink /proc/<pid>/root — для chroot/pivot_root
  threads: number[];                                           // /proc/<pid>/task/*
  nspid: number[];                                             // NSpid: от внешнего к внутреннему, последний — PID внутри
  ns: Record<NsKind, string>;                                  // 'pid:[4026532201]'
  cgroup: string;
  caps: { eff: string[]; prm: string[]; bnd: string[] };       // декодировано из CapEff/CapPrm/CapBnd
  seccomp: 0 | 1 | 2;                                          // disabled / strict / filter
  noNewPrivs: boolean;
  uidMap?: [number, number, number][];                         // /proc/<pid>/uid_map, если user ns не исходный
  sig?: { blocked: string[]; ignored: string[]; caught: string[] };  // SigBlk/SigIgn/SigCgt — дрилл «PID 1 игнорирует SIGTERM»
}[];
cgroups?: {
  path: string; procs: number[]; threads?: number[];
  controllers: string[]; subtreeControl: string[];
  'memory.max': string; 'memory.high'?: string; 'memory.current': number; 'memory.events'?: Record<string, number>;
  'pids.max': string; 'pids.current': number;
  'cpu.max': string; 'cpu.stat'?: { usage_usec: number; nr_throttled: number; throttled_usec: number };
}[];
mounts?: {
  id: number; parent: number; target: string; type: string; source: string; options: string[];
  propagation: 'shared' | 'private' | 'slave' | 'unbindable'; peerGroup?: number;
  lower?: string[]; upper?: string; work?: string; ns: string;
}[];
files?: Record<string, {
  exists: boolean; type?: 'f' | 'd' | 'l' | 'c' | 'b' | 'p' | 's'; rdev?: string;   // whiteout: type 'c', rdev '0:0'
  mode?: string; uid?: number; gid?: number; size?: number; sha256?: string; text?: string;
  xattrs?: Record<string, string>;                                                  // security.capability, trusted.overlay.opaque
  caps?: string;                                                                    // вывод getcap в каноническом виде
}>;
net?: Record<string /* netns id, 'host' для исходного */, {
  links: { name: string; ifindex: number; kind?: 'veth' | 'bridge' | 'vxlan' | 'wireguard' | 'dummy' | 'vlan';
           peerIfindex?: number; peerNs?: string; master?: string; mac: string; mtu: number; up: boolean }[];
  addrs: { link: string; cidr: string }[];
  routes: { dst: string; via?: string; dev: string; table?: string }[];
  neigh?: { ip: string; mac: string; dev: string; state: string }[];
  listen: { proto: 'tcp' | 'udp'; addr: string; port: number; pid?: number }[];
  iptables?: Record<string /* 'nat/PREROUTING' */, string[]>; nft?: string;
  conntrack?: { proto: string; src: string; dst: string; sport: number; dport: number; replySrc: string; replyDst: string }[];
}>;
containers?: {
  id: string; name: string; image: string; state: string; exitCode?: number; oomKilled?: boolean;
  pid?: number; user?: string; init?: boolean; stopSignal?: string; restartCount?: number;
  health?: 'starting' | 'healthy' | 'unhealthy'; logDriver?: string; logPath?: string;
  ports: string[]; mounts: { type: 'volume' | 'bind' | 'tmpfs'; source: string; target: string; rw: boolean }[];
  networks: string[]; env?: string[];                                                // env — только имена, без значений
}[];
```

Поле `history` оставить, но в правилах валидатора 2.4 явно записать: `history` разрешён только в `fail.if` (подсказка), никогда в `when`.

### 6. MAJOR — Ошибки в языке предикатов дадут ложные засчитывания

**Где:** 2.3 «Язык предикатов», 2.4.

**Что не так.**
1. `~` определён как «подстрока», а применяется к числовым массивам: `procs[...][nspid~1]` совпадёт с `nspid: [4126, 12]` и `[4126, 21]`; `cgroups[procs~@pid(stress-mem)]` при PID 41 совпадёт с группой, где лежит PID 4126. Это прямые ложные засчитывания в лаборатории «Контейнер своими руками».
2. `units[nginx.service].active` не разбирается грамматикой: `[...]` — это `filter := '[' field op value ']'`, а точка — разделитель пути. Доступ по ключу словаря (`units`, `http`, `files`, `net`) в грамматике не определён.
3. Не определено сравнение строковых значений cgroup: `memory.max` бывает `max`; `cpu.max` — `"50000 100000"`; не определено, что `20M` — это 20·2²⁰ (так понимает ядро) или 20·10⁶; у Kubernetes `20M` и `20Mi` различаются.
4. `@start.pid(stress-mem)` в `keep` требует снимка фактов на старте попытки — механизм не описан.
5. Макрос `@host.ns.pid` неоднозначен на машине, где ученик уже сидит в `unshare` (какой процесс — «хост»?).

**Исправление — заменить грамматику и правила:**

```
predicate := disj
disj      := conj ('||' conj)*
conj      := unary ('&&' unary)*
unary     := '!' unary | '(' predicate ')' | term
term      := path (op value)?                 -- без op: «существует хотя бы один»
path      := segment ('.' segment)*
segment   := name key? filter* index?  |  '#'
key       := '{' string '}'                   -- доступ к словарю: units{'nginx.service'}, net{'host'}, files{'/etc/hosts'}
filter    := '[' field op value ']'
index     := '[' ('first' | 'last' | integer) ']'   -- nspid[last]
op        := '=' | '!=' | '<' | '<=' | '>' | '>=' | 'has' | '~' | '=~'
             -- has: массив содержит элемент (точное равенство); ~: подстрока ТОЛЬКО для строк, на числе/массиве — ошибка компиляции предиката
value     := number | size | duration | 'string' | bare-word | macro
size      := number ('K'|'M'|'G') | number ('Ki'|'Mi'|'Gi') | number ('k'|'m') -- K/M/G — двоичные, как у ядра; Ki/Mi/Gi — то же, для манифестов Kubernetes; суффикс 'M' в контексте k8s.* — десятичный, как у Kubernetes
```

Правила вычислителя: значение `max` в `memory.max`, `pids.max` сравнивается как +∞; `cpu.max` разбирается в `{quota, period}`, доступ `cgroups[...].cpu.max.quota`; сравнение строки с числом — ошибка компиляции, а не `false`. Макросы: `@pid(name)` — PID процесса, найденного по `comm` в *исходном* PID-пространстве агента; `@host` — пространства имён процесса 1 исходного PID-пространства (то есть агента, а не шелла ученика); `@start` — снимок фактов из `needs` цели, который агент снимает при `op: 'attempt.start'` и хранит до конца попытки.

Примеры 2.3 переписать:

```
procs[cmd=bash][ns.pid!=@host.ns.pid].nspid[last]=1
cgroups[procs has @pid(stress-mem)].memory.max<=20M
units{'nginx.service'}.active=active && net{'host'}.listen[port=80]
```

Векторы `shared/checker/vectors/` должны содержать именно эти ловушки: PID 41 против 4126, `nspid [4126,12]`, `memory.max=max`.

### 7. MAJOR — Сборщик фактов на POSIX sh + `jq` в v86 не уложится в 0,3–1 с и 2 Гц, а опрос не увидит короткие процессы

**Где:** 1.4 «Служебный канал», 2.1, 2.5, 7 (фаза 0, пункт 2).

**Что не так.** v86 даёт порядка 1–2% нативной скорости на тяжёлом коде, а самая дорогая операция эмуляции — `fork`+`exec`. Скрипт, который каждые 500 мс обходит `/proc/*/ns/*` (8 ссылок × 30–40 процессов), `/sys/fs/cgroup` и вызывает `ip -j`, `ss`, `jq`, порождает сотни процессов за проход. На это уйдёт больше секунды машинного времени, и терминал ученика будет заметно тормозить. Хуже того, опрос пропускает процессы, которые живут меньше 500 мс, — а это именно то, что нужно объяснению «fork/exec/PATH» (R3, Linux) и дриллу «контейнер сразу завершается». Наконец, в `lab-alpine` шелл — BusyBox ash, в нём нет `PROMPT_COMMAND`, на котором 02 строит событие `cmd.done`, а от `cmd.done` зависят автоматические проверки яруса B (2.5).

**Исправление.**
- Сборщик фактов — один Go-пакет `shared/facts` (уже есть Go для `trainer-check`) с бинарниками `linux/386` (для v86, около 3–4 МБ, по 9p) и `linux/amd64|arm64` (ВМ). Он читает `/proc` и `/sys` сам, одним процессом, без `jq` и без порождения процессов; netlink — через `vishvananda/netlink`. Это и есть «один сборщик для B и C», только без 200 `fork` на проход. `facts.sh` оставить как читаемую справочную реализацию и для проверки на машинах ученика, где нельзя запускать бинарник (см. замечание 13).
- Режим `watch` — по событиям, а не опросом: proc connector (`CONFIG_CONNECTOR`, `CONFIG_PROC_EVENTS`, netlink `NETLINK_CONNECTOR`) даёт `fork`/`exec`/`exit` с PID и PPID в момент события — отсюда точные `proc.spawn`/`proc.exit` для объяснения «fork → exec» на настоящем ядре; inotify на `memory.events` в cgroup v2 (ядро шлёт уведомление об изменении файла) даёт `proc.exit{reason:'oom'}` без опроса; netlink `RTNLGRP_LINK`/`RTNLGRP_IPV4_IFADDR` — события интерфейсов. Опрос остаётся только для `cgroup.usage` (1 Гц).
- В `lab-alpine` ставить `bash` и запускать шелл ученика как `bash` с `PROMPT_COMMAND` из 02, либо использовать `PS1` с подстановкой команды (BusyBox ash это умеет при `ASH_EXPAND_PRMT`) — выбрать одно и записать.
- Бюджет фазы 0 переписать: «полный сбор фактов `procs,ns,cgroups,mounts,net` на 40 процессах ≤ 300 мс машинного времени; `watch` в покое — ≤ 3% CPU гостя; ни одного пропущенного `exec` на скрипте из 50 последовательных `/bin/true`».
- Крупные ответы (факты на десятки КБ) отдавать не побайтово через UART (`serial1-output-byte` — одно событие шины на байт), а файлом на 9p (`/run/trainer/out/<id>.json`, чтение через API 9p из JS) или через virtio-console; по `ttyS1` идёт только короткая строка `{"id":7,"ok":true,"file":"out/7.json"}`.

### 8. MAJOR — Конфигурация `dt-kernel` неполна для лабораторий 04 и для R6–R11

**Где:** 1.4 «Один движок, одно ядро, два корня».

**Что не так.** Список опций — объединение фрагментов 02 и 04, но в нём нет того, без чего мои же лаборатории и новые требования не работают:
- `CONFIG_TMPFS_XATTR` — корень гостя на 9p, поэтому верхний слой overlay и `pivot_root` в 04 живут в tmpfs `/c`. Без xattr на tmpfs overlay не сможет ставить `trusted.overlay.opaque` (opaque whiteout — шаг интерактива 2 и 3), а `setcap` из R6 не сможет записать `security.capability`. Поддержка xattr у 9p-сервера v86 не гарантирована, поэтому `setcap`/`getcap` в уроках — только на tmpfs, и это надо записать.
- `CONFIG_CGROUP_BPF` и `CONFIG_BPF_SYSCALL` — в cgroup v2 контроллер устройств реализован eBPF-программой; `crun` без них не применит `linux.resources.devices` (в лучшем случае предупреждение, в худшем — ошибка на `config.json` с правилами устройств).
- `CONFIG_IKCONFIG` — `IKCONFIG_PROC` от него зависит (в 04 оба указаны, в 09 только второй).
- Для Docker-подобного NAT и kube-proxy-lite (R9, гибрид): `BRIDGE_NETFILTER`, `NF_CONNTRACK`, `NETFILTER_XT_MATCH_CONNTRACK`, `NETFILTER_XT_MATCH_COMMENT`, `NETFILTER_XT_MATCH_STATISTIC`, `NETFILTER_XT_MATCH_MULTIPORT`, `NETFILTER_XT_MARK`, `NETFILTER_XT_TARGET_MASQUERADE`, `NETFILTER_XT_MATCH_ADDRTYPE`, `IP_NF_FILTER`, `IP_NF_NAT`; для бэкенда iptables-nft — `NFT_COMPAT`, `NFT_NAT`, `NFT_MASQ`, `NFT_CT`; `IP_VS` с `IP_VS_RR` (режим IPVS); `DUMMY` (`kube-ipvs0`, адрес DNS кластера).
- Для R8/R11 между узлами: `VLAN_8021Q`, `VXLAN`, `GENEVE`, `WIREGUARD`, `PACKET` (tcpdump), `TUN`.
- Для `watch` (замечание 7): `CONNECTOR`, `PROC_EVENTS`; для урока про давление памяти — `PSI`.
- Для фоновых узлов: `NO_HZ_IDLE`, `HZ_100` — иначе 4 простаивающих узла будят эмулятор 250–1000 раз в секунду каждый.
- Бэкенд `iptables` не зафиксирован: «`NF_TABLES` и iptables-legacy» не говорит, какой `iptables` вызывает ученик. Нужно одно решение — я предлагаю `iptables-nft` по умолчанию (так на Debian 12 и в текущих дистрибутивах; `iptables -V` печатает `(nf_tables)`) и `iptables-legacy` только в уроке, где их сравнивают.

**Исправление — заменить перечень в 1.4 ссылкой на файл и привести фрагмент целиком:**

```
# images/kernel/dt-kernel.fragment — поверх main/linux-lts/virt.x86.config
CONFIG_IKCONFIG=y
CONFIG_IKCONFIG_PROC=y
# изоляция и ограничения (R6)
CONFIG_NAMESPACES=y
CONFIG_UTS_NS=y
CONFIG_IPC_NS=y
CONFIG_PID_NS=y
CONFIG_NET_NS=y
CONFIG_USER_NS=y
CONFIG_CGROUPS=y
CONFIG_MEMCG=y
CONFIG_CGROUP_PIDS=y
CONFIG_CGROUP_SCHED=y
CONFIG_FAIR_GROUP_SCHED=y
CONFIG_CFS_BANDWIDTH=y
CONFIG_CGROUP_FREEZER=y
CONFIG_CGROUP_BPF=y
CONFIG_BPF_SYSCALL=y
CONFIG_PSI=y
CONFIG_SECCOMP=y
CONFIG_SECCOMP_FILTER=y
CONFIG_OVERLAY_FS=y
CONFIG_TMPFS=y
CONFIG_TMPFS_XATTR=y
CONFIG_TMPFS_POSIX_ACL=y
CONFIG_CONNECTOR=y
CONFIG_PROC_EVENTS=y
# сеть контейнеров и узлов
CONFIG_VETH=y
CONFIG_BRIDGE=y
CONFIG_BRIDGE_NETFILTER=y
CONFIG_VLAN_8021Q=y
CONFIG_VXLAN=y
CONFIG_GENEVE=y
CONFIG_WIREGUARD=y
CONFIG_DUMMY=y
CONFIG_TUN=y
CONFIG_PACKET=y
CONFIG_NETFILTER=y
CONFIG_NF_CONNTRACK=y
CONFIG_NF_NAT=y
CONFIG_NF_TABLES=y
CONFIG_NF_TABLES_INET=y
CONFIG_NFT_NAT=y
CONFIG_NFT_MASQ=y
CONFIG_NFT_CT=y
CONFIG_NFT_COMPAT=y
CONFIG_IP_NF_IPTABLES=y
CONFIG_IP_NF_FILTER=y
CONFIG_IP_NF_NAT=y
CONFIG_IP_NF_TARGET_MASQUERADE=y
CONFIG_NETFILTER_XT_MATCH_ADDRTYPE=y
CONFIG_NETFILTER_XT_MATCH_CONNTRACK=y
CONFIG_NETFILTER_XT_MATCH_COMMENT=y
CONFIG_NETFILTER_XT_MATCH_STATISTIC=y
CONFIG_NETFILTER_XT_MATCH_MULTIPORT=y
CONFIG_NETFILTER_XT_MARK=y
CONFIG_IP_VS=y
CONFIG_IP_VS_RR=y
CONFIG_IP_VS_NFCT=y
# v86
CONFIG_NET_9P=y
CONFIG_NET_9P_VIRTIO=y
CONFIG_9P_FS=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_NO_HZ_IDLE=y
CONFIG_HZ_100=y
# systemd (02)
CONFIG_DEVTMPFS=y
CONFIG_AUTOFS_FS=y
CONFIG_FHANDLE=y
CONFIG_INOTIFY_USER=y
```

Добавить приёмочный тест образа в CI: `zcat /proc/config.gz` сверяется с фрагментом; затем скрипт пробует каждую возможность — `unshare -Urpf --mount-proc true`, создание группы с `memory.max`/`cpu.max`/`pids.max`, overlay с opaque-каталогом на tmpfs, `setcap cap_net_bind_service+ep` на tmpfs, `crun run` с правилом устройств, `ip link add type vxlan|wireguard|veth|dummy`, `iptables -t nat -A … -m statistic`, `ipvsadm -A`. Падение любого пункта — красная сборка.

### 9. MAJOR — Не распределены последовательные порты: второй терминал «хост/контейнер» из 04 и `kubectl exec` (R7)

**Где:** 1.4 «Служебный канал», 1.5 «Интерфейс машины».

**Что не так.** В 04, 6.3, лаборатория «Контейнер своими руками» показывает два терминала одновременно: «внутри контейнера» (`ttyS0`) и «хост» (`ttyS2`). R7(c) требует сравнить `uname`/`ps` внутри и снаружи контейнера, гибрид (замечание 2) — отдельный терминал под `kubectl exec`. В 09 есть только `ttyS0` (ученик) и `ttyS1` (агент); `Machine.tty(name?)` принимает имя, но какие имена бывают — не сказано. В v86 доступны `uart1`, `uart2`, `uart3` (опции видны в `starter.js`), то есть место есть.

**Исправление — добавить в 1.4 таблицу:**

> | Порт | Назначение | Кто на нём |
> |---|---|---|
> | `ttyS0` | основной терминал ученика | `agetty --autologin` |
> | `ttyS1` | служебный канал (JSON) | `trainer-agent` / `dt-kubelet` |
> | `ttyS2` | второй терминал: «хост» в лабораториях контейнеров, `kubectl exec -it` в гибриде | `agetty` по требованию урока, иначе выключен |
> | `ttyS3` | резерв (`kubectl logs -f`, второй `exec`) | — |
>
> `Machine.tty('main' | 'host' | 'exec:<id>')`; движок показывает второй терминал рядом с первым с подписью, *где* находится шелл («хост», «внутри контейнера box», «под web-5f7, контейнер app»). Подпись берётся из фактов: пространства имён процесса шелла сравниваются с пространствами имён PID 1 машины.

### 10. MAJOR — Практика R7(c) «ВМ против контейнера» противоречит правилу «машина никогда не загружается с нуля»; раскадровки объяснения нет

**Где:** 1.4 «Загрузка»; связь с 04, 4.6 и D1.

**Что не так.** R7(c) требует замерить старт контейнера против загрузки второй ВМ v86 и показать, что браузерный Linux сам по себе ВМ (`dmesg`). В 09 правило: «машина никогда не загружается у ученика с нуля», и бюджеты памяти рассчитаны на одну машину. Нужно явное исключение, иначе сравнение будет «контейнер за 0,2 с против восстановления снимка за 2 с» — то есть неверное.

**Исправление.** В 1.4 после «Загрузки» добавить:

> **Исключение: лаборатория «Загрузить вторую машину».** Единственное место, где машина загружается у ученика с нуля: образ `lab-tiny` (наше ядро + initramfs с BusyBox, ≤ 6 МБ, 64 МБ гостя, без 9p) запускается во втором воркере холодной загрузкой с BIOS. Ученик видит в терминале второй машины сообщения ядра от первой строки и таймер; параллельно в первой машине выполняет `time crun run box` и `time unshare -fp --mount-proc sleep 0`. Бюджет: холодная загрузка `lab-tiny` ≤ 20 с на ноутбуке 2020 года, второй воркер освобождается сразу после замера. Факты: `env.boot = { kind: 'cold' | 'restored', ms }` — чтобы схема подписала «настоящая загрузка», а не «восстановление из снимка».
>
> **«Я — виртуальная машина».** Шаги: `dmesg | head -40` (BIOS SeaBIOS, эмулированные устройства), `cat /proc/cpuinfo` (модель процессора, которую сообщает эмулятор), `ls /sys/bus/virtio/devices`, `uname -m` (`i686`, а не архитектура ноутбука ученика); затем в той же машине `crun run box uname -r` — то же ядро. Точные строки, которые ищет проверка, фиксируются по золотой загрузке `dt-kernel` в CI, а не по памяти автора.

Раскадровка объяснения «Голое железо → ВМ → контейнеры → вложенность» (для 08 и блока 04; платформе нужны только модель и события, поэтому привожу её здесь — модель живёт в `sim.worker.ts` как чистая функция `stackModel(params) → {towers, counters, events}`):

> **Экран 1. Одна машина, одно приложение.** Слева башня из блоков снизу вверх: «Железо (CPU, память, диск, сеть)» → «Ядро Linux» → «Библиотеки» → «Приложение A». Счётчики справа: «Загрузка CPU 8%», «Память занята 1,2 из 64 ГБ», «Время запуска приложения: загрузка сервера 90 с». Ползунок «Число приложений» = 1. Клик по любому блоку — карточка «что это и кто его выбирает».
>
> **Экран 2. Тесно.** Ползунок «Число приложений» до 3: на одной башне появляются A, B, C; блок «Библиотеки» краснеет, на линии между B и «Библиотеки» подпись «нужен Python 3.9», между C и «Библиотеки» — «нужен 3.13». Счётчик «Конфликты версий: 1». Одна идея: общая система — общие зависимости.
>
> **Экран 3. Две башни рядом.** Слева — «ВМ»: Железо → Гипервизор → [ВМ1: Гостевое ядро → Библиотеки → A] [ВМ2: Гостевое ядро → Библиотеки → B]. Справа — «Контейнеры»: Железо → Ядро хоста → [Контейнер 1: Библиотеки → A] [Контейнер 2: Библиотеки → B]. Блоки «Гостевое ядро» есть только слева — подсвечены одним цветом ядра, как во всём курсе. Ползунок «Число приложений» (1–20) двигает обе башни одновременно. Счётчики под каждой: «Память на накладные расходы» (ВМ: n × 512 МБ гостевой ОС; контейнеры: n × ~5 МБ рантайма), «Старт приложения» (ВМ: загрузка гостя ~20–60 с; контейнер: < 1 с), «Плотность на сервере 64 ГБ». Цифры — из модели с параметрами в YAML и ссылкой на источник каждого параметра; рядом с каждым счётчиком строка, *почему* он изменился («+1 гостевое ядро = +512 МБ»).
>
> **Экран 4. Тумблер «Уязвимость в ядре».** Включение рисует трещину на блоке ядра. Слева трещина в «Гостевом ядре ВМ1» — красным подсвечивается только ВМ1, подпись на линии к гипервизору «граница ВМ: гипервизор». Справа трещина в «Ядре хоста» — подсвечиваются *все* контейнеры, подпись «граница контейнера: то же ядро». Счётчик «Затронуто приложений: 1 из n / n из n». Одна идея: изоляция ВМ сильнее, потому что ядро не общее.
>
> **Экран 5. «Сломай».** Кнопка «Убрать гипервизор» — левая башня рассыпается до «Железо», подпись «гостевые ядра некому запускать». Кнопка «Убрать ядро хоста» справа — рассыпаются все контейнеры, подпись «контейнер не приносит своего ядра».
>
> **Экран 6. Как сегодня.** Три башни, переключатель вкладками: «Контейнеры в облачных ВМ» (Железо → Гипервизор облака → Гостевое ядро → containerd → контейнеры), «Kubernetes на голом железе» (Железо → Ядро → kubelet + containerd → поды), «ВМ внутри Kubernetes» (Железо → Ядро → kubelet → под virt-launcher → QEMU/KVM → Гостевое ядро → приложение; подпись «KubeVirt, так устроены ВМ в Cozystack»). Ползунок «Число приложений» и тумблер уязвимости работают на всех трёх; счётчики пересчитываются, и каждая вкладка отвечает, *какая граница* защищает при уязвимости ядра.
>
> **Экран 7. А теперь по-настоящему.** Кнопка «Проверить на этой машине» открывает лабораторию выше: `dmesg` в v86, `uname -r` снаружи и внутри контейнера, холодная загрузка второй машины против `crun run`. Замеренные числа ученика подставляются в счётчики экрана 3 рядом с модельными.
>
> Анимация — только появление и исчезновение блоков, рост счётчиков и подсветка; степпер с шагами 1–7 листается вперёд и назад.

### 11. MAJOR — Нет механизма «изменил параметр — процесс пересчитался» для объяснений (R4); не определено, какое объяснение какой движок считает (R3)

**Где:** 1.3 «Ярус A» (протокол `ToSim`), 1.4 (`watch`).

**Что не так.** R4 требует, чтобы ползунки и тумблеры (реплики, лимит памяти, TTL, окно TCP) сразу пересчитывали процесс и показывали объяснение изменения, а шаги можно было листать назад. Степпер 08 сворачивает события шины, но кто порождает *новый* поток событий при другом параметре, не определено. Живая сессия v86 этого не умеет вовсе: настоящее ядро нельзя «перемотать» с другим `memory.max`. В протоколе `ToSim` нет операции «прогнать сценарий с параметрами, не трогая текущее состояние урока».

**Исправление.** В протокол 1.3 добавить:

```ts
| { op: 'whatif'; req: number; scenario: string; params: Record<string, number | string | boolean>;
    from?: 'start' | 'current'; until?: { event?: string; maxSimMs?: number } }
// ответ
| { op: 'whatif'; req: number; events: SimEvent[]; diff?: { param: string; from: unknown; to: unknown; why: Bi }[] }
```

`whatif` клонирует состояние симулятора (или берёт стартовое состояние сценария), подставляет параметры, прогоняет детерминированно до условия и возвращает события; живое состояние урока не меняется. Поле `diff.why` берётся из таблицы объяснений сценария (`explain_param:` в YAML: «memory.max 64M → 16M: процесс выделяет 32 МБ, ядро убивает его — событие oom_kill»). Правило в 1.3: **объяснения с параметрами всегда считаются на ярусе A; v86 — это «проверить на настоящем ядре» после объяснения, а не его движок.**

И добавить в 1.3 таблицу «кто считает объяснение» для процессов R3, которые касаются рантайма (по остальным блокам авторы дополнят):

> | Объяснение (R3) | Модель (параметры, «сломай») | Настоящее ядро (подтверждение) |
> |---|---|---|
> | Загрузка Linux | `bootsim` в Стенде: BIOS → загрузчик → ядро → initramfs → PID 1 → юниты; «сломай»: нет `init`, битый `fstab` | холодная загрузка `lab-tiny`, `dmesg`, `systemd-analyze` в `lab-debian` |
> | fork/exec/PATH | Стенд: дерево процессов; параметр `PATH`, «сломай»: убрать каталог из `PATH`, снять бит `x` | proc connector в v86 (замечание 7) — настоящие PID, PPID и `exec` |
> | Pipe | Стенд: буфер канала, параметр размера буфера, медленный читатель | `strace -f -e trace=pipe2,read,write` в v86 |
> | systemd перезапускает упавшую службу | Стенд: юнит, `Restart=`, `RestartSec=`, `StartLimitBurst=`; «сломай»: `Restart=no` | `lab-debian`, `kill -9` основного PID и `systemctl show -p NRestarts` |
> | OOM-kill в cgroup | dsim/Стенд: ползунки `memory.max`, размер выделения | `lab-alpine`, `memory.events: oom_kill` (inotify) |
> | `docker run` CLI → процесс | dsim «Расёмон» (04, 8): CLI → dockerd → containerd → shim → runc → ядро; «сломай»: остановить containerd, нет образа | `crun run` в v86 + `watch` (namespace/cgroup/mount события) |
> | `docker build` по слоям с кешем | dsim `build.ts`; тумблер «изменить файл N», «переставить COPY» | — (сборка — только модель; на ВМ D11 — настоящий BuildKit) |
> | `docker pull` по манифесту | реестр курса в SW: token → index → manifest → blobs; параметр «платформа», «сломай»: удалить blob | `curl` к тому же реестру из v86 |
> | `kubectl apply` через все компоненты | kube-lite | гибрид: появление настоящих процессов на узлах |
> | Планирование пода, rolling update | kube-lite: ползунки `replicas`, `maxSurge`, `maxUnavailable`, ресурсы узлов | гибрид |
> | Отказ узла | kube-lite: `node-monitor-grace-period`, `tolerationSeconds` | гибрид: остановка воркера узла |
> | Запрос через Service/Ingress/kube-proxy | kube-lite + netlab; тумблер iptables/IPVS/eBPF | гибрид: настоящий `iptables-save`, счётчики `pkts` |
> | Reconcile loop | kube-lite: желаемое слева, фактическое справа, контроллер посередине | гибрид + песочница контроллера (05, K14) |

### 12. MAJOR — Этап 3 Kubernetes (R12): Terraform/Ansible для заказа ВМ, показ стоимости и обязательная уборка не спроектированы

**Где:** 5.1–5.3, 5.6.

**Что не так.**
- R12: на этапе 3 ВМ заказываются Terraform'ом и настраиваются Ansible'ом. В 5.3 ВМ создаются кнопкой, и заказать их кодом ученик не может. Ученику без облачного аккаунта Terraform на этапе 3 вообще не на чем применить.
- R12: тренажёр показывает стоимость ВМ и проводит через обязательный шаг уборки. В 5.2 есть таблица цен, но нет счётчика «сколько стоит этот набор прямо сейчас» и нет шага уборки с проверкой. Для внешних облаков забытая ВМ — реальные деньги ученика.
- Вложенная сеть: Kubernetes с Cilium (VXLAN/Geneve) внутри ВМ, которые сами сидят в оверлейной частной сети провайдера, — двойная инкапсуляция. Если не согласовать MTU, кластер ученика соберётся, но большие ответы будут теряться, и ученик будет искать ошибку в своём кластере, хотя дело в сети провайдера.
- Этап 2 (один узел на своей машине или на одном VPS: k3s/minikube/kind) упомянут только в строке «Своя машина»; не сказано, что проверка там идёт без сервера, и как быть с ARM (Oracle Always Free, Mac с Apple Silicon) — образы курса должны быть multi-arch.

**Исправление — добавить 5.7 и поправить 5.3:**

> **5.3, дополнение. Заказ ВМ кодом.** На этапе 3 ученик заказывает ВМ сам, в своём облачном аккаунте: `terraform apply` с модулями курса для Yandex Cloud, Selectel, Hetzner и AWS из `infra/learner-modules/`, затем `ansible-playbook` по инвентарю из `terraform output`. Модули проверяются в CI командой `terraform validate` и раз в неделю настоящим `apply/destroy` в тестовом аккаунте курса. Ученик без облачного аккаунта поднимает три локальные ВМ на своём компьютере (Multipass или Vagrant), а заказ инфраструктуры кодом отрабатывает на облаке во вкладке (00 §6.13).
>
> **5.3, дополнение. MTU.** Образ ВМ этапа 3 и инструкция трека R3 задают MTU внутреннего CNI с запасом на две инкапсуляции; значение вычисляется в фазе 0 замером (`ping -M do -s <size>` между ВМ основных провайдеров и между локальными ВМ) и записывается в `providers.yaml` рядом с ценами. В треке R3 есть шаг «проверьте MTU» с объяснением, почему он нужен в любом облаке.
>
> **5.7. Стоимость и уборка.**
> 1. *Счётчик стоимости.* После первой проверки агентом тренажёр знает время создания узлов (`creationTimestamp` объектов Node, `providerID`) и тип ВМ (`node.kubernetes.io/instance-type`, если есть, иначе выбор ученика). Над чеклистом трека — строка «Ваш набор работает 2 ч 14 мин, это около 46 ₽ (Selectel, 3 × 2 vCPU / 4 ГБ, цена на 18.11.2026)»; цены из `providers.yaml`. Для локальных ВМ счётчика нет: они ничего не стоят.
> 2. *Шаг уборки обязателен.* Последний пункт каждого трека этапа 3 — «Удалите машины». Трек не отмечается пройденным, пока уборка не подтверждена. Подтверждение без сервера: ученик выполняет `terraform state list` и `terraform show -json` в каталоге трека и CLI провайдера (`yc compute instance list --format json`, `hcloud server list -o json`, `aws ec2 describe-instances --filters Name=tag:dt-track,Values=r3 --output json`) и вставляет вывод; проверка — пустой список ресурсов с тегом `dt-track=<трек>` и пустой state. Напоминание о неподтверждённой уборке показывается при каждом открытии курса, пока ученик её не подтвердит или явно не отметит «оставляю машины сознательно».
> 3. *Теги.* Все модули Terraform курса ставят метку `dt-track=<трек>` и `dt-owner=<id устройства>` — по ним работает и проверка уборки, и подсказка «вот что у вас ещё работает».
>
> **Этап 2.** Один узел (k3s, minikube или kind) на своей машине или одном VPS проверяется без сервера (режим 5.4 «без сервера»). Образы учебных приложений публикуются как multi-arch (`linux/amd64`, `linux/arm64`), агент и сборщик — под обе архитектуры.

### 13. MAJOR — Расхождение с 05 по верификатору и золотым записям

**Где:** 5.4 «Агент `trainer-check`», 1.3 «Правило правдивости».

**Что не так.**
- 05, 10.4: верификатор — читаемый `trainer-check.sh`, запуск `bash trainer-check.sh r2`, «а не `curl | bash`, чтобы ученик сначала прочитал, что запускает (это заодно урок безопасности)»; скрипт только читает. 09, 5.4: непрозрачный Go-бинарник на 6 МБ, установка `curl … && sudo install`, служба от root, исполнение подписанных проб и *внесение поломок*. Это разные продукты с разной моделью доверия, и в 09 не сказано, что решение 05 пересматривается и почему.
- 05: золотые записи на `kind` в GitHub Actions на каждый PR и раз в сутки kubeadm на ВМ; 09: «тяжёлые прогоны только на отдельном стенде курса». 09: kubeadm v1.36 в золотых записях; 05: OpenAPI-схемы v1.37 в kube-lite и R3 на v1.36 → R4 на v1.37.

**Исправление.** В 5.4 добавить:

> **Режимы и доверие (уточнение решения 05, 10.4).** Самопроверка на своих машинах остаётся такой, как в 05: читаемый скрипт `trainer-check.sh` (только чтение, текст на экране, запуск `bash trainer-check.sh r2`). Go-агент нужен только там, где результат кому-то предъявляется или где тренажёр сам вносит поломку: предъявляемые экзамены. Агент открыт (исходники в публичном репозитории курса), собирается воспроизводимо, а команда `trainer-check plan --track e` печатает, какие пробы и поломки он применит, с их исходным текстом, до запуска.

В 1.3: «Золотые записи Kubernetes: на каждый PR — `kind` (как в 05, это не тяжёлая нагрузка), раз в сутки — kubeadm на ВМ в тестовом облачном аккаунте курса. Версии: kube-lite и kind — v1.37; kubeadm — v1.36 и v1.37 (для R4)».

### 14. MAJOR — Расхождение с 01 по поведению наставника и формату контекста

**Где:** 4.5 «Подсказка для наставника», 2.4 (`hintLevel`), 4.7.

**Что не так.**
- 01, 14.2: лестница подсказок H1–H5, «готового решения нет ни на одной ступени». 09: `hintLevel: 0 | 1 | 2 | 3`, «3 — открыт ответ (reveals: true)», а в режиме `lab` нейросеть может дать команду решения после `n−1` подсказок. Это прямое противоречие решению андрагога.
- 01: до 120 слов; 09: до 150 слов для beginner.
- 01, 14.1: режимы урок / практика / свободная песочница / выходной билет, входная проверка, экзамен / повторение. 09: `learn`/`lab`/`explain-output`/`review`/`exam` — нет свободной песочницы, нет выходного билета в списке режимов «нейросеть выключена».
- 01, 14.4: контекст — JSON с `known_concepts: ["F01", "L17"]` (идентификаторы графа); 09: текстовые слои со словами «process, pid, namespace, pid-namespace». Модель должна получать идентификаторы и словоформы из `concepts.yaml`, иначе фильтр «не использовать невведённые» нечем проверить в `ai-evals`.
- 10, раздел 2: ответы `explain` на экзамене оценивает нейросеть ученика по рубрике. 09, 4.5: в режиме `exam` `ai.worker.ts` отклоняет все запросы. Нужен отдельный режим оценщика после сдачи.

**Исправление.**
- `hintLevel: 0 | 1 | 2 | 3 | 4 | 5` по H1–H5 из 01; поле `reveals` из 2.4 убрать; строку режима `lab` заменить на: «Следуй лестнице H1–H5 из 01, 14.2, по одной ступени за запрос; готовой команды решения не давай ни на одной ступени. Движок сверяет ответ с `solution_flags` и эталонной командой цели (в контекст они не передаются) и сворачивает совпадение».
- Лимит слов — 120, как в 01.
- Добавить режимы `sandbox` (свободная песочница: «объясняй и предлагай, что попробовать») и `forcing` (замечание 3); в строку `exam` добавить «выходной билет».
- Добавить режим `grade`: включается только после `exam.submitted`, получает ответ ученика и рубрику из 10, возвращает JSON с баллами и цитатами; вопросов ученика в этом режиме не принимает.
- Слой 2 подсказки формировать из `concepts.yaml`: `Уже введены: L17 «процесс» (процесс, процесса, process), D03 «пространство имён» (…)`; так `ai-evals` проверяет нарушения по тем же регулярным выражениям, что сборка.

---

## Мелкие

### 15. MINOR — Несовпадение названий сред

**Где:** 1.5 и 2.2. `Machine.kind: 'sim' | 'v86' | 'remote'`, а `Facts.env.kind` и `CheckResult.env`: `'sim' | 'v86' | 'vm'`; в `goals[].envs` — `[v86, vm]`. Выбрать одно (`vm`) везде.

### 16. MINOR — Устаревшие зависимости сервера

**Где:** 6.1. `nhooyr.io/websocket` передан компании Coder и развивается как `github.com/coder/websocket`. Go 1.25 после выхода Go 1.27 (август 2026) не получает исправлений безопасности (поддерживаются два последних выпуска) — указать Go 1.27.

### 17. MINOR — Несогласованность с 02 по агенту и ядру

**Где:** 1.4. В 02 агент называется `trainerd`, это bash-скрипт под systemd (`trainer-agent.service`), а в списке пакетов `lab-debian` есть `linux-image-686`. В 09 — POSIX sh `trainer-agent` по 9p и общее ядро `dt-kernel`. Записать в 1.4: «Решение 02 о пакете `linux-image-686` и имени `trainerd` заменено: ядро — `dt-kernel`, агент — `trainer-agent` (после замечания 7 — Go-бинарник `dt-facts` + обвязка)». То же для 04: `nsview` и `/opt/checks/*.sh` с полем `failed` (04, 6.5 и 11.3) переходят на `goals` 2.4 — я перенесу формат шага лаборатории 11.3 на `when`/`fail` в следующей версии 04.

### 18. MINOR — Сетевая карта v86 по умолчанию `ne2k`

**Где:** 1.4, 1.6. В `starter.js` `net_device` по умолчанию `{ type: "ne2k" }`. Явно записать `net_device: { type: "virtio" }` для всех образов (ядро с `VIRTIO_NET` уже собирается), иначе сеть между машинами будет медленнее, чем нужно.

### 19. MINOR — Часы гостя после восстановления снимка

**Где:** 1.4 «Загрузка». После `restore_state` часы гостя показывают момент снимка в CI. Ломаются уроки TLS (сертификат «ещё не действителен» или «просрочен»), `journalctl --since`, сроки аренды DHCP, а в гибриде — lease узла. Добавить: агент по `ttyS1` получает `{"op":"time","epoch":…}` сразу после восстановления и выставляет `date -s @…`; в фактах `env.clockSkewMs`.

### 20. MINOR — Пакеты образов для R6/R7

**Где:** 1.4, таблица образов. Для раздела «Как ядро изолирует и ограничивает» (R6) и «шести границ» (R7) в `lab-alpine` добавить: `bash` (замечание 7), `tini` (дрилл «PID 1 не передаёт сигналы, зомби»), `stress-ng` или свой `memhog` (OOM-дрилл), `procps` (`ps -eLf`, `ps -o pid,tid,stat`), `util-linux-misc` (`lsns`, `nsenter`), `libcap` (`capsh`, `getcap`, `setcap`), `tcpdump`. В `lab-debian` для L16 и нового раздела Linux: `libcap2-bin`, `stress-ng`, `util-linux` уже есть. Все пакеты доступны для `x86`/`i386` — проверить в CI сборкой образа.

### 21. MINOR — `navigator.deviceMemory` есть не во всех браузерах

**Где:** 1.4 «Устройства». `navigator.deviceMemory` реализован только в Chromium; в Firefox и Safari он `undefined`, а в Chromium значение округляется и ограничено сверху 8. Правило `< 4` с `undefined` даст `false` — машина запустится где угодно. Записать: «если `deviceMemory` не определён — v86 не запускается автоматически, а предлагается кнопкой с размером загрузки и памяти; многоузловые лаборатории — только по кнопке».

### 22. MINOR — v86 в воркере

**Где:** 1.4 «Устройства». v86 действительно поддерживает воркер (`starter.js` экспортирует `V86` в `self` через ветку `importScripts`), но это классический воркер, а не модульный; документ 08 и Vite по умолчанию собирают модульные. Записать в 6.1: «`v86.worker.ts` собирается как классический воркер (`worker.format: 'iife'`) либо грузит `libv86.mjs`, если он появится в вендорной версии; проверяется в фазе 0».

### 23. MINOR — Внутренние слова в интерфейсе

**Где:** 1.7 и 2.4. Строка тренажёра «где команда доступна по-настоящему (ярус B или C)» и подобные не должны показывать ученику «ярус A/B/C» — это слово архитектуры. Для ученика: «в симуляторе», «на настоящем Linux в браузере», «на настоящих машинах».

### 24. MINOR — Терминал как часть оформления (R5)

**Где:** 1.3, 6.1. R5 требует «красивый терминал». Платформе стоит зафиксировать: свой моноширинный шрифт с хостингом на нашем домене (CSP `font-src 'self'` иначе его не пустит), тема xterm из токенов палитры 08 (цвета ANSI согласованы с цветами смысла: ядро/пользовательское пространство), `fontLigatures` выключены (в выводе `->` и `!=` должны читаться буквально), отрисовка через WebGL-аддон xterm с откатом на DOM. Это одна строка в таблице 6.1 и исключает расхождения между блоками.

---

## Педагогика и уровни — коротко

- Новичок: ярус A должен закрывать весь путь блока без v86, а v86 — быть «доказательством» после объяснения (замечание 11). В 09 это верно по духу, но критерий готовности MVP («блоки Linux и „Внутри контейнера“ проходятся офлайн») стоит дополнить: «на телефоне и при отказе от v86 урок проходится до конца в записанном режиме; не пройдены только цели с `envs: [v86]`, и они помечены „выполните на компьютере“».
- Средний: главная ценность — «узнать знакомое на настоящем ядре» (DNAT своего `-p`, свои цепочки kube-proxy). Это даёт только гибрид (замечание 2); без него средний уровень видит ту же модель, что новичок.
- Опытный: стартует со ступени 3 лестницы документации (R2) — 09 должен дать ему корпус и режим `forcing` (замечание 3) с первого дня, иначе «опытный маршрут» на практике ничем не отличается от среднего, кроме скорости.
