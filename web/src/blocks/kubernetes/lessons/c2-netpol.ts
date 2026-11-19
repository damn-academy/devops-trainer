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
    prompt: bi('Задумано: «в pay пускать только поды role=frontend из namespace shop». Политика пускает больше. Какая строка всё портит?', 'Intended: "let into pay only role=frontend pods from namespace shop". The policy lets in more. Which line spoils it?'),
    code: 'spec:\n  podSelector:\n    matchLabels:\n      app: pay\n  ingress:\n  - from:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: shop\n    - podSelector:\n        matchLabels:\n          role: frontend',
    lang: 'yaml',
    bug: [10],
    why: {
      2: bi('podSelector политики выбирает, кого защищаем, — поды app=pay. Это верно.', 'The policy’s podSelector picks whom we protect — the app=pay pods. That is right.'),
      7: bi('namespaceSelector по метке kubernetes.io/metadata.name — правильный способ назвать namespace.', 'A namespaceSelector on the kubernetes.io/metadata.name label is the right way to name a namespace.'),
      10: bi('Чёрточка начинает второй элемент списка from: теперь это «любой под из shop ИЛИ под role=frontend из pay». Уберите чёрточку — получится одно условие «И».', 'The dash starts a second item of the from list: now it is "any pod of shop OR a role=frontend pod of pay". Remove the dash — you get one "AND" condition.'),
    },
    refs: { explainer: 'k8s.netpol' },
  },
  {
    id: 'k8s.q.np.dns',
    kind: 'mcq',
    concepts: ['k8s.networkpolicy', 'k8s.default-deny'],
    prompt: bi('В namespace shop включили default-deny для egress и разрешили только TCP 80 в namespace pay. Что напишет `curl http://pay.pay` из пода shop?', 'In namespace shop a default-deny egress was switched on, and only TCP 80 to namespace pay was allowed. What does `curl http://pay.pay` print from a shop pod?'),
    options: [
      { id: 'dns', text: 'curl: (6) Could not resolve host: pay.pay', correct: true },
      { id: 'ok', text: bi('Ответ pay: TCP 80 же разрешён', 'pay’s answer: TCP 80 is allowed, after all'), why: bi('До TCP дело не дошло: имя надо сначала узнать у CoreDNS по UDP 53, а этот выход политика закрыла.', 'TCP never starts: the name must first be asked of CoreDNS over UDP 53, and the policy closed that way out.') },
      { id: 'refused', text: 'curl: (7) Failed to connect … Connection refused', why: bi('Отказ (RST) даёт тот, кто получил пакет. Отброшенный политикой пакет не получает никакого ответа.', 'A refusal (RST) comes from whoever received the packet. A packet dropped by a policy gets no answer at all.') },
    ],
    explain: bi('Каждая egress-политика начинается с правила DNS: UDP и TCP 53 к подам k8s-app=kube-dns в kube-system.', 'Every egress policy starts with the DNS rule: UDP and TCP 53 to the k8s-app=kube-dns pods in kube-system.'),
    refs: { explainer: 'k8s.netpol' },
  },
  {
    id: 'k8s.q.np.podsel',
    kind: 'mcq',
    concepts: ['k8s.networkpolicy'],
    prompt: bi('Политика в namespace pay: `from: - podSelector: {matchLabels: {role: frontend}}`. Пустит ли она под role=frontend из namespace shop?', 'A policy in namespace pay: `from: - podSelector: {matchLabels: {role: frontend}}`. Does it let in a role=frontend pod from namespace shop?'),
    options: [
      { id: 'no', text: bi('Нет: podSelector без namespaceSelector выбирает поды только в namespace политики', 'No: a podSelector without a namespaceSelector selects pods in the policy’s namespace only'), correct: true },
      { id: 'yes', text: bi('Да: метка совпадает', 'Yes: the label matches'), why: bi('Метка совпадает, а namespace нет. Чтобы выбрать поды других namespace, нужен namespaceSelector — хотя бы пустой `{}` для «любого».', 'The label matches, the namespace does not. Selecting pods of other namespaces needs a namespaceSelector — at least an empty `{}` for "any".') },
    ],
  },
  {
    id: 'k8s.q.np.additive',
    kind: 'multi',
    concepts: ['k8s.networkpolicy', 'k8s.default-deny'],
    prompt: bi('Что верно про NetworkPolicy? Отметьте всё.', 'What is true about NetworkPolicy? Mark everything.'),
    options: [
      { id: 'union', text: bi('Политики складываются: разрешено то, что разрешает хотя бы одна', 'Policies add up: allowed is whatever at least one allows'), correct: true },
      { id: 'select', text: bi('Под, не выбранный ни одной политикой, открыт', 'A pod selected by no policy is open'), correct: true },
      { id: 'deny', text: bi('Политикой можно явно запретить один адрес, оставив остальное открытым', 'A policy can explicitly deny one address and leave the rest open'), why: bi('Правил «запретить» в NetworkPolicy нет — только разрешения. Исключение внутри разрешения даёт `ipBlock.except`.', 'NetworkPolicy has no "deny" rules — only allows. An exception inside an allow is `ipBlock.except`.') },
      { id: 'order', text: bi('Важен порядок политик, как у iptables', 'The order of policies matters, as in iptables'), why: bi('Порядка нет: результат — объединение всех разрешений.', 'There is no order: the result is the union of every allow.') },
    ],
  },
];

