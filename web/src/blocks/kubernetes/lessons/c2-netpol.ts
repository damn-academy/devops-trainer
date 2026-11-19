// KN7 (05 §4.3, §6.12): NetworkPolicy as its own lesson — default-deny,
// the AND/OR trap of `from`, egress and the DNS rule, and the plugin that
// has to enforce all of it. The lab is checked by real reachability between
// pods of the training cluster, not by the YAML the learner typed.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import type { Obj } from '../../../engine/kube-lite/util';
import { NETPOL_LAB } from '../setups';
import { R, S, src } from '../sources';

const k8s = (f: Facts) => f.k8s as K8sFacts;
const reach = (f: Facts, from: string, to: string) => k8s(f).reach?.find((r) => r.from === from && r.to === to)?.status ?? 0;
const pols = (f: Facts, ns: string) => k8s(f).objects.filter((o) => o.kind === 'NetworkPolicy' && o.metadata?.namespace === ns);
const isEmpty = (sel?: Obj) => !sel || (!Object.keys(sel.matchLabels ?? {}).length && !(sel.matchExpressions ?? []).length);
const types = (p: Obj): string[] => p.spec?.policyTypes ?? ['Ingress', ...(p.spec?.egress ? ['Egress'] : [])];

/** A default-deny ingress policy in `ns`: every pod selected, no ingress rule. */
export const hasDenyIngress = (f: Facts, ns: string) => pols(f, ns).some((p) => isEmpty(p.spec?.podSelector) && types(p).includes('Ingress') && !(p.spec?.ingress ?? []).length);
/** Some ingress peer combines namespaceSelector and podSelector in one item (the AND form). */
const hasAndPeer = (f: Facts, ns: string) => pols(f, ns).some((p) => (p.spec?.ingress ?? []).some((r: Obj) => (r.from ?? []).some((peer: Obj) => peer.namespaceSelector && peer.podSelector)));

