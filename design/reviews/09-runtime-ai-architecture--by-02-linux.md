# Рецензия на 09 «Архитектура платформы» — от роли 02 (Linux)

Рецензент: старший Linux-инженер, автор 02-linux.md. Дата: 18.11.2026. Документ 09 не правился.

## Вердикт

Документ сильный там, где он сводит решения первой волны: три яруса, одно ядро `dt-kernel` и два корня, контракт «факты → предикаты», local-first-хранение, модель «свой ключ» для нейросети и подписанные результаты на ярусе C. Для первой волны он почти готов. С обязательными требованиями владельца R1–R12 он пока не совпадает, и в нескольких местах платформа в описанном виде их технически не выдержит. Главных проблем четыре. (1) Нет ни многомашинной сети на собственном виртуальном коммутаторе, ни гибридного Kubernetes (R11, R9, R10): этого нет ни в архитектуре, ни в плане работ, ни в бюджетах памяти. (2) Корень на 9p в v86 не поддерживает расширенные атрибуты (xattr). Это видно в исходниках v86, `lib/9p.js`: `Setxattr not supported`, `EOPNOTSUPP`. Значит, на корне не работают `setcap`/`getcap`, `security.capability` и overlayfs с upper на 9p, а без этого не собрать модуль «Как ядро изолирует и ограничивает» (R6) и часть контейнерных лабораторий (R7). (3) CSP страницы запрещает выполнять код ученика, а финальный шаг R10 («напишите маленький контроллер в браузере») без этого невозможен. (4) Лестница документации (R2) и среда для пошаговых объяснений (R3/R4) требуют от платформы конкретных компонентов: офлайн-корпус man-страниц, просмотрщик документации, события «куда смотрел», режим наставника `forcing`, детерминированный пересчёт процесса при смене параметра. Ничего из этого в документе нет. К этому добавляются фактические ошибки в сетевой части v86: смешанное содержимое (mixed content) в Worker, отсутствие UDP в Wisp, DNS через сторонний DoH. Есть дефекты в языке предикатов (ключи с точками, единицы `M`/`Mi`) и противоречия с 05/06/10 по агенту `trainer-check`. Ниже 30 замечаний: 4 блокирующих, 16 существенных, 10 мелких. Почти к каждому приложен готовый текст для вставки.

Степень: **BLOCKING** — без исправления требование владельца не выполнить или платформа не заработает как описано; **MAJOR** — ошибка или пробел, который всплывёт в разработке или у ученика; **MINOR** — точность, согласованность, редактура.

---

## Замечания

### 1. BLOCKING — нет многомашинной сети на своём коммутаторе и гибридного Kubernetes (R11, R9, R10)

**Где:** 0 «Решения коротко» (строки «Сеть ярусов B», «Docker и kubectl»), 1.4, 1.6, 1.7, 7, 8.

**Что не так.** В 1.6 многомашинная сеть сделана на бэкенде v86 `inbrowser` (BroadcastChannel). Он передаёт кадры Ethernet, но не даёт ни места, где их видно и можно визуализировать, ни управления линией (задержка, потери, VLAN), ни зеркального порта для `tcpdump` «на коммутаторе». R11 прямо требует *наш* JS-коммутатор, который показывается ученику. Бюджет 1.4 рассчитан на одну машину в 256 МБ и «две по 192 МБ», а R11 требует 3–4 узла по 64–128 МБ на ноутбуке и 1 узел на телефоне. В 1.7 и в таблице решений kubectl полностью симулируется, а R11 требует гибрид: control plane работает в kube-lite, на каждом узле v86 стоит маленький настоящий «kubelet», поды — настоящие процессы `crun` в настоящих namespaces, `kubectl exec` открывает настоящий контейнер, при гибели узла поды пересоздаются на других. Без этого невыполнимы и учебные задачи R9 на настоящем ядре («найдите в iptables, куда уходит пакет к ClusterIP», pod-to-pod через veth/bridge и VXLAN), и связка R10 «оператор — тот же цикл» на живых процессах.

**Технически это осуществимо.** В v86 сетевой адаптер подключается к шине событий: эмулятор отдаёт кадр событием `net0-send` и принимает кадр через `bus.send("net0-receive", frame)`. Это видно в `src/browser/fetch_network.js` (строки 61–63 и 395). Значит, свой адаптер, пересылающий кадры через `MessagePort` в коммутатор, пишется без форка v86.

**Готовый текст — новый раздел 1.8 «Несколько машин и свой коммутатор»:**

> **1.8. Несколько машин в одной вкладке и коммутатор `dt-switch`**
>
> Каждая машина v86 работает в своём Worker (`v86.worker.ts`, один экземпляр эмулятора на воркер). Сетевой адаптер машины — наш `SwitchPortAdapter`: подписывается на `net0-send` эмулятора и пересылает кадр в `MessagePort` порта коммутатора; входящие кадры передаёт эмулятору через `net0-receive`. Бэкенд `inbrowser` больше не используется.
>
> Коммутатор `dt-switch` — отдельный Worker (`switch.worker.ts`, ~15 КБ gzip). Он реализует настоящий L2:
> - таблица MAC → порт с обучением и старением (300 с, ползунок для объяснения), рассылка неизвестных одноадресных и широковещательных кадров во все порты;
> - VLAN 802.1Q: порт может быть access (`vlan=10`) или trunk; тег добавляется и снимается по-настоящему, поэтому `ip link add link eth0 name eth0.10 type vlan id 10` в госте работает (уровень intermediate каталога протоколов R8);
> - параметры линии на каждом порту — задержка (0–500 мс), потери (0–30 %), полоса (64 Кбит/с – без ограничения), «перерезать кабель». Это ползунки и переключатели «сломай» для объяснений R4;
> - зеркальный порт: кольцевой буфер последних 10 000 кадров с отметками времени; из него строятся живая схема (событие шины `net.frame`, см. замечание 10), просмотр «tcpdump на коммутаторе» и выгрузка `.pcap` для Wireshark;
> - порт-аплинк «домашний роутер»: к нему подключён адаптер v86 `fake_network` (Wisp или fetch, раздел 1.6). Так в лаборатории есть настоящий NAT-шлюз между учебной сетью и «интернетом» (карта R8).
>
> Топология лаборатории описывается в YAML урока:
> ```yaml
> topology:
>   switches: [{ id: sw1 }, { id: sw2 }]
>   machines:
>     - { id: node-1, image: lab-node, mem: 128, ports: [{ sw: sw1, ip: 10.0.0.11/24 }] }
>     - { id: node-2, image: lab-node, mem: 128, ports: [{ sw: sw1, ip: 10.0.0.12/24 }] }
>     - { id: rtr,    image: lab-node, mem: 64,  ports: [{ sw: sw1, ip: 10.0.0.1/24 }, { sw: sw2, ip: 10.1.0.1/24 }] }
>   uplink: { sw: sw1, via: wisp }        # необязательно
> ```
> Адреса задаются статически через cloud-init-подобный скрипт в 9p (`/opt/trainer/net.conf`) до восстановления снимка или DHCP-сервером `dnsmasq` на одной из машин — как требует урок.
>
> **Бюджеты** (порог приёмки фазы 0):
>
> | Конфигурация | Память гостя | Память вкладки | Где |
> |---|---|---|---|
> | 1 × `lab-debian` | 256 МБ | ≤ 600 МБ | ноутбук |
> | 3 × `lab-node` + коммутатор + kube-lite | 3 × 128 МБ | ≤ 1 ГБ | ноутбук 8 ГБ |
> | 4 × `lab-node` | 4 × 96–128 МБ | ≤ 1,2 ГБ | ноутбук 16 ГБ |
> | 1 × `lab-node` | 64–96 МБ | ≤ 300 МБ | телефон, только по кнопке |
>
> Снимок многомашинной лаборатории согласован: все эмуляторы останавливаются (`stop()`), сохраняются состояния всех машин, состояние коммутатора (таблица MAC, буфер) и kube-lite, после чего машины запускаются (`run()`). Восстанавливается тоже набор целиком.

**Готовый текст — новый раздел 1.9 «Гибридный Kubernetes»:**