export const netpolLesson: Lesson = {
  id: 'k8s-1.netpol',
  block: 'k8s-1',
  title: bi('NetworkPolicy: кто кому может звонить', 'NetworkPolicy: who may call whom'),
  summary: bi('По умолчанию всё открыто. default-deny, правила from и to, ловушка «И/ИЛИ», egress и правило DNS, плагин, который всё это исполняет.', 'By default everything is open. default-deny, the from and to rules, the AND/OR trap, egress and the DNS rule, the plugin that enforces it all.'),
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
        'Сетевая модель Kubernetes обещает, что любой под достаёт до любого. В учебном кластере это удобно, в рабочем опасно: если злоумышленник получил доступ к контейнеру фронтенда, он в тот же миг видит базу данных, платёжный сервис и API самого кластера. Стены внутри кластера ставят объектами [[k8s.networkpolicy|NetworkPolicy]].',
        'The Kubernetes network model promises that any pod reaches any other. In a training cluster that is handy, in production it is dangerous: if an attacker gets into the frontend container, they see the database, the payment service and the cluster’s own API at that very moment. Walls inside a cluster are built with [[k8s.networkpolicy|NetworkPolicy]] objects.',
      ),
    },
    {
      id: 'model',
      kind: 'text',
      step: 'explain',
      title: bi('Политика выбирает поды и только разрешает', 'A policy selects pods and only allows'),
      body: bi(
        'У политики две половины. Первая, `podSelector`, говорит, **кого** защищаем: поды её namespace с такими метками; пустой селектор `{}` выбирает все. Вторая перечисляет, **что** этим подам можно: правила `ingress` (кто может прийти) и `egress` (куда можно пойти). Поле `policyTypes` уточняет, какие направления политика держит.\n\nЗапрещающих правил нет. Пока под не выбран ни одной политикой, он открыт полностью. Как только хотя бы одна политика выбрала его для направления Ingress, к нему пускают только то, что разрешено, а прочее отбрасывается. Политики складываются: разрешено то, что разрешает хотя бы одна, и порядок их не важен.\n\nОтсюда первый приём — [[k8s.default-deny|default-deny]]: политика с пустым `podSelector` и без единого правила. Она выбирает все поды namespace и ничего не разрешает. С неё начинают защиту, а затем отдельными политиками открывают нужные пути: «в pay — с фронтенда на порт 80».\n\nОтброшенный пакет не получает ответа. Поэтому признак политики — не «connection refused», а тайм-аут при живом поде: клиент ждёт, пока не сдастся.',
        'A policy has two halves. The first, `podSelector`, says **whom** we protect: the pods of its namespace with these labels; an empty selector `{}` picks them all. The second lists **what** those pods may do: `ingress` rules (who may come in) and `egress` rules (where they may go). The `policyTypes` field states which directions the policy holds.\n\nThere are no deny rules. As long as no policy selects a pod, it is fully open. As soon as at least one policy selects it for the Ingress direction, only what is allowed gets in and everything else is dropped. Policies add up: allowed is whatever at least one allows, and their order does not matter.\n\nHence the first technique — [[k8s.default-deny|default-deny]]: a policy with an empty `podSelector` and not a single rule. It selects every pod of the namespace and allows nothing. Protection starts with it, and then separate policies open the needed paths: "into pay — from the frontend, on port 80".\n\nA dropped packet gets no answer. So the sign of a policy is not "connection refused" but a timeout while the pod is alive: the client waits until it gives up.',
      ),
    },
    {
      id: 'peers',
      kind: 'text',
      step: 'explain',
      title: bi('Откуда: одна чёрточка меняет смысл', 'From where: one dash changes the meaning'),
      body: bi(
        'Каждый элемент списка `from` (или `to`) — это один «собеседник». Он может быть задан тремя способами:\n\n- `podSelector` — поды с такими метками **в namespace самой политики**;\n- `namespaceSelector` — все поды namespace с такими метками; у каждого namespace есть метка `kubernetes.io/metadata.name` с его именем;\n- `ipBlock` — диапазон адресов, обычно для внешнего мира.\n\nЕсли в **одном** элементе указаны и `namespaceSelector`, и `podSelector`, условия складываются через «И»: «поды role=frontend в namespace shop». Если это **два** элемента — две чёрточки в YAML, — условия складываются через «ИЛИ»: «любой под из shop или под role=frontend из namespace самой политики». Разница в одном символе, а последствия — от «закрыто» до «открыто всему магазину». Объяснение ниже показывает обе формы на одних и тех же подах.\n\nОт метки в чужом namespace podSelector не спасает: под role=frontend из namespace dev не пройдёт по правилу, где namespaceSelector не указан.',
        'Every item of the `from` (or `to`) list is one "peer". It can be given in three ways:\n\n- `podSelector` — pods with these labels **in the namespace of the policy itself**;\n- `namespaceSelector` — every pod of the namespaces with these labels; every namespace has the label `kubernetes.io/metadata.name` with its name;\n- `ipBlock` — a range of addresses, usually for the outside world.\n\nIf **one** item has both `namespaceSelector` and `podSelector`, the conditions combine as "AND": "role=frontend pods in namespace shop". If they are **two** items — two dashes in the YAML — they combine as "OR": "any pod of shop, or a role=frontend pod of the policy’s own namespace". The difference is one character, and the consequences range from "closed" to "open to the whole shop". The explainer below shows both forms on the same pods.\n\nA label in another namespace does not help a podSelector: a role=frontend pod from namespace dev does not pass a rule with no namespaceSelector.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.netpol', caption: bi('Переключайте политику между «И» и «ИЛИ» и следите за debug. Включите egress в shop без DNS, потом с DNS. Поставьте чистый flannel.', 'Switch the policy between AND and OR and watch debug. Turn on egress in shop without DNS, then with DNS. Put plain flannel in.') },
    {
      id: 'egress',
      kind: 'text',
      step: 'explain',
      title: bi('Egress, DNS и тот, кто исполняет', 'Egress, DNS and the one who enforces'),
      body: bi(
        'Правила `egress` ограничивают, куда поды могут ходить сами. Они полезны против утечек: взломанный под не отправит данные на чужой сервер. Но у egress есть ловушка, на которой спотыкается почти каждый. Под ходит к Service по имени, а имя ему сообщает CoreDNS по UDP 53. Закрыли egress, разрешив только `pay:80`, — и `curl http://pay.pay` отвечает «Could not resolve host»: до TCP дело не доходит. Поэтому любая egress-политика начинается с правила DNS: UDP и TCP 53 к подам `k8s-app=kube-dns` в namespace kube-system.\n\nИ последнее. NetworkPolicy — только запись в API, а исполняет её сетевой плагин: его агент на каждом узле читает политики через watch и превращает в правила ядра. Calico, Cilium и встроенный в k3s kube-router политики исполняют, чистый flannel — нет. API-сервер примет политику в любом кластере, так что «политика есть, а трафик идёт» — повод первым делом спросить, какой CNI стоит в кластере.',
        '`egress` rules restrict where pods may go themselves. They help against leaks: a compromised pod cannot send data to a foreign server. But egress has a trap that almost everyone trips over. A pod reaches a Service by name, and CoreDNS tells it the name over UDP 53. Close egress allowing only `pay:80` — and `curl http://pay.pay` answers "Could not resolve host": TCP never starts. So every egress policy starts with the DNS rule: UDP and TCP 53 to the `k8s-app=kube-dns` pods in namespace kube-system.\n\nOne last thing. A NetworkPolicy is only a record in the API, and the network plugin enforces it: its agent on every node reads the policies through watch and turns them into kernel rules. Calico, Cilium and the kube-router built into k3s enforce policies, plain flannel does not. The API server accepts a policy in any cluster, so "the policy is there but traffic flows" is a reason to ask first which CNI the cluster runs.',
      ),
    },
    {
      id: 'docs',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте страницу Network Policies и найдите раздел, где объяснено, чем один элемент `from` с двумя селекторами отличается от двух элементов.', 'Open the Network Policies page and find the section that explains how one `from` item with two selectors differs from two items.'),
      ref: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'behavior-of-to-and-from-selectors' },
      answer: 'behavior-of-to-and-from-selectors',
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: NETPOL_LAB,
      intro: bi('Namespace `pay` с Deployment и Service `pay`, namespace `dev` с Service `web`. Два пода `client`: в `shop` и в `dev`, оба с меткой role=frontend. Сейчас всё открыто. Политики удобно писать в файл (`cat > np.yaml`) и применять `kubectl apply -f`.', 'Namespace `pay` with a Deployment and Service `pay`, namespace `dev` with a Service `web`. Two pods named `client`: in `shop` and in `dev`, both labelled role=frontend. Everything is open now. Policies are easiest written into a file (`cat > np.yaml`) and applied with `kubectl apply -f`.'),
      tasks: [
        {
          id: 'deny',
          prompt: bi('Закройте namespace `pay` политикой default-deny для входящего трафика: после неё до `pay` не должен достучаться ни один из клиентов.', 'Close namespace `pay` with a default-deny policy for incoming traffic: after it neither client may reach `pay`.'),
          check: {
            when: (f) => hasDenyIngress(f, 'pay') && reach(f, 'shop/client', 'pay.pay') !== 200 && reach(f, 'dev/client', 'pay.pay') !== 200,
            fail: [{ if: (f) => pols(f, 'pay').length > 0 && !hasDenyIngress(f, 'pay'), say: bi('Политика есть, но это не default-deny: у неё должен быть пустой podSelector `{}`, тип Ingress и ни одного правила ingress.', 'There is a policy, but it is not a default-deny: it needs an empty podSelector `{}`, the Ingress type and no ingress rule at all.') }],
          },
          chips: 'kubectl apply -f deny.yaml',
          concepts: ['k8s.default-deny'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'default-policies', line: 'default-deny-ingress' },
          hints: { H1: bi('Пустой селектор выбирает все поды namespace; правило, которого нет, ничего не разрешает.', 'An empty selector picks every pod of the namespace; a rule that is not there allows nothing.'), H2: bi('Образец — на странице Network Policies, раздел Default policies.', 'The template is on the Network Policies page, section Default policies.') },
        },
        {
          id: 'frontend',
          prompt: bi('Не удаляя default-deny, пустите в `pay` на порт 80 только поды role=frontend из namespace `shop`. Клиент из `dev` с той же меткой должен остаться снаружи.', 'Without deleting the default-deny, let into `pay` on port 80 only role=frontend pods from namespace `shop`. The client from `dev` with the same label must stay outside.'),
          check: {
            when: (f) => hasDenyIngress(f, 'pay') && hasAndPeer(f, 'pay') && reach(f, 'shop/client', 'pay.pay') === 200 && reach(f, 'dev/client', 'pay.pay') !== 200,
            fail: [
              { if: (f) => !hasDenyIngress(f, 'pay'), say: bi('default-deny пропала. Разрешения добавляют отдельной политикой рядом, а не правкой запрета.', 'The default-deny is gone. Allows are added as a separate policy next to it, not by editing the deny.') },
              { if: (f) => reach(f, 'dev/client', 'pay.pay') === 200, say: bi('Клиент из dev прошёл: политика выбирает по метке, не глядя на namespace. Нужны оба условия в одном элементе from.', 'The client from dev got through: the policy selects by label without looking at the namespace. You need both conditions in one from item.') },
              { if: (f) => reach(f, 'shop/client', 'pay.pay') === 200 && !hasAndPeer(f, 'pay'), say: bi('Клиент shop проходит, но через «ИЛИ»: сейчас в pay пустят любой под из shop. Сведите namespaceSelector и podSelector в один элемент.', 'The shop client gets through, but by "OR": any pod of shop is let into pay now. Put namespaceSelector and podSelector into one item.') },
            ],
          },
          chips: 'kubectl apply -f allow-frontend.yaml',
          concepts: ['k8s.networkpolicy'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'behavior-of-to-and-from-selectors', line: 'single from element' },
          hints: {
            H1: bi('Namespace выбирают по метке kubernetes.io/metadata.name.', 'A namespace is selected by the kubernetes.io/metadata.name label.'),
            H2: bi('Один элемент `from` с двумя ключами: namespaceSelector и podSelector — без второй чёрточки.', 'One `from` item with two keys: namespaceSelector and podSelector — without a second dash.'),
          },
        },
        {
          id: 'egress',
          prompt: bi('Теперь egress: поды namespace `shop` могут ходить только в `pay` на порт 80. Клиент из `shop` по-прежнему получает ответ `pay` по имени, а до `web` в namespace `dev` не достаёт.', 'Now egress: the pods of namespace `shop` may go only to `pay` on port 80. The client in `shop` still gets an answer from `pay` by name, and cannot reach `web` in namespace `dev`.'),
          check: {
            when: (f) => reach(f, 'shop/client', 'pay.pay') === 200 && reach(f, 'shop/client', 'web.dev') !== 200 && pols(f, 'shop').some((p) => types(p).includes('Egress')),
            fail: [{ if: (f) => pols(f, 'shop').some((p) => types(p).includes('Egress')) && reach(f, 'shop/client', 'pay.pay') !== 200, say: bi('Клиент shop больше не достаёт даже до pay. Проверьте имя: `kubectl -n shop exec client -- nslookup pay.pay`. Если тайм-аут — политике не хватает правила DNS.', 'The shop client no longer reaches even pay. Check the name: `kubectl -n shop exec client -- nslookup pay.pay`. If it times out, the policy lacks the DNS rule.') }],
          },
          chips: 'kubectl -n shop exec client -- nslookup pay.pay',
          concepts: ['k8s.networkpolicy', 'k8s.cluster-dns'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'default-policies', line: 'cluster DNS' },
          hints: {
            H1: bi('Под ходит к Service по имени, а имя ему сообщает CoreDNS.', 'A pod reaches a Service by name, and CoreDNS tells it the name.'),
            H2: bi('Два правила egress: к namespace pay на TCP 80 и к подам k8s-app=kube-dns в kube-system на UDP 53.', 'Two egress rules: to namespace pay on TCP 80, and to the k8s-app=kube-dns pods in kube-system on UDP 53.'),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: netpolQuiz.map((q) => q.id) },
  ],
};