export const netpolQuiz: QuizItem[] = [
  {
    id: 'k8s.q.np.or',
    kind: 'bugfind',
    concepts: ['k8s.networkpolicy'],
    prompt: bi('Задумано так: «в pay пускать только поды с меткой role=frontend из namespace shop». Но политика пускает больше. Какая строка всё портит?', 'Intended: "let into pay only role=frontend pods from namespace shop". The policy lets in more. Which line spoils it?'),
    code: 'spec:\n  podSelector:\n    matchLabels:\n      app: pay\n  ingress:\n  - from:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: shop\n    - podSelector:\n        matchLabels:\n          role: frontend',
    lang: 'yaml',
    bug: [10],
    why: {
      2: bi('podSelector политики выбирает, кого защищают, то есть поды app=pay. Здесь всё верно.', 'The policy’s podSelector picks whom we protect — the app=pay pods. That is right.'),
      7: bi('Указывать namespace через namespaceSelector по метке kubernetes.io/metadata.name правильно.', 'A namespaceSelector on the kubernetes.io/metadata.name label is the right way to name a namespace.'),
      10: bi('Дефис начинает второй элемент списка from, и теперь правило означает «любой под из shop ИЛИ под с role=frontend из pay». Если убрать дефис, получится одно условие с «И».', 'The dash starts a second item of the from list: now it is "any pod of shop OR a role=frontend pod of pay". Remove the dash — you get one "AND" condition.'),
    },
    refs: { explainer: 'k8s.netpol' },
  },
  {
    id: 'k8s.q.np.dns',
    kind: 'mcq',
    concepts: ['k8s.networkpolicy', 'k8s.default-deny'],
    prompt: bi('В namespace shop включили запрет всего исходящего трафика и разрешили только TCP 80 к namespace pay. Что напечатает `curl http://pay.pay` из пода в shop?', 'In namespace shop a default-deny egress was switched on, and only TCP 80 to namespace pay was allowed. What does `curl http://pay.pay` print from a shop pod?'),
    options: [
      { id: 'dns', text: 'curl: (6) Could not resolve host: pay.pay', correct: true },
      { id: 'ok', text: bi('Ответ pay, ведь TCP 80 разрешён', 'pay’s answer: TCP 80 is allowed, after all'), why: bi('До соединения TCP дело не дошло, потому что имя сначала нужно узнать у CoreDNS по UDP 53, а этот выход политика закрыла.', 'TCP never starts: the name must first be asked of CoreDNS over UDP 53, and the policy closed that way out.') },
      { id: 'refused', text: 'curl: (7) Failed to connect … Connection refused', why: bi('Отказ в соединении (RST) посылает тот, кто получил пакет. Пакет, отброшенный политикой, не получает никакого ответа.', 'A refusal (RST) comes from whoever received the packet. A packet dropped by a policy gets no answer at all.') },
    ],
    explain: bi('Поэтому каждая политика исходящего трафика начинается с правила для DNS, которое разрешает порты UDP и TCP 53 к подам с меткой k8s-app=kube-dns в namespace kube-system.', 'Every egress policy starts with the DNS rule: UDP and TCP 53 to the k8s-app=kube-dns pods in kube-system.'),
    refs: { explainer: 'k8s.netpol' },
  },
  {
    id: 'k8s.q.np.podsel',
    kind: 'mcq',
    concepts: ['k8s.networkpolicy'],
    prompt: bi('В namespace pay стоит политика `from: - podSelector: {matchLabels: {role: frontend}}`. Пропустит ли она под с меткой role=frontend из namespace shop?', 'A policy in namespace pay: `from: - podSelector: {matchLabels: {role: frontend}}`. Does it let in a role=frontend pod from namespace shop?'),
    options: [
      { id: 'no', text: bi('Нет, потому что podSelector без namespaceSelector выбирает поды только в namespace самой политики', 'No, because a podSelector without a namespaceSelector selects pods in the policy’s namespace only'), correct: true },
      { id: 'yes', text: bi('Да, потому что метка совпадает', 'Yes, because the label matches'), why: bi('Метка совпадает, а namespace нет. Чтобы выбрать поды из других namespace, нужен namespaceSelector, хотя бы пустой `{}`, который означает «любой namespace».', 'The label matches, the namespace does not. Selecting pods of other namespaces needs a namespaceSelector — at least an empty `{}` for "any".') },
    ],
  },
  {
    id: 'k8s.q.np.additive',
    kind: 'multi',
    concepts: ['k8s.networkpolicy', 'k8s.default-deny'],
    prompt: bi('Что верно про NetworkPolicy? Отметьте все верные ответы.', 'What is true about NetworkPolicy? Mark everything.'),
    options: [
      { id: 'union', text: bi('Политики складываются, и разрешено всё, что разрешает хотя бы одна из них', 'Policies add up: allowed is whatever at least one allows'), correct: true },
      { id: 'select', text: bi('Под, которого не выбрала ни одна политика, открыт', 'A pod selected by no policy is open'), correct: true },
      { id: 'deny', text: bi('Политикой можно явно запретить один адрес, а всё остальное оставить открытым', 'A policy can explicitly deny one address and leave the rest open'), why: bi('Запрещающих правил в NetworkPolicy нет, есть только разрешения. Исключение внутри разрешения задают полем `ipBlock.except`.', 'NetworkPolicy has no "deny" rules — only allows. An exception inside an allow is `ipBlock.except`.') },
      { id: 'order', text: bi('Порядок политик важен, как у правил iptables', 'The order of policies matters, as in iptables'), why: bi('Порядка у политик нет, и в результате разрешения всех политик объединяются.', 'There is no order: the result is the union of every allow.') },
    ],
  },
];