> **1.9. Гибридный кластер: control plane в kube-lite, узлы в v86**
>
> Настоящий k8s/k3s в v86 невозможен: k3s собирается только под 64-битные платформы, а kubelet и containerd в 32-битной эмуляции потребляют сотни мегабайт и стартуют минутами. Поэтому кластер гибридный, и это прототипируется первым.
>
> - **Control plane** — kube-lite в `sim.worker.ts`: apiserver с хранилищем, scheduler, controller-manager (Deployment, ReplicaSet, node-lifecycle, EndpointSlice). Узлы для него — настоящие объекты Node, которые регистрирует агент.
> - **Узел** — машина v86 с образом `lab-node` (Alpine x86, `crun`, `iproute2`, `iptables`, `nftables`, `conntrack-tools`, `tcpdump`, `wireguard-tools`, `dnsmasq`; см. замечание 17) и агентом `dt-node`. Агент — статический бинарник Go под `GOARCH=386` (порог фазы 0: RSS ≤ 15 МБ; если не проходит — тот же протокол на C). Работает на `ttyS1` (служебный канал) и `ttyS3` (мультиплексор потоков `exec`/`logs -f`).
> - **Протокол kube-lite ↔ `dt-node`** (строки JSON по `ttyS1`):
>   ```
>   → {"op":"node.register"}                       ← {"node":{"name":"node-1","podCIDR":"10.244.1.0/24","capacity":{"cpu":"1","memory":"128Mi","pods":"8"}}}
>   ← {"op":"lease.renew","at":…}                  каждые 10 с времени симулятора
>   → {"op":"pod.run","uid":…,"spec":{…}}          агент: netns + veth + crun run -d
>   ← {"op":"pod.status","uid":…,"phase":"Running","containers":[{"name":"web","pid":812,"state":"running","restarts":0}]}
>   → {"op":"pod.kill","uid":…,"grace":30}         SIGTERM → ожидание → SIGKILL (настоящие сигналы)
>   → {"op":"svc.sync","services":[…],"endpoints":[…]}   агент пересобирает правила kube-proxy
>   → {"op":"exec","uid":…,"container":"web","cmd":["sh"],"tty":true,"stream":5}
>   ```
>   Потоки `exec` идут по `ttyS3` кадрами `[stream id][channel][len][bytes]`. Каналы те же, что в Kubernetes remotecommand: 0 stdin, 1 stdout, 2 stderr, 3 error, 4 resize. Внутри агент выполняет `crun exec -t <id> sh`.
> - **Под на узле — настоящий.** Агент создаёт `ip netns add pod-<uid8>`, пару veth (`veth<uid8>` в корне, `eth0` в поде), подключает корневой конец к мосту `cni0` (10.244.N.1/24) и запускает `crun run -d` с bundle. Rootfs — overlay: lower — распакованный образ из `/opt/images/<digest>/rootfs` (на отдельном ext4-диске `hdb`, см. замечание 2), upper и work — tmpfs. Журнал пишется в настоящем формате CRI `/var/log/pods/<ns>_<pod>_<uid>/<container>/0.log` (`2026-11-18T10:00:00.000000000Z stdout F …`), и `kubectl logs` читает именно его. Лимиты пода → `memory.max`, `cpu.max`, `pids.max` в `/sys/fs/cgroup/kubepods/pod<uid>/<container>`, поэтому `OOMKilled` берётся из настоящего `memory.events`, а не из модели.
> - **Сеть между узлами** — переключатель режима (виден на схеме): `routes` — агент прописывает `ip route add 10.244.2.0/24 via 10.0.0.12` (как host-gw); `vxlan` — `ip link add vxlan0 type vxlan id 42 dev eth0 dstport 4789` и FDB-записи на соседей. Пакет пода виден на коммутаторе в обоих режимах: во втором — с внешними заголовками VXLAN. Это и есть анимация R9 «пакет через узлы», только собранная из настоящих кадров.
> - **Service — настоящие правила.** `dt-node` воспроизводит цепочки kube-proxy в режиме iptables с теми же именами и структурой:
>   ```
>   -A PREROUTING -m comment --comment "kubernetes service portals" -j KUBE-SERVICES
>   -A OUTPUT     -m comment --comment "kubernetes service portals" -j KUBE-SERVICES
>   -A KUBE-SERVICES -d 10.96.12.7/32 -p tcp -m comment --comment "shop/web:http cluster IP" --dport 80 -j KUBE-SVC-<hash16>
>   -A KUBE-SVC-<hash16> -m statistic --mode random --probability 0.33333333349 -j KUBE-SEP-<hashA>
>   -A KUBE-SVC-<hash16> -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-<hashB>
>   -A KUBE-SVC-<hash16> -j KUBE-SEP-<hashC>
>   -A KUBE-SEP-<hashA> -p tcp -j DNAT --to-destination 10.244.1.5:8080
>   ```
>   Режим nftables (основной в 05, решение 5) строится через `numgen random mod N vmap`. ClusterIP не висит ни на одном интерфейсе: `ip a` на узле его не показывает, но `iptables-save -t nat | grep 10.96.12.7` находит. Здесь и проходит упражнение R9 (проверка — замечание 8, пример `drill-k8s-clusterip`). Чтобы обращение из пода к Service через мост проходило через netfilter, агент включает `br_netfilter` и `net.bridge.bridge-nf-call-iptables=1`; переключатель «сломай» снимает этот флаг, и ученик видит, как перестаёт работать hairpin.
> - **DNS кластера.** Настоящий CoreDNS (Go, ~50 МБ RSS) в 128 МБ узла не помещается. Роль CoreDNS на `10.96.0.10` выполняет `dnsmasq` на node-1, а записи `<svc>.<ns>.svc.cluster.local` агент генерирует из Services. Схема прямо подписывает: «в роли CoreDNS — dnsmasq; `resolv.conf`, `search`, `ndots:5` и сами запросы настоящие». В поде настоящий `/etc/resolv.conf`: `nameserver 10.96.0.10`, `search <ns>.svc.cluster.local svc.cluster.local cluster.local`, `options ndots:5`. Учебная находка для опытных: резолвер musl в Alpine-подах перебирает search-домены не так, как glibc, и это видно в `tcpdump` на коммутаторе.
> - **Гибель узла.** Кнопка «выключить узел» завершает Worker машины. kube-lite перестаёт получать продление Lease; через `node-monitor-grace-period` (по умолчанию 50 с начиная с v1.32, раньше было 40 с) узел становится `NotReady`, получает taint `node.kubernetes.io/unreachable:NoExecute`, а поды выселяются через `tolerationSeconds` 300 с. Ползунок «скорость времени» ×1/×10/×60 сжимает ожидание. В тексте и на схеме говорится «ReplicaSet создал новый под на node-2», а не «под переехал»: под не переезжает, вместо него создаётся новый с новым UID и IP.
> - **Время.** Lease и задержки считаются по часам симулятора, а не гостя: после восстановления снимка часы гостя прыгают.
>
> **Фаза 0, пункт 5 (новый):** два узла `lab-node` по 128 МБ + kube-lite; `kubectl apply` Deployment на 3 реплики → три процесса `crun` видны в `ps` узлов; `curl` с node-1 на ClusterIP отвечает с пода на node-2; `kubectl exec -it` открывает `sh` в настоящем контейнере; выключение node-2 → поды пересоздаются на node-1. Решение «го/нет» по памяти и по времени старта пода (порог ≤ 3 с).

В план v1 (раздел 7) добавить `dt-switch`, `lab-node`, `dt-node`, гибридный режим kube-lite (~8–10 ч/н). Без этого R11 не выполняется.

---

### 2. BLOCKING — корень на 9p не поддерживает xattr: не работают `setcap`, file capabilities и overlay с upper на корне (R6, R7)

**Где:** 1.4 (таблица образов, «корень … 9p»), 1.5 (`files.put` в 9p), 8 (рисков нет).

**Что не так.** В сервере 9p из v86 расширенные атрибуты не реализованы: `lib/9p.js`, ветки `txattrcreate` (case 32) и `xattrwalk` (case 30), а запись в xattr-fid отвечает `SendError(tag, "Setxattr not supported", EOPNOTSUPP)` (строки около 662 и 858 текущего master). Последствия для R6/R7:
- `setcap cap_net_bind_service=+ep ./srv` и `getcap` хранят возможности в `security.capability`, поэтому на корне 9p ученик получит `Operation not supported`. А в R6 это обязательный пункт («capabilities: capsh, getcap/setcap»);
- `setfacl` на ярусе B (это 02, L5 «для опытного») по той же причине не работает;
- overlayfs не примет 9p как upperdir: для `trusted.overlay.*` нужны xattr. Документ 04 это уже учёл и выносит overlay в tmpfs `/c`, но 09 этого не фиксирует как платформенное ограничение. Для гибридных узлов из замечания 1 upper тоже нужно держать на tmpfs;
- `ls -l /usr/bin/ping` в Debian покажет ping без capability, хотя на настоящем Debian 12 `getcap /usr/bin/ping` выдаёт `cap_net_raw=ep`. Урок «почему обычный пользователь может пинговать» на 9p лжёт.

**Исправление (текст для 1.4, после таблицы образов):**

> **Корень и диски.** 9p не поддерживает расширенные атрибуты (`EOPNOTSUPP` на `setxattr`), поэтому всё, что опирается на xattr, живёт не на 9p:
> - `lab-debian` и `lab-node` получают второй диск `hdb` — ext4-образ на 256 МБ, монтируется в `/srv/lab`. На нём упражнения с `setcap`/`getcap`, ACL, overlay lower, распакованные образы для гибридных узлов. Блоки образа загружаются лениво (`async: true`), а изменённые блоки должны попадать в `save_state` — проверяется на фазе 0;
> - upper и work для overlay всегда на tmpfs (`mount -t tmpfs tmpfs /c`), как в 04, 6.1;
> - у бинарников, которым в настоящем Debian выданы file capabilities (`/usr/bin/ping`), копия лежит на `hdb`, и урок R6 ссылается на неё. Для экзамена E2 из 02 корень и так ext4 на `hda`;
> - если на фазе 0 `save_state` с `hdb` не укладывается в бюджет 40 МБ, запасной вариант — патч сервера 9p в нашем вендоринге v86 с хранением xattr в таблице inode (около 60 строк, отправить апстриму).

В 8 «Риски» добавить строку: «9p без xattr → отдельный ext4-диск `hdb`; проверка на фазе 0».

---

### 3. BLOCKING — модуль «Как ядро изолирует и ограничивает» должен идти в блоке Linux на ярусе B, а платформа раздаёт эти темы только контейнерному образу (R6)

**Где:** 1.4, таблица образов: `lab-debian` — «Linux L8–L16…», `lab-alpine` — «cgroups, overlay, `nsenter`, DNAT»; 7, критерий MVP «блоки Linux (ярус A)».

**Что не так.** По R6 процессы и потоки, namespaces, cgroups v2 с OOM-упражнением, capabilities, mount/chroot/overlayfs и seccomp на уровне идеи вводятся в блоке Linux как фундамент. По 09 они живут только в `lab-alpine` урока контейнеров, а критерий MVP для Linux — «ярус A». Это ломает порядок R6 и R1(a): блок контейнеров должен опираться на уже введённое, а не вводить его сам. Граф 01 тоже нужно поправить (D03 и D04 сейчас в блоке D). Это вне 09, но платформа должна обеспечить среду.