export const netpolLesson: Lesson = {
  id: 'k8s-1.netpol',
  block: 'k8s-1',
  title: bi('Как NetworkPolicy решает, кто к кому может обращаться', 'NetworkPolicy: who may call whom'),
  summary: bi('По умолчанию в кластере всё открыто. В уроке вы узнаете, как работает запрет по умолчанию (default-deny), как записывают правила from и to, в чём ловушка «И» и «ИЛИ», зачем исходящему трафику правило для DNS и какой плагин всё это исполняет.', 'By default everything is open. default-deny, the from and to rules, the AND/OR trap, egress and the DNS rule, the plugin that enforces it all.'),
  introduces: ['k8s.networkpolicy', 'k8s.default-deny'],
  uses: ['k8s.network-model', 'k8s.cni', 'k8s.label', 'k8s.namespace', 'k8s.cluster-dns', 'k8s.service'],
  tier: 'core',
  minutes: 45,
  sources: src([S.netpol, S.networking], [R.service, R.wikiIptables]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Сетевая модель Kubernetes обещает, что любой под может обратиться к любому другому. В учебном кластере это удобно, а в рабочем опасно: если злоумышленник получил доступ к контейнеру фронтенда, ему сразу открыты база данных, платёжный сервис и API самого кластера. Перегородки внутри кластера ставят объектами [[k8s.networkpolicy|NetworkPolicy]].',
        'The Kubernetes network model promises that any pod reaches any other. In a training cluster that is handy, in production it is dangerous: if an attacker gets into the frontend container, they see the database, the payment service and the cluster’s own API at that very moment. Walls inside a cluster are built with [[k8s.networkpolicy|NetworkPolicy]] objects.',
      ),
    },
    {
      id: 'model',
      kind: 'text',
      step: 'explain',
      title: bi('Политика выбирает поды и только разрешает', 'A policy selects pods and only allows'),
      body: bi(
        'У политики две половины. Первая, `podSelector`, говорит, **кого** защищают: поды её namespace с указанными метками, а пустой селектор `{}` выбирает их все. Вторая половина перечисляет, **что** этим подам можно: правила `ingress` говорят, кто может к ним обращаться, а правила `egress` — куда они могут обращаться сами. Поле `policyTypes` уточняет, какие направления политика держит.\n\nЗапрещающих правил нет. Пока под не выбран ни одной политикой, он открыт полностью. Но как только хотя бы одна политика выбрала его для направления Ingress, к нему пропускают только то, что разрешено, а всё прочее отбрасывается. Политики складываются: разрешено то, что разрешает хотя бы одна, и порядок политик не важен.\n\nОтсюда первый приём — [[k8s.default-deny|запрет по умолчанию (default-deny)]], то есть политика с пустым `podSelector` и без единого правила. Она выбирает все поды namespace и ничего не разрешает. С неё начинают защиту, а потом отдельными политиками открывают нужные пути, например «к pay — с фронтенда на порт 80».\n\nНа отброшенный пакет никто не отвечает. Поэтому политику выдаёт не отказ в соединении, а тайм-аут при работающем поде: клиент ждёт, пока не сдастся.',
        'A policy has two halves. The first, `podSelector`, says **whom** we protect: the pods of its namespace with these labels; an empty selector `{}` picks them all. The second lists **what** those pods may do: `ingress` rules (who may come in) and `egress` rules (where they may go). The `policyTypes` field states which directions the policy holds.\n\nThere are no deny rules. As long as no policy selects a pod, it is fully open. As soon as at least one policy selects it for the Ingress direction, only what is allowed gets in and everything else is dropped. Policies add up: allowed is whatever at least one allows, and their order does not matter.\n\nHence the first technique — [[k8s.default-deny|default-deny]]: a policy with an empty `podSelector` and not a single rule. It selects every pod of the namespace and allows nothing. Protection starts with it, and then separate policies open the needed paths: "into pay — from the frontend, on port 80".\n\nA dropped packet gets no answer. So the sign of a policy is not "connection refused" but a timeout while the pod is alive: the client waits until it gives up.',
      ),
    },
    {
      id: 'peers',
      kind: 'text',
      step: 'explain',
      title: bi('Как один дефис меняет список тех, кому разрешено обращаться', 'How one dash changes who is allowed in'),
      body: bi(
        'Каждый элемент списка `from` (или `to`) описывает одного собеседника. Задать его можно тремя способами:\n\n- `podSelector` — поды с указанными метками **в namespace самой политики**;\n- `namespaceSelector` — все поды из namespace с указанными метками; у каждого namespace есть метка `kubernetes.io/metadata.name` с его именем;\n- `ipBlock` — диапазон адресов, обычно для внешнего мира.\n\nЕсли в **одном** элементе указаны и `namespaceSelector`, и `podSelector`, условия соединяются через «И»: «поды с role=frontend в namespace shop». Если это **два** элемента, то есть в YAML стоят два дефиса, условия соединяются через «ИЛИ»: «любой под из shop или под с role=frontend из namespace самой политики». Разница в одном символе, а последствия — от «закрыто» до «открыто всему магазину». Схема ниже показывает обе формы на одних и тех же подах.\n\nМетка в чужом namespace не помогает: под с role=frontend из namespace dev не пройдёт по правилу, в котором namespaceSelector не указан.',
        'Every item of the `from` (or `to`) list is one "peer". It can be given in three ways:\n\n- `podSelector` — pods with these labels **in the namespace of the policy itself**;\n- `namespaceSelector` — every pod of the namespaces with these labels; every namespace has the label `kubernetes.io/metadata.name` with its name;\n- `ipBlock` — a range of addresses, usually for the outside world.\n\nIf **one** item has both `namespaceSelector` and `podSelector`, the conditions combine as "AND": "role=frontend pods in namespace shop". If they are **two** items — two dashes in the YAML — they combine as "OR": "any pod of shop, or a role=frontend pod of the policy’s own namespace". The difference is one character, and the consequences range from "closed" to "open to the whole shop". The explainer below shows both forms on the same pods.\n\nA label in another namespace does not help a podSelector: a role=frontend pod from namespace dev does not pass a rule with no namespaceSelector.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Кого пропускает политика', 'Whom the policy lets through'),
      body: bi(
        'Схема ниже проверяет политику на трёх клиентах. Пунктирные рамки обозначают три namespace: shop, dev и pay. Сначала на схеме только платёжный сервис pay, политика рядом с ним и исполнитель политик посередине, то есть агент плагина сети, который превращает политику в правила ядра. Клиенты появляются по одному: frontend из shop с меткой role=frontend, client из shop без этой метки и debug из dev с той же меткой role=frontend, а последним шагом frontend пытается выйти в интернет.',
        'The diagram below tests the policy on three clients. The dashed frames are three namespaces: shop, dev and pay. At first only pay, its policy and the enforcer in the middle are shown. The clients appear one by one: frontend from shop with role=frontend, client from shop without it, debug from dev with role=frontend, and last frontend tries the internet.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.netpol', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Каждый шаг показывает одно соединение: подсвечен клиент, который пытается обратиться к pay, линия становится зелёной, если соединение прошло, и красной, если пакет отброшен, а подпись под схемой объясняет, какое правило так решило.\n\nКогда пройдёте все соединения, переключите в «Параметрах» политику с «И» на «ИЛИ» и посмотрите, что случится с debug. Потом включите ограничение исходящего трафика в shop сначала без разрешения DNS, а затем с ним, если у вас уровень выше начального. Напоследок выберите чистый flannel в поле «Какой плагин сети стоит в кластере» и посмотрите, что станет с политикой, когда исполнять её некому.', 'Press “Start from the first step”, then go on with “Step forward”. Each step shows one connection: the client trying to reach pay is highlighted, the line turns green if the connection went through and red if the packet was dropped, and the caption under the diagram explains which rule decided.\n\nOnce you have gone through all connections, switch the policy from AND to OR in “Parameters” and see what happens to debug. Then turn on the egress restriction in shop, first without allowing DNS and then, above beginner level, with it. Finally, choose plain flannel in “The cluster’s network plugin” and see what becomes of the policy when nobody enforces it.'), caption: bi('Обе ловушки, «ИЛИ» вместо «И» и закрытый DNS, встретятся вам в лабораторной работе ниже. Когда клиент из чужого namespace неожиданно пройдёт или клиент из shop перестанет находить pay по имени, вспомните, на каком шаге схемы случилось то же самое.', 'Both traps, OR instead of AND and the closed DNS, meet you in the lab below. When a client from another namespace unexpectedly gets through, or the shop client stops finding pay by name, recall the step of the diagram where the same happened.') },
    {
      id: 'egress',
      kind: 'text',
      step: 'explain',
      title: bi('Исходящий трафик, DNS и тот, кто исполняет политики', 'Egress, DNS and the one who enforces'),
      body: bi(
        'Правила `egress` ограничивают, куда поды могут обращаться сами. Они защищают от утечек, потому что взломанный под не сможет отправить данные на чужой сервер. Но у таких правил есть ловушка, на которой спотыкается почти каждый. Под обращается к Service по имени, а имя ему сообщает CoreDNS по UDP 53. Если закрыть исходящий трафик и разрешить только `pay:80`, то `curl http://pay.pay` ответит «Could not resolve host», и до соединения TCP дело не дойдёт. Поэтому любая политика исходящего трафика начинается с правила для DNS, которое разрешает порты UDP и TCP 53 к подам `k8s-app=kube-dns` в namespace kube-system.\n\nИ последнее. NetworkPolicy остаётся только записью в API, а исполняет её сетевой плагин, агент которого на каждом узле читает политики и превращает их в правила ядра. Calico, Cilium и встроенный в k3s kube-router политики исполняют, а чистый flannel нет. API-сервер примет политику в любом кластере, поэтому, если политика есть, а трафик всё равно идёт, первым делом выясните, какой плагин сети стоит в кластере.',
        '`egress` rules restrict where pods may go themselves. They help against leaks: a compromised pod cannot send data to a foreign server. But egress has a trap that almost everyone trips over. A pod reaches a Service by name, and CoreDNS tells it the name over UDP 53. Close egress allowing only `pay:80` — and `curl http://pay.pay` answers "Could not resolve host": TCP never starts. So every egress policy starts with the DNS rule: UDP and TCP 53 to the `k8s-app=kube-dns` pods in namespace kube-system.\n\nOne last thing. A NetworkPolicy is only a record in the API, and the network plugin enforces it: its agent on every node reads the policies through watch and turns them into kernel rules. Calico, Cilium and the kube-router built into k3s enforce policies, plain flannel does not. The API server accepts a policy in any cluster, so "the policy is there but traffic flows" is a reason to ask first which CNI the cluster runs.',
      ),
    },
    {
      id: 'docs',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте страницу Network Policies и найдите раздел, в котором объяснено, чем один элемент `from` с двумя селекторами отличается от двух элементов.', 'Open the Network Policies page and find the section that explains how one `from` item with two selectors differs from two items.'),
      ref: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'behavior-of-to-and-from-selectors' },
      answer: 'behavior-of-to-and-from-selectors',
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: NETPOL_LAB,
      intro: bi('В namespace `pay` работают Deployment и Service `pay`, в namespace `dev` — Service `web`. Есть два пода `client`, в `shop` и в `dev`, и у обоих метка role=frontend. Сейчас всё открыто. Политики удобно писать в файл командой `cat > np.yaml` и применять командой `kubectl apply -f`.', 'Namespace `pay` with a Deployment and Service `pay`, namespace `dev` with a Service `web`. Two pods named `client`: in `shop` and in `dev`, both labelled role=frontend. Everything is open now. Policies are easiest written into a file (`cat > np.yaml`) and applied with `kubectl apply -f`.'),
      tasks: [
        {
          id: 'deny',
          prompt: bi('Закройте namespace `pay` политикой default-deny для входящего трафика: после неё до `pay` не должен дойти ни один клиент.', 'Close namespace `pay` with a default-deny policy for incoming traffic: after it neither client may reach `pay`.'),
          check: {
            when: (f) => hasDenyIngress(f, 'pay') && reach(f, 'shop/client', 'pay.pay') !== 200 && reach(f, 'dev/client', 'pay.pay') !== 200,
            fail: [{ if: (f) => pols(f, 'pay').length > 0 && !hasDenyIngress(f, 'pay'), say: bi('Политика есть, но она не запрещает всё по умолчанию (default-deny). Для этого у неё должны быть пустой podSelector `{}`, тип Ingress и ни одного правила ingress.', 'There is a policy, but it is not a default-deny: it needs an empty podSelector `{}`, the Ingress type and no ingress rule at all.') }],
          },
          chips: 'kubectl apply -f deny.yaml',
          concepts: ['k8s.default-deny'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'default-policies', line: 'default-deny-ingress' },
          hints: { H1: bi('Пустой селектор выбирает все поды namespace, а правило, которого нет, ничего не разрешает.', 'An empty selector picks every pod of the namespace; a rule that is not there allows nothing.'), H2: bi('Образец есть на странице Network Policies в разделе Default policies.', 'The template is on the Network Policies page, section Default policies.') },
        },
        {
          id: 'frontend',
          prompt: bi('Не удаляя default-deny, пропустите к `pay` на порт 80 только поды с role=frontend из namespace `shop`. Клиент из `dev` с той же меткой должен остаться снаружи.', 'Without deleting the default-deny, let into `pay` on port 80 only role=frontend pods from namespace `shop`. The client from `dev` with the same label must stay outside.'),
          check: {
            when: (f) => hasDenyIngress(f, 'pay') && hasAndPeer(f, 'pay') && reach(f, 'shop/client', 'pay.pay') === 200 && reach(f, 'dev/client', 'pay.pay') !== 200,
            fail: [
              { if: (f) => !hasDenyIngress(f, 'pay'), say: bi('Политика default-deny пропала. Разрешения добавляют отдельной политикой рядом с запретом, а не правкой самого запрета.', 'The default-deny is gone. Allows are added as a separate policy next to it, not by editing the deny.') },
              { if: (f) => reach(f, 'dev/client', 'pay.pay') === 200, say: bi('Клиент из dev прошёл, потому что политика выбирает по метке и не смотрит на namespace. Нужны оба условия в одном элементе from.', 'The client from dev got through: the policy selects by label without looking at the namespace. You need both conditions in one from item.') },
              { if: (f) => reach(f, 'shop/client', 'pay.pay') === 200 && !hasAndPeer(f, 'pay'), say: bi('Клиент из shop проходит, но через «ИЛИ», и сейчас к pay пустят любой под из shop. Сведите namespaceSelector и podSelector в один элемент.', 'The shop client gets through, but by "OR": any pod of shop is let into pay now. Put namespaceSelector and podSelector into one item.') },
            ],
          },
          chips: 'kubectl apply -f allow-frontend.yaml',
          concepts: ['k8s.networkpolicy'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'behavior-of-to-and-from-selectors', line: 'single from element' },
          hints: {
            H1: bi('Namespace выбирают по метке kubernetes.io/metadata.name.', 'A namespace is selected by the kubernetes.io/metadata.name label.'),
            H2: bi('Нужен один элемент `from` с двумя ключами, namespaceSelector и podSelector, без второго дефиса.', 'One `from` item with two keys: namespaceSelector and podSelector — without a second dash.'),
          },
        },
        {
          id: 'egress',
          prompt: bi('Теперь ограничьте исходящий трафик так, чтобы поды namespace `shop` могли обращаться только к `pay` на порт 80. Клиент из `shop` по-прежнему получает ответ `pay` по имени, а до `web` в namespace `dev` не доходит.', 'Now egress: the pods of namespace `shop` may go only to `pay` on port 80. The client in `shop` still gets an answer from `pay` by name, and cannot reach `web` in namespace `dev`.'),
          check: {
            when: (f) => reach(f, 'shop/client', 'pay.pay') === 200 && reach(f, 'shop/client', 'web.dev') !== 200 && pols(f, 'shop').some((p) => types(p).includes('Egress')),
            fail: [{ if: (f) => pols(f, 'shop').some((p) => types(p).includes('Egress')) && reach(f, 'shop/client', 'pay.pay') !== 200, say: bi('Клиент из shop больше не доходит даже до pay. Проверьте имя командой `kubectl -n shop exec client -- nslookup pay.pay`. Если тайм-аут, политике не хватает правила для DNS.', 'The shop client no longer reaches even pay. Check the name: `kubectl -n shop exec client -- nslookup pay.pay`. If it times out, the policy lacks the DNS rule.') }],
          },
          chips: 'kubectl -n shop exec client -- nslookup pay.pay',
          concepts: ['k8s.networkpolicy', 'k8s.cluster-dns'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'default-policies', line: 'cluster DNS' },
          hints: {
            H1: bi('Под обращается к Service по имени, а имя ему сообщает CoreDNS.', 'A pod reaches a Service by name, and CoreDNS tells it the name.'),
            H2: bi('Нужны два правила egress: к namespace pay на TCP 80 и к подам k8s-app=kube-dns в kube-system на UDP 53.', 'Two egress rules: to namespace pay on TCP 80, and to the k8s-app=kube-dns pods in kube-system on UDP 53.'),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: netpolQuiz.map((q) => q.id) },
  ],
};