**Исправление.**
1. В таблицу 1.4 для `lab-debian` дописать уроки: «L17 (новый модуль 02) — потоки, namespaces, cgroups v2, capabilities, mount/chroot/overlay, seccomp; упражнение OOM-kill». На Debian есть systemd, который сам владеет деревом cgroup, и это полезно: ученик видит и ручную группу `/sys/fs/cgroup/lab`, и `systemd-run --scope -p MemoryMax=20M`, и `systemctl set-property … CPUQuota=50%`.
2. Пакеты, которых нет в списке 02, 1.3 (ошибка моего документа, исправлю в 02, но платформа должна знать о них в образе): `libcap2-bin` (`capsh`, `getcap`, `setcap`), `crun` (есть в bookworm для i386), `stress-ng`, `nftables`, `iptables`, `tcpdump`, `conntrack`, `wireguard-tools`, `bridge-utils` не нужен (хватает `ip link … type bridge`).
3. Конфигурация ядра в 1.4 перечислена неполно («`NAMESPACES`, `USER_NS`, `MEMCG`, …»). Для R6–R9 и гибрида нужен явный фрагмент. Готовый текст `images/kernel/fragments/dt.config`:
   ```
   # namespaces / cgroups v2
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
   CONFIG_CPUSETS=y
   CONFIG_CGROUP_BPF=y          # в cgroup v2 контроль устройств только через eBPF; нужен crun и systemd DeviceAllow=
   CONFIG_BPF_SYSCALL=y
   CONFIG_PSI=y                 # memory.pressure для объяснения «давление памяти до OOM»
   # seccomp / caps
   CONFIG_SECCOMP=y
   CONFIG_SECCOMP_FILTER=y
   # fs
   CONFIG_OVERLAY_FS=y
   CONFIG_TMPFS=y
   CONFIG_TMPFS_XATTR=y
   CONFIG_EXT4_FS=y
   CONFIG_EXT4_FS_POSIX_ACL=y
   CONFIG_EXT4_FS_SECURITY=y
   # net: виртуальные интерфейсы
   CONFIG_VETH=y
   CONFIG_BRIDGE=y
   CONFIG_BRIDGE_NETFILTER=y
   CONFIG_VLAN_8021Q=y
   CONFIG_VXLAN=y
   CONFIG_WIREGUARD=y
   CONFIG_TUN=y
   CONFIG_DUMMY=y
   CONFIG_PACKET=y              # tcpdump
   # netfilter: docker -p, kube-proxy iptables и nftables
   CONFIG_NETFILTER=y
   CONFIG_NF_CONNTRACK=y
   CONFIG_NF_NAT=y
   CONFIG_NETFILTER_XT_MATCH_ADDRTYPE=y
   CONFIG_NETFILTER_XT_MATCH_COMMENT=y
   CONFIG_NETFILTER_XT_MATCH_CONNTRACK=y
   CONFIG_NETFILTER_XT_MATCH_MARK=y
   CONFIG_NETFILTER_XT_MATCH_MULTIPORT=y
   CONFIG_NETFILTER_XT_MATCH_STATISTIC=y   # балансировка KUBE-SVC
   CONFIG_NETFILTER_XT_TARGET_MASQUERADE=y
   CONFIG_IP_NF_IPTABLES=y
   CONFIG_IP_NF_NAT=y
   CONFIG_IP_NF_FILTER=y
   CONFIG_NF_TABLES=y
   CONFIG_NF_TABLES_INET=y
   CONFIG_NFT_NAT=y
   CONFIG_NFT_CT=y
   CONFIG_NFT_NUMGEN=y          # kube-proxy nftables
   CONFIG_NFT_COMPAT=y
   # v86
   CONFIG_NET_9P=y
   CONFIG_NET_9P_VIRTIO=y
   CONFIG_9P_FS=y
   CONFIG_VIRTIO_NET=y
   CONFIG_VIRTIO_CONSOLE=y
   # урок
   CONFIG_IKCONFIG=y
   CONFIG_IKCONFIG_PROC=y
   ```
   Валидатор CI: `scripts/kconfig-check` после `make olddefconfig` сверяет, что каждая строка фрагмента осталась `=y`. Иначе Kconfig молча выкидывает опцию, когда не хватает зависимости.
4. В Alpine без systemd cgroup2 сама собой не настроится. В `lab-alpine` и `lab-node` при загрузке нужен скрипт: `mount -t cgroup2 none /sys/fs/cgroup` (если ещё не смонтирована) и `echo "+cpu +memory +pids" > /sys/fs/cgroup/cgroup.subtree_control`. Иначе файла `memory.max` в дочерней группе не будет, и упражнение 2.4 `g-mem-limit` не пройти. Для этого же случая нужна ветка `fail` (готовый текст — в замечании 8).

---

### 4. BLOCKING — CSP запрещает выполнять код ученика, а R10 требует «написать маленький контроллер в браузере»

**Где:** 6.4, заголовки CSP (`script-src 'self' 'wasm-unsafe-eval'`, `frame-src 'none'`, Trusted Types).

**Что не так.** Финальная часть R10: ученик пишет маленький контроллер, запускает его против kube-lite и видит, что оператор — это тот же цикл сверки для CRD. Для этого нужно выполнить код, которого нет на сервере. При текущей CSP закрыты `eval`/`new Function` (нет `'unsafe-eval'`), iframe-песочница (`frame-src 'none'`), а `blob:`-воркер с кодом ученика упрётся в `script-src 'self'`: `worker-src blob:` разрешает источник воркера, но скрипты внутри по-прежнему проверяются политикой. Ослаблять CSP на всей странице нельзя: это главный рубеж защиты ключа (4.4, пункт 1).

**Исправление (текст в 1.3 и 6.4):**

> **Код ученика.** Код, который пишет ученик (контроллер в уроке K-reconcile, R10), выполняется интерпретатором QuickJS, собранным в WebAssembly (`quickjs-emscripten`, MIT; версия закрепляется на фазе 0). Интерпретатор работает в отдельном Worker `usercode.worker.ts` без доступа к сети и к IndexedDB. Это разрешено текущей политикой (`'wasm-unsafe-eval'`): для браузера это wasm-модуль, а не `eval`. Наружу видно только API kube-lite через `MessagePort`:
> ```js
> // то, что видит ученик
> export async function reconcile(req, api) {
>   const cr = await api.get('Greeting', req.namespace, req.name);
>   if (!cr) return;                                   // объект удалён — нечего сверять
>   const cm = await api.get('ConfigMap', req.namespace, cr.metadata.name);
>   const want = { message: `Hello, ${cr.spec.name}` };
>   if (!cm) return api.create('ConfigMap', { metadata: { name: cr.metadata.name, namespace: req.namespace,
>                    ownerReferences: [api.ownerRef(cr)] }, data: want });
>   if (cm.data.message !== want.message) return api.patch('ConfigMap', cm, { data: want });
> }
> api.watch('Greeting', reconcile); api.watch('ConfigMap', reconcile, { owner: 'Greeting' });
> ```
> Ограничения: 50 мс CPU на вызов (`setInterruptHandler`), 16 МБ памяти, не больше 100 вызовов API в секунду (иначе схема показывает «контроллер в бесконечном цикле»). Это и есть урок: оператор, который сам себя будит своими изменениями. Структура функции `reconcile` повторяет `Reconcile(ctx, req)` из controller-runtime, поэтому мост к пет-проекту на Go (05, R5/K14) — построчное сопоставление двух текстов на одном экране.

CSP не меняется. Добавить пункт в фазу 0: «QuickJS-wasm в воркере под текущей CSP и Trusted Types; размер ≤ 500 КБ gzip, загрузка только в уроке».

---

### 5. MAJOR — `fetch`-бэкенд v86 в Worker упрётся в смешанное содержимое; подмена адреса через Service Worker не сработает

**Где:** 1.6, таблица: «`sources.list` указывает на `http://apt.lab/`, Service Worker переписывает адрес»; «`docker pull/push` … перехватывает тот же Service Worker»; 1.4 «Выполнение v86 — в выделенном Worker».

**Что не так.**
1. В `fetch_network.js` v86 повышение `http:` → `https:` срабатывает только при `typeof window !== "undefined"` (строки 161–164). В Worker `window` нет, поэтому `fetch("http://apt.lab/…")` из воркера страницы, открытой по HTTPS, браузер заблокирует как mixed content ещё до Service Worker. А в 1.4 v86 как раз запускается в воркере.
2. Даже в основном потоке `http://apt.lab/` превратится в `https://apt.lab/`. Service Worker его перехватит (запросы к чужим доменам из контролируемого клиента он видит), но это хрупко, и в тексте об этом ничего нет.
3. `docker pull` из гостя к `registry.trainer.local`: в v86 по замыслу самого 09 нет `dockerd` («курс на это не опирается»), а клиент реестра по умолчанию ходит по HTTPS. Через fetch-бэкенд, который понимает только HTTP/1.x, HTTPS из гостя не пройдёт. Строку таблицы нужно убрать или переписать на `skopeo copy --src-tls-verify=false docker://registry.trainer.local/...` по HTTP.

**Исправление.** У адаптера v86 подменяемое поле `this.fetch = (...args) => fetch(...args)` (строка 53) — им и пользуемся:

> Адаптер `fetch` получает нашу функцию `fetch`, которая переписывает адрес до вызова браузера: `http://apt.lab/<путь>` → `https://cdn.<домен>/mirror/debian/<путь>`, `http://apk.lab/` → `…/mirror/alpine/`, `http://registry.lab/v2/` → обработчик реестра (тот же код, что в SW, вызывается напрямую из воркера через общий модуль, без сетевого запроса). Любой другой адрес получает ответ `502` с телом «в этой лаборатории интернет выключен» — ученик видит понятную ошибку `curl`, а не зависание. HTTPS из гостя через `fetch`-бэкенд невозможен (он разбирает HTTP-запрос в открытом виде); где урок требует TLS к внешнему миру — бэкенд `wisp`.

---

### 6. MAJOR — Wisp в v86 не передаёт UDP, DNS идёт через сторонний DoH, а белый список по именам на релее не проверить

**Где:** 1.6, «Wisp-релей» и пункт 1 списка мер («`1.1.1.1:53`, `8.8.8.8:53`»; «`curl` и `dig` к настоящему миру»).

**Что не так.**
1. В `docs/networking.md` v86 прямо сказано: «This WISP implementation does not support UDP, only TCP». Гостевой DNS-запрос (UDP 53) по любому адресу перехватывает `fake_network.js` (`handle_fake_dns`) и отвечает сам через DoH. По умолчанию это `DEFAULT_DOH_SERVER = "cloudflare-dns.com"` (строка 58), и запрос уходит из браузера ученика к Cloudflare в обход нашего релея. Отсюда:
   - `dig @8.8.8.8 example.com` получит ответ, синтезированный эмулятором, а не от 8.8.8.8. TTL, флаги и `SERVER:` в выводе не те, `dig +trace` ничего не трассирует. Для урока DNS (R3, R8) это прямая неправда на экране;
   - пункты белого списка `1.1.1.1:53` и `8.8.8.8:53` бессмысленны для UDP. Для TCP (`dig +tcp`) они работают, но этого никто не узнает;
   - обещание приватности («наш сервер …, сторонних запросов нет») нарушается: каждый DNS-запрос гостя уходит к Cloudflare.
2. Гость подключается к IP, а не к имени: Wisp-клиент v86 передаёт релею адрес, который гость получил из DNS. Белый список по именам (`deb.debian.org` за Fastly, IP меняются) на релее проверить нельзя.

**Исправление (текст в 1.6):**

> **DNS машин с выходом в интернет.** Адаптер v86 получает `doh_server: "<домен>/api/doh"`, и это наш DoH в `dt-api`. Он резолвит только имена из белого списка, а остальным отвечает `NXDOMAIN` с комментарием в TXT. Каждый выданный адрес запоминается за токеном сессии на время TTL. Wisp-релей пропускает соединение, только если адрес назначения был выдан этому токену нашим DoH, а порт входит в 53/80/443. Так белый список по именам действительно работает, и ни один запрос не уходит к сторонним серверам.
>
> **Честность вывода.** UDP наружу нет: на `dig @<любой адрес>` отвечает эмулятор через наш DoH. В уроках, где важен путь запроса (рекурсия, `+trace`, TTL, кеш), используется только `lab-net`: там корневой, TLD- и авторитативный серверы и резолвер — настоящие демоны на одной машине. В уроках с выходом в интернет над терминалом одна строка: «DNS в этой машине отвечает тренажёр; чтобы увидеть настоящую рекурсию, откройте лабораторию «Мини-интернет»».

---

### 7. MAJOR — агент на POSIX sh с опросом `/proc` дважды в секунду не уложится в скорость v86

**Где:** 1.4, «Служебный канал», режим `watch` («опрашивает `/proc/*/ns/*`, `/sys/fs/cgroup` и `ip -j link` раз в 500 мс»); фаза 0, пункт 2 («факты за ≤ 1 с, `watch` 2 Гц»).

**Что не так.** v86 на коде ядра и при порождении процессов работает примерно на 1–2 % от нативной скорости (это признано в 1.2), а каждый `fork+exec` в госте стоит миллисекунды. Срез `ns` на sh: для каждого из ~40 процессов `lab-debian` нужно 8 вызовов `readlink`, то есть ~320 процессов. Плюс `jq` для сборки JSON и `ip -j link`. Получаются сотни процессов на срез, и при 2 Гц агент сам займёт процессор гостя: терминал ученика начнёт тормозить, а `top` в уроке L8 покажет агента первой строкой. Вдобавок 02, 4.2 описывает `trainerd` на bash под systemd, а 09 — POSIX sh из 9p. Это нужно свести.

**Исправление (текст в 1.4):**

> Сбор фактов и `watch` выполняет маленькая статическая программа `dt-probe` (C, musl, i386, ≤ 100 КБ, приходит по 9p вместе с `facts.sh`). За один проход она читает `/proc/<pid>/{stat,status,ns/*,cgroup,task}`, `/sys/fs/cgroup/**/{memory.max,memory.current,memory.events,pids.max,pids.current,cpu.max,cpu.stat,cgroup.procs}`, `/proc/self/mountinfo` и netlink (`RTM_GETLINK/ADDR/ROUTE`) и печатает готовый JSON. Порождения процессов при этом нет. `facts.sh` остаётся для ВМ яруса C, где скорость не важна, и для тех областей, где нужна сама утилита (`systemctl show`, `iptables-save`, `crun list`). Его вывод сверяется с выводом `dt-probe` на общих векторах.
>
> Порог фазы 0: срез `procs+ns+cgroups` ≤ 150 мс времени гостя; `watch` 2 Гц занимает ≤ 5 % CPU гостя (по `/proc/<pid>/stat` самого агента). Агент скрыт из учебных срезов (`procs` без PID агента), но виден в `ps` с понятным именем `trainer-agent` и описан одной фразой в уроке L8. Ученик не должен думать, что это вирус.
>
> Опрос пропускает короткоживущие namespaces и процессы. Для объяснений «fork/exec», «конвейер» и «перезапуск службы» (замечание 10) события берутся не из опроса, а из трассировки: `strace -f -ttt -e trace=process,pipe2,dup2,execve -o /run/trainer/trace` по кнопке «записать», с разбором в события шины.

---

### 8. MAJOR — язык предикатов: ключи с точками, сравнение массивов, единицы памяти, неопределённые макросы

**Где:** 2.3 (грамматика и примеры), 2.4 (`keep`, `@start`).

**Что не так.**
1. `path := segment ('.' segment)*`, но ключи фактов сами содержат точки: `memory.max`, `memory.events`, `nginx.service`, `metadata.name`. Пример `cgroups[…].memory.max<=20M` по грамматике разбирается как `memory` → `max`.
2. `units[nginx.service].active` не подходит под `filter := '[' field op value ']'`: в нём нет операции. `units` — это словарь, а не массив, и нужен синтаксис выбора по ключу.
3. `procs[cmd=bash][ns.pid!=@host.ns.pid][nspid~1]`: `~` — это подстрока, а `nspid` — массив чисел. `~1` совпадёт с PID 1, 10, 41, 100… Проверка «шелл — PID 1 в своём namespace» пройдёт ложно: у bash во вложенном pid-ns с `NSpid: 4126 12` подстрока «1» есть.
4. Единицы: `20M` — это 20·2²⁰ (так ядро разбирает `echo 20M > memory.max`, функция `memparse`) или 20·10⁶ (так Kubernetes понимает `memory: 20M`)? Грамматика даёт `'20M', '1Gi'` без определения. Для цели «≤ 20M» ученик, записавший `20000000`, пройдёт или нет в зависимости от реализации, и TS и Go разойдутся.
5. `cgroups[…].memory.max<=20M`, когда в файле строка `max`: сравнение строки с размером не определено. А это как раз ветка `fail` «лимит не задан».
6. `@start.pid(stress-mem)` в `keep` не определён: нигде не сказано, что платформа сохраняет факты на старте попытки.

**Исправление — заменить грамматику и примеры в 2.3:**

```
predicate := disj
disj      := conj ('||' conj)*
conj      := unary ('&&' unary)*
unary     := '!' unary | '(' predicate ')' | term
term      := path (op value)?                    -- без op: «существует хотя бы один»
path      := step ('.' step)*
step      := ident filter* | '`' key '`' filter* | '#' | 'first' | 'last'
key       := любой текст без '`'                  -- `memory.max`, `nginx.service`
filter    := '[' field op value ']' | '[' '`' key '`' ']'   -- второе: выбор по ключу словаря
field     := path                                 -- относительный путь внутри элемента
op        := '=' | '!=' | '<' | '<=' | '>' | '>=' | '~' | '=~' | 'in'
value     := number | size | duration | 'string' | bare-word | '@' macro
size      := number ('K'|'M'|'G') | number ('Ki'|'Mi'|'Gi') | number ('k'|'M'|'G')'B'?
```

Семантика размеров (одинакова в TS и Go, тестовые векторы обязательны): `Ki/Mi/Gi` = 2¹⁰/2²⁰/2³⁰; `K/M/G` без `i` = **как у ядра**, 2¹⁰/2²⁰/2³⁰, если путь лежит в `cgroups.*`, и **как у Kubernetes**, 10³/10⁶/10⁹, если путь лежит в `k8s.*`. Валидатор контента выдаёт предупреждение на `M` без `i` и предлагает автору писать `Mi`. Сравнение размера со строкой `max` даёт `false` для `<`, `<=`, `=` и `true` для `>`, `>=`, `!=`.

Макросы: `@host.ns.<kind>` — inode namespace процесса 1 хоста; `@pid(<cmd>)` — PID первого процесса с таким `cmd` в текущих фактах; `@start.<path>` — тот же путь в фактах, снятых в момент `attempt.start`. Платформа обязана сохранять стартовые факты области `needs` при начале каждой попытки (ярус A/B — в IndexedDB рядом с `CheckResult`, ярус C — на стороне агента).

Исправленные примеры:
```
procs[cmd=bash][ns.pid!=@host.ns.pid].nspid.last=1
cgroups[procs~@pid(stress-mem)].`memory.max`<=20Mi
units[`nginx.service`].active=active && net.listen[port=80]
k8s.objects[kind=Deployment][`metadata.name`=web][`metadata.namespace`=shop].status.readyReplicas=3
```

Готовая цель R6 с полными ветками `fail` (вместо `g-mem-limit` в 2.4):

```yaml
- id: g-mem-limit
  say: { ru: "Ограничьте процесс stress-mem 20 МиБ памяти, не перезапуская его", en: "Limit stress-mem to 20 MiB without restarting it" }
  needs: [procs, cgroups]
  when: "cgroups[procs~@pid(stress-mem)].`memory.max`<=20Mi"
  keep: "procs[cmd=stress-mem].pid=@start.pid(stress-mem)"
  envs: [v86, vm]
  fail:
    - if: "!procs[cmd=stress-mem]"
      say: { ru: "Процесса stress-mem больше нет — вы его завершили. Цель требует ограничить живой процесс; нажмите «Сбросить шаг»", en: "..." }
      term: process
    - if: "!cgroups[`cgroup.subtree_control`~memory]"
      say: { ru: "В родительской группе не включён контроллер memory: файла memory.max в дочерней группе не будет. Посмотрите cgroup.subtree_control родителя", en: "..." }
      term: cgroup
    - if: "!cgroups[procs~@pid(stress-mem)][path!=/]"
      say: { ru: "Процесс всё ещё в исходной группе: запишите его PID в cgroup.procs новой группы", en: "..." }
      term: cgroup
    - if: "cgroups[procs~@pid(stress-mem)].`memory.max`>20Mi"
      say: { ru: "Лимит не задан или больше 20 МиБ: memory.max сейчас {value}", en: "..." }
```

Это требует добавить `cgroup.subtree_control` в факты cgroups (замечание 9).

Готовая проверка упражнения R9 «найдите в iptables путь к ClusterIP» (гибридный узел, ярус B):

```yaml
- id: drill-k8s-clusterip
  say: { ru: "Найдите, в какой под и на какой порт ядро node-1 отправит пакет к 10.96.12.7:80, и запишите ответ в /root/answer (формат IP:порт)", en: "..." }
  needs: [files, net]
  files: [/root/answer]
  when: "files.`/root/answer`.text=~'^\\s*@svc.sep(shop/web)\\s*$'"
  fail:
    - if: "files.`/root/answer`.text=~'10\\.96\\.'"
      say: { ru: "Это адрес самого Service. Он не висит ни на одном интерфейсе — ищите, во что его превращает DNAT в цепочке KUBE-SEP-…", en: "..." }
```
Здесь `@svc.sep(ns/name)` — макрос, который возвращает любой из адресов DNAT этого Service по фактам `net.iptables`. Подходит любой эндпоинт: правило `statistic` выбирает случайный.

---

### 9. MAJOR — схеме фактов `dt.facts/v1` не хватает полей, на которые опираются R6 и R7

**Где:** 2.2, интерфейс `Facts`.

**Что не так.** Нельзя проверить: потоки (R6: `/proc/<pid>/task`, `ps -eLf`), capabilities процесса и файла, режим seccomp, `no_new_privs`, отображение UID в user namespace, корень процесса (chroot или pivot_root), состояние процесса (`Z` — зомби, R7), маски сигналов (R7: обрабатывает ли PID 1 `SIGTERM`), `pids.current`, `cpu.stat` (`nr_throttled`), `cgroup.subtree_control`, источник stdout контейнера (R7: в лог-драйвер или в файл).

**Исправление — добавить в 2.2:**

```ts
procs?: {
  pid: number; ppid: number; user: string; uid: number; gid: number; cmd: string; exe?: string;
  state: 'R' | 'S' | 'D' | 'T' | 'Z' | 'I';
  threads: { tid: number; comm: string }[];             // /proc/<pid>/task
  nspid: number[]; ns: Record<NsKind, string>; cgroup: string;
  root: string;                                          // readlink /proc/<pid>/root (chroot/pivot_root)
  caps: { eff: string; prm: string; bnd: string; inh: string; amb: string };   // hex из status, + decode
  noNewPrivs: boolean; seccomp: 0 | 1 | 2;               // Seccomp: 0 выкл, 1 strict, 2 filter
  uidMap?: string[]; gidMap?: string[];                  // /proc/<pid>/uid_map
  sig: { caught: string; blocked: string; ignored: string };   // SigCgt/SigBlk/SigIgn
  fds?: { fd: number; target: string }[];                // по запросу: pipe:[…], socket:[…] — для объяснения конвейера
}[];
cgroups?: {
  path: string; procs: number[]; 'cgroup.subtree_control': string[]; 'cgroup.type': string;
  'memory.max': string; 'memory.high'?: string; 'memory.current': number; 'memory.peak'?: number;
  'memory.events'?: { low: number; high: number; max: number; oom: number; oom_kill: number };
  'pids.max': string; 'pids.current': number; 'pids.events'?: { max: number };
  'cpu.max': string; 'cpu.stat'?: { usage_usec: number; nr_periods: number; nr_throttled: number; throttled_usec: number };
}[];
fileCaps?: Record<string, string>;                       // getcap по запрошенным путям
containers?: { /* … как было … */ logPath?: string; logDriver?: string; init?: boolean; user?: string; stopSignal?: string; restartCount?: number }[];
```

Факты `fds` и `fileCaps` собираются только поимённо (в `needs`), как `files`.

---

### 10. MAJOR — платформа не даёт среды для объяснений R3/R4: шина событий бедна, пересчёта по параметрам нет

**Где:** 1.3 (`op: 'record'`), 1.4 (`watch`), ссылки на шину 08, 3.0.

**Что не так.**
1. R4 требует: «изменение параметра сразу пересчитывает процесс, объяснение изменения — рядом», плюс шаги вперёд и назад. Степпер 08 сворачивает записанные события. Но если ученик двигает ползунок `replicas`, `memory.max`, TTL или окно TCP, события нужно *сгенерировать заново*, и за десятки миллисекунд. 09 об этом ничего не говорит: у симуляторов нет требования детерминизма, виртуальных часов и чистого прогона.
2. На ярусе B прогон назад невозможен в принципе: это настоящее ядро. Нужен режим «записать — потом перематывать», и для смены параметра — честный перезапуск сценария в госте.
3. В шине `SimEvent` (08, 3.0, а платформа её реализует) нет событий, без которых не построить объяснения Linux из R3: `proc.spawn` склеивает `fork` и `exec`, хотя объяснение «fork/exec/PATH» строится как раз на их разнице. Нет событий для сигнала, потока, зомби, конвейера, перезапуска unit-а systemd. В сети нет L2-кадра и срабатывания правила netfilter, в Kubernetes — Lease.

**Исправление (новый раздел 1.10 «Среда для объяснений»):**

> Каждый симулятор яруса A реализует чистую функцию
> `run(scenario: string, params: Record<string, number | string | boolean>, seed: number): SimEvent[]`
> на виртуальных часах (никаких `Date.now()`, `Math.random()` — только сид). Порог: ≤ 30 мс на сценарий объяснения из 08, иначе ползунок «тормозит». Степпер при смене параметра вызывает `run` заново, сопоставляет новый и старый следы по `step id` и показывает рядом разницу («`replicas` 3 → 5: планировщик создал ещё 2 пода, шаги 7–8 повторились дважды»). Текст разницы задаётся шаблоном в YAML объяснения: `on_change: { replicas: "…{old}…{new}…" }`.
>
> На ярусе B объяснение идёт в режиме «запись»: кнопка «записать» включает трассировку (замечание 7), ученик выполняет команду, след превращается в события шины и дальше проигрывается тем же степпером. Смена параметра — это повторный прогон команды в госте из того же снимка (1–4 с) с подписью «пересчитано на настоящем ядре».
>
> Дополнения к шине (08, 3.0 — согласовать с ролью 08):
> ```ts
> | { t: 'proc.fork'; pid: number; ppid: number; at: number }
> | { t: 'proc.exec'; pid: number; path: string; argv: string[]; tried?: string[] }   // tried — перебор PATH по ENOENT из strace
> | { t: 'proc.thread'; pid: number; tid: number }
> | { t: 'proc.signal'; pid: number; sig: string; from?: number; action: 'handled' | 'default' | 'ignored' }
> | { t: 'proc.state'; pid: number; state: 'Z' | 'R' | 'S' | 'T'; reaper?: number }
> | { t: 'fd.pipe'; id: string; writer: number; reader: number; bytes?: number }
> | { t: 'unit.state'; unit: string; active: string; sub: string; result?: string; restarts: number }
> | { t: 'cgroup.oom'; path: string; victim: number }
> | { t: 'net.frame'; sw: string; port: string; src: string; dst: string; ethertype: string; vlan?: number; summary: string }
> | { t: 'nf.hit'; table: string; chain: string; rule: number; verdict: string }
> | { t: 'k8s.lease'; node: string; renewed: boolean }
> ```

Раскадровки объяснений блока Linux (R3/R4), которые эта среда должна держать. Их содержание — моя часть (впишу в 02), но платформе нужно видеть, откуда берутся данные и какие нужны параметры:

| Объяснение | Источник событий | Экраны (один экран — одна мысль) | Ползунки и переключатели | «Сломай» |
|---|---|---|---|---|
| Загрузка машины | запись холодной загрузки в CI: `dmesg -T`, `systemd-analyze plot` (SVG → события), `journalctl -b -o json`; кнопка «холодная загрузка» в v86 (25 с, честно) | 1. BIOS → загрузчик → ядро (`cmdline` подписан на стрелке); 2. ядро распаковывает initramfs и монтирует корень (`root=host9p`); 3. PID 1 = systemd; 4. граф целей `sysinit.target` → `basic.target` → `multi-user.target`; 5. первый `getty` и приглашение | `init=` (systemd / `/bin/sh`), «без сети» (`systemctl mask` сети), `quiet` вкл/выкл | убрать `root=` → kernel panic с настоящим текстом; убрать unit сети → `multi-user.target` без сети |
| fork/exec/PATH | `strace -f -e trace=process,execve` в v86; в A — модель Стенда | 1. шелл читает строку; 2. ищет команду: встроенная? псевдоним? перебор каталогов `PATH` (каждая попытка — стрелка с `ENOENT`); 3. `fork` — копия шелла с новым PID; 4. `exec` — в той же копии меняется программа, PID тот же; 5. `wait` и код возврата | порядок каталогов в `PATH`, «команда — встроенная / внешняя», `exec ls` вместо `ls` | убрать `/usr/bin` из `PATH` → `command not found` с объяснением, какой шаг сорвался |
| Конвейер | `strace -f -e trace=pipe2,dup2,read,write`, `ls -l /proc/<pid>/fd` → `pipe:[…]` | 1. шелл создаёт канал (буфер ядра, 64 КиБ); 2. два `fork`; 3. `dup2`: stdout левого → канал, stdin правого ← канал; 4. данные текут, счётчик байт в буфере растёт; 5. левый завершился → EOF у правого | размер буфера (наглядно, не меняя ядро), скорость писателя и читателя | «читатель умер» → писатель получает `SIGPIPE` (`yes | head -1`) |
| systemd перезапускает упавшую службу | `journalctl -o json -f -u demo`, `systemctl show -p NRestarts,ActiveState,SubState,Result` → `unit.state` | 1. unit-файл: `Restart=`, `RestartSec=`; 2. процесс падает (код ≠ 0); 3. systemd ждёт `RestartSec`, счётчик `NRestarts`; 4. превышен `StartLimitBurst` за `StartLimitIntervalSec` → `failed (Result: start-limit-hit)` | `Restart=no/on-failure/always`, `RestartSec` 0–10 с, `StartLimitBurst` 1–10 | `kill -9` главного процесса; удалить бинарник из `ExecStart` → `status=203/EXEC` |
| Лимит памяти и OOM (R6) | `dt-probe watch` по `memory.current`, `memory.events`, `memory.pressure`; `dmesg` с `oom-kill` | 1. группа и её файлы; 2. процесс растёт, `memory.current` ползёт к `memory.max`; 3. ядро вытесняет кеш страниц (давление PSI растёт); 4. `oom_kill` +1, в `dmesg` строка `Memory cgroup out of memory: Killed process …`; 5. снаружи группы всё живо | `memory.max` 8–64 МиБ, `memory.high` вкл/выкл (троттлинг вместо убийства), скорость роста | убрать `+memory` из `subtree_control` → нет файла `memory.max` |

---

### 11. MAJOR — для лестницы документации (R2) у платформы нет ни компонентов, ни данных

**Где:** раздел 4 (режимы наставника), 3.1 (`LearnEvent.type`), 1.4 (образы), 2.4 (формат цели), 7 (план).

**Что не так.** R2 требует пять ступеней на каждый блок: от «документация мелькает» до «только официальная документация на экзамене». От платформы для этого нужны: (а) офлайн-корпус man-страниц и справки той же версии, что программы в образе; (б) просмотрщик с якорями на разделы и подсветкой строки (ступень 2); (в) события «куда смотрел» (ступени 3–4); (г) режим наставника, который не отвечает, а спрашивает «где вы смотрели?» (ступень 4); (д) экзаменационный режим со списком разрешённых источников (ступень 5). В 09 нет ни одного из пяти. Отдельная техническая ловушка: в образах на основе `debian:bookworm-slim` документация вырезана (`/etc/dpkg/dpkg.cfg.d/docker` исключает `/usr/share/man/*`), а 02, 1.3 ставит man «только для команд из 3.3». Значит, на ступени 4, где нужен флаг, которого нет в теории, `man` в госте окажется пустым. В Alpine man-страниц нет вообще: нужны `mandoc` и пакеты `*-doc`.

**Исправление (новый раздел 2.6 «Документация как среда»):**

> **Корпус.** При сборке образа `lab-*` из него извлекаются все man-страницы установленных пакетов (исключение `path-exclude /usr/share/man` удаляется из образа) и выводы `--help` всех бинарников в `PATH`. Страницы переводятся в HTML через `mandoc -T html` с якорями разделов (`#SYNOPSIS`, `#DESCRIPTION`, `#OPTIONS`, `#EXAMPLES`, `#SEE_ALSO`) и каждого флага (`#opt-z`), раскладываются по `/docs/man/<pkg>@<version>/<page>.<sec>.html` и кешируются как данные урока. Так страница всегда соответствует бинарнику, с которым работает ученик. В Alpine — `mandoc` и `*-doc` для пакетов урока. `kubectl explain` берётся из OpenAPI v1.37 (05). Фрагменты kubernetes.io (CC BY 4.0) и docs.docker.com (лицензия проверяется до публикации) зеркалятся по ссылкам из уроков, с атрибуцией и датой снимка. Лицензии man-страниц у проектов разные (GPL, BSD, «verbatim»); распространяем их неизменёнными вместе с указанием пакета, как это делает сам дистрибутив.
>
> **Просмотрщик `docview`.** Открывается сбоку от терминала. Режимы: `peek` (ступень 1: одна строка «это из `man ls`, раздел DESCRIPTION, `-l`» и ссылка), `fragment` (ступень 2: раздел страницы с подсвеченной строкой и подписями частей страницы — «SYNOPSIS: что в квадратных скобках — необязательно»), `page` (ступени 3–5: вся страница с поиском `/`, без подсветки). В терминале v86 работает настоящий `man`, в Стенде `man <cmd>` открывает тот же текст в пейджере терминала.
>
> **События.** `LearnEvent.type` дополняется `doc.opened { ref, via: 'link' | 'man' | 'help' | 'explain' | 'external', mode }` и `doc.searched { ref, query }`. На ярусе B `PROMPT_COMMAND` (02, 4.2) уже шлёт каждую строку: агент помечает строки `man …`, `… --help`, `… -h`, `kubectl explain …`, `info …`, `apropos …` как `doc.opened via=man|help|explain`.
>
> **Описание в задании:**
> ```yaml
> docs:
>   step: 4                         # 1–5, ступень лестницы для этого задания
>   ref: "man:systemd.resource-control(5)#CPUQuota="
>   target: "CPUQuota="             # то, что ученик должен найти; наставник это не произносит
> ```
> Ступень блока хранится в прогрессе (`docLadder[block]`, производная от журнала): новичок начинает с 1, средний со 2, опытный с 3 (R2). Переход на следующую ступень — после трёх заданий текущей, решённых без раскрытия подсказки.
>
> **Режим наставника `forcing`** (строка в таблицу 4.5):
>
> | `forcing` | задания ступени 4 | Не называй флаг, опцию или команду из `docs.target` и не цитируй строку документации, которая их содержит. Первым ответом спроси, где ученик уже смотрел. Если в журнале нет `doc.opened` по этому заданию, предложи конкретный инструмент (`man <cmd>`, `<cmd> --help`, `kubectl explain <path>`, docs.docker.com) и как в нём искать (`/слово` в `less`). Если смотрел — подскажи раздел страницы, но не строку | Ответ проверяется на вхождение `docs.target`; при совпадении блок сворачивается под кнопку «Показать — задание засчитается со ступенью 3». В контекст (слой 3) попадают последние `doc.opened` по заданию |
>
> **Ступень 5 (экзамены).** Нейросеть выключена (`exam`). `docview` работает в режиме `page` только по корпусам, перечисленным в экзамене (`docs_allowed: [man, kubernetes.io, docs.docker.com]`). Внешние ссылки открываются в новой вкладке. Запретить другие вкладки мы не можем и не делаем вид, что можем (как в 4.7 и в 10). Часть заданий требует команд и флагов, которых нет в курсе (R2); автор помечает их `beyond_course: true`, и валидатор проверяет, что в экзамене таких заданий не меньше 20 %.

Примеры заданий блока Linux по ступеням (впишу в 02; здесь — чтобы платформа видела, какие данные нужны):

| Ступень | Задание | Проверка |
|---|---|---|
| 1 | «Покажите файлы с размерами» → `ls -l`; под выводом строка «это из `man ls`, `-l`: use a long listing format» со ссылкой | состояние не меняется; `cmd.done` с `ls` и `-l` в любом порядке |
| 2 | «Найдите в `/var/log` файлы, изменённые за последние сутки». Подсказка 1 — фрагмент `man find` с подсвеченной строкой `-mtime n` и подписями `SYNOPSIS / TESTS / EXAMPLES` | `files./root/answer` совпадает с эталонным списком |
| 3 | «Найдите флаг `sort`, который сортирует `1K 2M 3G` по смыслу» — только ссылка на `man sort` | `files./root/sorted.txt.sha256` = эталон (`sort -h`) |
| 4 | «Ограничьте службу `demo` половиной ядра, не правя unit-файл вручную» (в теории есть только `memory.max` на сырой cgroup) | `cgroups[path~demo.service].`cpu.max`='50000 100000'` и unit-файл `/etc/systemd/system/demo.service` не изменён (sha256 = `@start`); ответ — `systemctl set-property demo CPUQuota=50%` |
| 4 | «Покажите все потоки процесса `orders-server` одной командой, не заходя в `/proc`» | `history` содержит `ps` с `-L`, `-T` или `-eLf`, или `top -H`; проверка мягкая, засчитывается по выводу числа потоков в `/root/answer` |
| 5 | Экзамен: «Найдите процесс, который держит удалённый файл и занимает место на диске», при этом `lsof +L1` в курсе не вводился | `df` освободилось (`files` + `stat` раздела), процесс жив (`keep`) |

---

### 12. MAJOR — агент `trainer-check` противоречит документам 05, 06 и 10

**Где:** 5.4, 4.7, 5.6.

**Что не так.** В 05, 10.4 и в 10 (строки про `trainer-check capstone` и `pet <N>`) проверка описана как *открытый скрипт, который только читает систему*: запускается `bash trainer-check.sh r2`, а не `curl | bash`, и «ученик видит, что он не меняет систему». В 06 есть ещё и третий проверяльщик — образ `docker run ghcr.io/<org>/devops-trainer-checker`. 09 вводит Go-бинарник с systemd-службой от root, постоянным WebSocket к серверу и внесением поломок по подписанным пакетам, но называет это «механизмом из 05, обобщённым». Обещание «скрипт только читает» и агент, который ломает kubelet, несовместимы. Если оба живут под одним именем, ученик и рецензент кода не смогут понять, что именно они запускают.

**Исправление (текст в 5.4):**

> Два бинарника, один исходный код:
> - **`trainer-check`** — только чтение, единственный проверяльщик для блоков 02, 04, 05, 06 и 10 (вместо `trainer-check.sh` и образа `devops-trainer-checker`). Без службы, без root по умолчанию: в `sudo` нуждаются только области, которые читают `/etc/kubernetes/pki` и `/var/lib/etcd`, и он говорит об этом заранее. Режимы `run --track …` (без сервера, base64-блок) и `report` (то же с подписью ключа попытки). Исходный текст `facts.sh` и списка областей открыт; бинарник собран воспроизводимо, и ссылка на тег в репозитории показывается рядом с командой установки.
> - **`trainer-exam`** — отдельный бинарник только для предъявляемых экзаменов и воркшопов: служба, WebSocket к `dt-api`, применение подписанных пакетов поломок, подпись фактов. Ставится только на ВМ нашего тенанта (cloud-init) или командой `trainer-exam enroll`, которая прямо пишет: «эта программа будет вносить поломки в вашу машину по заданию экзамена».
>
> Документы 05 (10.4), 06 (практикум мониторинга) и 10 (capstone, pet) ссылаются на `trainer-check`; `devops-trainer-checker` в 06 упраздняется.

---

### 13. MAJOR — для этапа 3 Kubernetes (R12) нет пути «Terraform заказывает ВМ, Ansible настраивает», обязательной уборки и счётчика стоимости

**Где:** 5.1–5.3, 7 (v2: «треки R3–R5»).

**Что не так.** По R12 на этапе 3 тренажёр ничего не выполняет: он ведёт, проверяет скриптом, показывает стоимость ВМ и требует обязательного шага уборки, а сами ВМ заказываются Terraform и настраиваются Ansible. В 09 ВМ в нашем тенанте создаёт брокер `dt-api` по кнопке. Для блока IaC это хуже: ученик не пишет инфраструктуру кодом для того самого кластера, который потом ставит. Нет шага уборки с проверкой, нет счётчика денег. Этап 2 R12 (одноузловой k3s/minikube/kind на своей машине или VPS) упомянут только в таблице вариантов.

**Исправление (новый раздел 5.7):**

> **5.7. Этапы 2 и 3 Kubernetes на настоящих машинах**
>
> **Этап 2 (один узел).** k3s на одной ВМ (наш тенант, 2 vCPU / 4 ГБ, или любой VPS) либо kind/minikube на своей машине. Тренажёр показывает чеклист 05, 10.3, проверка — `trainer-check run --track r1|r2`.
>
> **Этап 3 (kubeadm на 3+ ВМ).**
> 1. *Заказ ВМ кодом.* В нашем тенанте ученик получает kubeconfig со своим namespace (`dt-<id>`). Роль разрешает только `VirtualMachine` и `Service` Cozystack в этом namespace, квота — 6 vCPU / 12 ГБ / 60 ГБ. Ученик пишет Terraform с провайдером `hashicorp/kubernetes` (`kubernetes_manifest` на три ВМ, cloud-init с его ssh-ключом) и выполняет `terraform apply` у себя. В чужих облаках то же самое делается провайдерами `yandex-cloud/yandex`, `hetznercloud/hcloud`, `hashicorp/aws`; шаблоны для каждого лежат в репозитории курса.
> 2. *Настройка Ansible.* Инвентарь генерируется из `terraform output -json`. Плейбук курса ставит containerd, kubeadm, kubelet и kubectl закреплённой версии v1.36.x (для R4 → v1.37), отключает swap и включает `br_netfilter` и `ip_forward`. Ученик дописывает роли сам. Доступ к ВМ в нашем тенанте — через бастион (`ProxyJump` в `ansible.cfg`).
> 3. *Установка* по чеклисту 05 (kubeadm init/join, Cilium, хранилище, сертификаты, обновление, etcd snapshot/restore, «сломай и почини узел»), проверка — `trainer-check run --track r3|r4`.
> 4. *Стоимость.* Над чеклистом счётчик «ВМ работают N ч M мин ≈ X ₽ / €» по ценам из `providers.yaml`. Для нашего тенанта показывается себестоимость (5.3) с подписью «для вас бесплатно», чтобы ученик привыкал видеть деньги.
> 5. *Уборка (обязательна, без неё трек не закрывается).* `terraform destroy`, затем проверка: для нашего тенанта `dt-api` видит в namespace ноль `VirtualMachine` и ноль дисков; для чужого облака ученик вставляет вывод `terraform state list` (должен быть пустым) и вывод CLI провайдера (`yc compute instance list --format json`, `hcloud server list -o json`, `aws ec2 describe-instances --filters Name=instance-state-name,Values=running`), а тренажёр проверяет, что в нём нет ВМ с меткой `devops-trainer=<id>`. Метку ставит шаблон Terraform курса.
>
> Брокер ВМ по кнопке остаётся для блоков, где цель не IaC (Linux E4, контейнеры D11, воркшопы).

---

### 14. MAJOR — вложенная сеть в тенанте Cozystack: Cilium внутри ВМ на KubeVirt упрётся в MTU, а LoadBalancer — в L2

**Где:** 5.3 «Устройство» («ВМ набора видят друг друга в частной сети тенанта»).

**Что не так.** Трек R3: Cilium в режиме туннеля (VXLAN/Geneve) внутри ВМ, а ВМ сами работают в оверлейной сети кластера Cozystack (Kube-OVN, Geneve). Двойная инкапсуляция съедает MTU. ВМ получает интерфейс с MTU меньше 1500 (у Kube-OVN в оверлее по умолчанию около 1400), Cilium поверх снимает ещё около 50 байт. Если MTU не согласовать, получится классическая «чёрная дыра»: `ping` проходит, а TLS-рукопожатие и большие ответы зависают. Для ученика в первом kubeadm это неразрешимая загадка. Кроме того, нужно проверить в спайке, пропустит ли сеть тенанта пакеты с адресами подов в режиме прямой маршрутизации Cilium (защита от подмены адресов на порту ВМ) и сработают ли L2-объявления LoadBalancer (MetalLB L2 или Cilium L2 announcements), если ARP на чужой адрес фильтруется.

**Исправление (текст в 5.3 и в фазу 0):**

> **Сеть внутри набора.** cloud-init выставляет на `eth0` MTU, который выдаёт сеть тенанта. Шаблон Cilium курса ставит `routingMode: tunnel`, `tunnelProtocol: vxlan`, а MTU определяется автоматически, и проверка R3 это контролирует: `trainer-check` сравнивает MTU `cilium_vxlan` с MTU `eth0` минус 50. Для LoadBalancer в R3 используется NodePort плюс наш внешний балансировщик тенанта либо Cilium L2 announcements — что из этого работает в сети тенанта, решает спайк. Фаза 0, пункт 6: три ВМ в тенанте, kubeadm + Cilium, `curl` большого (1 МБ) ответа через Service между узлами, `kubectl get svc` типа LoadBalancer получает адрес.
>
> Расхождение MTU одновременно становится упражнением «сломай и почини» для опытных (R8/R9: «пинг есть, HTTPS висит — какой уровень сломан?»).

---

### 15. MAJOR — телефон и малопамятные устройства: R11 требует один узел на телефоне, а правило с `deviceMemory` срабатывает неверно

**Где:** 1.4, «Устройства» («v86 не запускается автоматически на телефоне и при `navigator.deviceMemory < 4`»), таблица 1.1 «Телефон: нет».

**Что не так.**
1. R11: «1 узел на телефоне». В 09 v86 на телефоне не запускается вовсе.
2. `navigator.deviceMemory` есть только в Chromium. В Safari и Firefox это `undefined`, а `undefined < 4` равно `false`. В итоге на iPhone и в Firefox на слабом ноутбуке v86 запустится автоматически, а на Chromium-ноутбуке с 4 ГБ — нет. К тому же значение огрублено и ограничено сверху 8.

**Исправление (текст):**

> **Устройства.** Автозапуск машины — только если `navigator.deviceMemory >= 4` (Chromium) или, когда свойство не определено, по признаку настольного устройства (`matchMedia('(pointer: fine)')` и ширина ≥ 1024 px). Во всех остальных случаях показывается кнопка «Запустить машину (≈ 40 МБ загрузки, ≈ 250 МБ памяти)». На телефоне доступна одна машина `lab-node` на 64–96 МБ (без systemd, BusyBox + `crun`) — для уроков namespaces/cgroups и одноузлового гибрида. Многомашинные лаборатории на телефоне предлагают QR-передачу на компьютер (08, 3.9). Порог фазы 0: iPhone 13 и Android с 4 ГБ — восстановление снимка ≤ 6 с, вкладка не выгружается за 10 минут работы.

---

### 16. MAJOR — опыт «v86 сам по себе ВМ» и сравнение запуска контейнера с загрузкой ВМ (R7c) не проверены и не заложены

**Где:** 1.4 (снимки «машина никогда не загружается у ученика с нуля»), 1.1 (строка «Старт»).

**Что не так.** По R7c ученик в браузерной Linux должен убедиться, что она сама — ВМ (`dmesg`), сравнить `uname`/`ps` внутри и снаружи контейнера и замерить, сколько стартует контейнер и сколько загружается вторая ВМ v86. Здесь две проблемы.
1. Неизвестно, что увидит ученик. v86 эмулирует процессор, и бит гипервизора в CPUID и строки DMI от SeaBIOS могут не дать `systemd-detect-virt` и `dmesg | grep -i hypervisor` ничего узнаваемого. Тогда лабораторный опыт «я внутри ВМ» не получится.
2. Политика «никогда не загружать с нуля» запрещает честный замер загрузки ВМ, а восстановление снимка за 1–4 с — не загрузка, и сравнение «контейнер против ВМ» выйдет нечестным.

**Исправление (текст в 1.4 и фазу 0):**

> **Опыт «эта машина — ВМ».** Фаза 0 фиксирует, что показывают в `dt-kernel` команды `dmesg | head -30`, `systemd-detect-virt` (в `lab-debian`), `cat /sys/class/dmi/id/{sys_vendor,product_name}`, `lscpu | grep -i -E 'hypervisor|model name'`. Если узнаваемого признака нет, урок опирается на то, что видно наверняка: модель процессора эмулятора в `/proc/cpuinfo`, устройства `virtio` в `lspci`/`/sys/bus/virtio/devices` и `dmesg` с `9pnet_virtio`. Подменять вывод не будем.
>
> **Замер «контейнер против второй ВМ».** В лаборатории R7c есть кнопка «загрузить вторую машину с нуля» — холодная загрузка `lab-node` без снимка, 64 МБ, около 25 с, с живым журналом загрузки. Параллельно ученик выполняет `time crun run …` в первой машине. Оба времени — время эмулятора, примерно в 50–100 раз медленнее железа, и об этом говорит подпись: «на сервере те же величины в 50–100 раз меньше, но соотношение то же». Счётчики объяснения R7c (загрузка, время старта, память) берутся из модели с параметрами, подтверждёнными на ВМ воркшоп-кластера, а не из v86.

---

### 17. MAJOR — каталог образов неполон и расходится с 06; сетевые адреса лабораторий не сведены

**Где:** 1.4, таблица образов; 1.6, «общий сегмент `10.0.0.0/24`, DHCP раздаёт одна из машин».

**Что не так.**
1. В 06 описана лаборатория «Настоящий Ansible»: три машины v86 (Alpine с python3 и ansible-core, два хоста с python3 и dropbear) на `inbrowser` со статическими 10.5.0.x. В каталоге 09 такого образа нет, бюджета на три машины тоже нет, бэкенд `inbrowser` заменяется (замечание 1), а адресный план другой (DHCP 10.0.0.0/24).
2. Для R8 (каталог протоколов на настоящих демонах: DHCP, NTP, SMTP, SFTP, WireGuard, VLAN) и для R9/R11 (`lab-node`) образов нет.

**Исправление — заменить таблицу образов:**

| Образ | Корень | Память | Для чего |
|---|---|---|---|
| `lab-debian` | Debian 12 i386, systemd, 9p + `hdb` ext4 | 256 МБ (2 × 192 МБ) | Linux L8–L17, ssh, systemd, диски, R6 |
| `lab-alpine` | Alpine 3.22 x86, OpenRC, 9p + tmpfs `/c` | 256 МБ | контейнер своими руками (04) |
| `lab-node` | `lab-alpine` + `crun`, `nftables`, `iptables`, `conntrack-tools`, `tcpdump`, `wireguard-tools`, `dnsmasq`, `dt-node`; образы подов на `hdb` | 64–128 МБ | гибридный Kubernetes, сеть нескольких узлов, телефон |
| `lab-net` | `lab-alpine` + `nsd`, `unbound`, `dnsmasq`, `nginx`, `openssl`, `chrony`, `openssh-sftp-server`, `opensmtpd` или `msmtp` + `mailpit`-аналог на C | 192 МБ | «мини-интернет», каталог протоколов R8 |
| `lab-ansible` | Alpine + `python3`, `ansible-core` (управляющий); хосты — `lab-node` + `python3` | 256 + 2 × 96 МБ | «Настоящий Ansible» (06) |

Адресный план лабораторий (один на курс, чтобы уроки ссылались друг на друга): учебная сеть узлов `10.0.0.0/24` (шлюз `.1`), вторая сеть маршрутизации `10.1.0.0/24`, поды `10.244.<узел>.0/24`, Services `10.96.0.0/16` (DNS `10.96.0.10`), сеть «мини-интернета» `198.51.100.0/24` и `203.0.113.0/24` (документационные диапазоны RFC 5737, никогда не пересекутся с настоящими), Docker-мост `172.17.0.0/16`, Ansible — `10.5.0.0/24` (как в 06).

---

### 18. MAJOR — порядок плана работ не отражает приоритеты R1

**Где:** 7 «План работ», критерии MVP и v1.

**Что не так.** По R1 ядро продукта — учебник со строгим порядком сущностей, пошаговые объяснения процессов и привычка лезть в документацию, а практика стоит на них. В MVP 09 нет ни среды для объяснений (замечание 10), ни корпуса документации и `docview` (замечание 11), ни валидатора порядка терминов на стороне платформы для подсказок наставника. Зато есть Wisp, OPFS и экспорт. Критерий «блоки проходятся офлайн» ничего не говорит о трёх опорах R1.

**Исправление — добавить в MVP:** `run(params, seed)` и виртуальные часы у Стенда и dsim, расширенная шина (замечание 10), режим «запись» на ярусе B, `docview` с корпусом man-страниц `lab-debian` и `lab-alpine`, события `doc.*`, режим наставника `forcing`. Критерий готовности MVP дополнить: «у каждого модуля Linux есть хотя бы одно объяснение процесса с ползунком и "сломай"; у каждого задания есть `docs.step`; валидатор подсказок не пропускает невведённые термины». Wisp-релей перенести из фазы 0 в v1: в MVP он не используется.

---

### 19. MAJOR — версии в золотых записях расходятся с 05

**Где:** 1.3, «Правило правдивости»: «k3s stable, kubeadm v1.36».

**Что не так.** В 05 kube-lite валидирует по OpenAPI v1.37 и объявляет iptables/nftables основными режимами kube-proxy (IPVS уходит в v1.37), а kubeadm v1.36 нужен только как исходная точка трека R4. Если записывать золотые записи kube-lite на v1.36, вывод `kubectl`, сообщения валидации и поля по умолчанию разойдутся со схемами v1.37.

**Исправление:** «Золотые записи kube-lite — на k3s и kubeadm той же минорной версии, что схемы (сейчас v1.37.x); отдельный набор записей v1.36.x — только для трека R4 (обновление)». В R9 IPVS упоминается одной фразой, как в 05; `CONFIG_IP_VS` в ядро не включаем.

---

### 20. MAJOR — подсказка наставника и дисциплина терминов: идентификаторы не совпадают с графом 01

**Где:** 4.5, слой 2 («Уже введены: process, pid, namespace, pid-namespace…»), 1.4 («Linux L8–L16»).

**Что не так.** В 01 понятия имеют коды `L01…L32`, `D03`, `N21`, в глоссарии 08 — слаги (`pid-namespace`), а модули 02 нумеруются `L0…L16`. «L8–L16» в 09 читается и как модули 02, и как понятия 01 (L16 в 01 — это `PATH`). Слой 2 подсказки собирается автоматически, и если источник идентификаторов не определён, наставник получит неверный список «ещё не введены».

**Исправление (текст в 4.5):** «Слой 2 строится из `glossary.yaml` (08, 7.3): слаг термина → `introduced_in` (урок и сцена) → код понятия графа 01 (`concept: L17`). Модули блоков в тексте документов обозначаются `lnx-m08`, `ctr-m03`, `k8s-m10`, а понятия графа — `L17`, `D03`, чтобы не путать». Это же исправление нужно в 02 (сделаю).

---

### 21. MINOR — последовательные порты не распределены между документами

**Где:** 1.4 «Служебный канал» (`ttyS1`), 04, 6.3 (`ttyS2` — второй терминал «хост»), замечание 1 (`ttyS3` — мультиплексор `exec`).

**Исправление:** зафиксировать таблицу: `ttyS0` — терминал ученика, `ttyS1` — служебный агент (JSON), `ttyS2` — второй терминал (04: «внутри и снаружи контейнера»), `ttyS3` — потоки `exec`/`logs -f` гибридного узла. В v86 всего четыре UART, больше портов нет. Если понадобится третий терминал, он открывается через `exec` на `ttyS3`.

---

### 22. MINOR — расхождения с 02, которые 09 решает, но не называет

**Где:** 1.4, 3.1.

02 описывает `trainerd` на bash под systemd, снимки в IndexedDB, пакет ядра `linux-image-686` и порог снимка 60 МБ в спайке; 09 — агента на sh из 9p, OPFS, `dt-kernel` и порог 40 МБ. Решения 09 разумные, и я их принимаю, но раздел 1.6 обещает перечислить все такие расхождения, а этих там нет. Добавить в начало 1.4 строку: «Заменяет в 02: агент → `dt-probe` + `trainer-agent` (1.4); снимки → OPFS (3.1); `linux-image-686` → `dt-kernel`; порог снимка 60 → 40 МБ». Также `fs-probe` из 02 (чтение 9p из JavaScript) переезжает в `v86.worker.ts`, потому что эмулятор теперь живёт в воркере.

---

### 23. MINOR — у Debian 12 i386 нет пути обновления; этого нет в рисках

**Где:** 8.

Debian 13 больше не собирает ядро и установщик под i386, а bookworm поддерживается Debian LTS до 30.06.2028. Ядро у нас своё, но пользовательское пространство застрянет на bookworm. Добавить строку в 8: «Конец LTS bookworm (06.2028) → к 2028 году переход `lab-debian` на Debian 13 i386 userland (пакеты i386 в trixie остаются для multiarch; проверить полноту набора) или замена бэкенда (linux-wasm, раздел 1.2)».

---

### 24. MINOR — частые проверки на ярусе B мешают ученику

**Где:** 2.5 («через 1,5 с тишины после `cmd.done`»).

Каждые полторы секунды тишины в госте запускается сбор фактов. В уроке L8 про `top` и нагрузку агент сам будет нагрузкой. Добавить: «Автопроверка на ярусе B собирает только области `needs` текущей цели и не чаще раза в 5 с; в уроках, помеченных `quiet_agent: true` (нагрузка, `top`, `vmstat`), — только по кнопке».

---

### 25. MINOR — Trusted Types и xterm.js 6 не проверены вместе

**Где:** 6.4, CSP (`require-trusted-types-for 'script'`).

DOM-рендерер xterm.js и некоторые его дополнения работают с `innerHTML`. Под `require-trusted-types-for 'script'` это даст исключение, и терминал пропадёт. Добавить в фазу 0: «xterm.js 6 с WebGL-рендерером и `web-links` под Trusted Types без политики `default`; если не проходит — политика `dt-term` с санитизацией только для xterm». Красивый терминал из R5 начинается с того, что он вообще рисуется.

---

### 26. MINOR — красота терминала (R5) ни за кем не закреплена

**Где:** 6.1 (стек), 6.4 (`font-src 'self'`).

Для R5 нужно: моноширинный шрифт без лигатур (например, JetBrains Mono или IBM Plex Mono, оба под OFL), раздаётся со своего домена (`font-src 'self'`). Тема терминала строится из тех же токенов цвета, что схемы 08, 5.2: цвет «ядро» и цвет «пространство пользователя» совпадают в выводе `strace` и на схеме. Курсор и выделение — по токенам. Плавная прокрутка, `scrollback` 5000 строк. Добавить строку в 6.1 «Терминал»: «тема и шрифт — из токенов 08, 5.2; шрифт self-hosted».

---

### 27. MINOR — макрос `@host.ns.pid` не определён для ВМ

**Где:** 2.3.

На ВМ яруса C «хост» — это сама ВМ, а на гибридном узле — узел. Нужно правило: `@host` — процесс с PID 1 в корневом pid-namespace той машины, с которой сняты факты.

---

### 28. MINOR — утверждение о `curl https://example.com` в фазе 0

**Где:** 7, фаза 0, пункт 3 («`apk add` и `curl https://example.com` из гостя»).

`apk add` из гостя по плану идёт через `fetch`-бэкенд и зеркало (1.6), а не через Wisp. В пункте смешаны два бэкенда. Разделить: «3а. `fetch`-бэкенд с переписыванием адресов в Worker (замечание 5): `apt update && apt install tree` в `lab-debian`. 3б. Wisp + наш DoH (замечание 6): `curl -sI https://example.com`; `curl https://neverssl.com` получает отказ релея».

---

### 29. MINOR — опечатка в ограничениях Wisp-релея

**Где:** 1.6, пункт 1 списка: «порты 53, 80, 443».

Порт 53 по Wisp возможен только как TCP (`dig +tcp`). После исправления 6 DNS идёт через наш DoH, и порт 53 в списке не нужен. Убрать или подписать «только TCP, для `dig +tcp` в уроке L14».

---

### 30. MINOR — `ps` и агент в записях учебных снимков

**Где:** 1.4, «Загрузка» (снимок после `TRAINER_READY`).

В снимок попадают процессы агента, `dt-probe watch` и `getty` на `ttyS1`/`ttyS2`. В лабораторных `ps -ef` ученик видит лишние строки, а в 04 обещано, что `ps` покажет три процесса. Добавить: служебные процессы запускаются в отдельной cgroup `/sys/fs/cgroup/trainer` с понятными именами, а в уроке L8 им посвящена одна фраза и подсветка на схеме дерева процессов («это служебный агент тренажёра — он отвечает на кнопку "Проверить"»). В `lab-alpine` агент и терминал контейнера разведены так, что `ps` внутри контейнера по-прежнему показывает только процессы контейнера.

---

## Сводка по требованиям владельца (для области 09)

| Требование | Состояние в 09 | Замечания |
|---|---|---|
| R1 приоритеты | план работ ставит практику впереди учебника, объяснений и документации | 18 |
| R2 лестница документации | нет | 11 |
| R3 объяснения в каждом блоке | шина и запись есть частично | 10 |
| R4 стиль: пересчёт по параметру, перемотка | нет детерминизма и `run(params)` | 10 |
| R5 красота | терминал и токены цвета не закреплены | 25, 26 |
| R6 изоляция в Linux | темы привязаны к контейнерному образу; xattr на 9p; ядро и пакеты неполные | 2, 3, 8, 9 |
| R7 контейнеры: границы и опыт «ВМ против контейнера» | факты границ неполны, опыт v86 не проверен | 9, 16 |
| R8 сети: протоколы на настоящих демонах | DNS в v86 синтетический, нет образов каталога протоколов | 6, 17 |
| R9 сеть Kubernetes | на настоящем ядре невозможна без гибрида | 1, 8 |
| R10 цикл сверки и свой контроллер | код ученика запрещён CSP | 4 |
| R11 многомашинность и гибрид | нет | 1, 15 |
| R12 три этапа Kubernetes | нет пути Terraform → Ansible, уборки, стоимости; MTU в тенанте | 13, 14 |
