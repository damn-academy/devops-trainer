// Scaling by load: the metrics pipeline (kubelet → metrics-server → Metrics
// API), the HorizontalPodAutoscaler as one more loop in
// kube-controller-manager, why it needs requests, and what it does not do
// (predict, add nodes). The constructor grows by the metrics layer here.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import type { Obj } from '../../../engine/kube-lite/util';
import { SCALING_LAB } from '../setups';
import { R, S, src } from '../sources';

const k8s = (f: Facts) => f.k8s as K8sFacts;
const hpaOf = (f: Facts): Obj | undefined => k8s(f).objects.find((o) => o.kind === 'HorizontalPodAutoscaler' && o.metadata?.namespace === 'default' && o.metadata?.name === 'web');
const webTemplate = (f: Facts): Obj | undefined => k8s(f).objects.find((o) => o.kind === 'Deployment' && o.metadata?.namespace === 'default' && o.metadata?.name === 'web');
const hasCpuRequest = (f: Facts) => (webTemplate(f)?.spec?.template?.spec?.containers ?? []).some((c: Obj) => !!c.resources?.requests?.cpu);
const measuring = (f: Facts) => (hpaOf(f)?.status?.currentMetrics ?? []).length > 0;

export const scalingQuiz: QuizItem[] = [
  {
    id: 'k8s.q.scale.unknown',
    kind: 'mcq',
    concepts: ['k8s.hpa', 'k8s.metrics-server'],
    prompt: bi(
      'У HPA в столбце TARGETS стоит «cpu: <unknown>/50%», а `kubectl top pods` отвечает «error: Metrics API not available». Какого дополнения не хватает кластеру?',
      'The HPA TARGETS column shows "cpu: <unknown>/50%", and `kubectl top pods` says "error: Metrics API not available". Which add-on is missing?',
    ),
    options: [
      { id: 'ms', text: bi('metrics-server', 'metrics-server'), correct: true },
      { id: 'prom', text: bi('Prometheus', 'Prometheus'), why: bi('Prometheus собирает метрики для графиков и алертов, но HPA по умолчанию берёт цифры из Metrics API, а этот API отдаёт metrics-server.', 'Prometheus collects metrics for graphs and alerts, but the HPA reads the Metrics API by default, and metrics-server serves it.') },
      { id: 'node', text: bi('Ещё одного узла, потому что подам не хватает процессора', 'One more node, because the pods lack CPU'), why: bi('Нехватка процессора выглядела бы иначе: новые поды стояли бы в Pending с «Insufficient cpu». Здесь же не отвечает сам API метрик, и HPA не знает, сколько процессора тратят поды.', 'A CPU shortage looks different: new pods would be Pending with "Insufficient cpu". Here the Metrics API itself does not answer, so the HPA does not know how much CPU the pods use.') },
    ],
  },
  {
    id: 'k8s.q.scale.requests',
    kind: 'mcq',
    concepts: ['k8s.hpa', 'k8s.resources'],
    prompt: bi(
      '`kubectl top pods` показывает потребление подов `web`, а HPA для них по-прежнему пишет «<unknown>/50%», и в его событиях есть «missing request for cpu». Что нужно сделать?',
      '`kubectl top pods` shows the usage of the `web` pods, yet their HPA still says "<unknown>/50%", with "missing request for cpu" in its events. What has to be done?',
    ),
    options: [
      { id: 'req', text: bi('Записать в шаблон пода `resources.requests.cpu`, потому что 50 процентов считаются от запроса', 'Put `resources.requests.cpu` into the pod template, because the 50 percent are counted from the request'), correct: true },
      { id: 'ms', text: bi('Переустановить metrics-server', 'Reinstall metrics-server'), why: bi('metrics-server работает, ведь `kubectl top` его цифры показывает. HPA не может перевести миллиядра в проценты, потому что не знает, от чего считать.', 'metrics-server works: `kubectl top` shows its numbers. The HPA cannot turn millicores into percent because it does not know what to count from.') },
      { id: 'limit', text: bi('Записать `resources.limits.cpu`', 'Put `resources.limits.cpu`'), why: bi('Предел процессора HPA не использует. Если записать только limits, Kubernetes подставит такой же requests, и это сработает случайно, но заодно ограничит процессор подов.', 'The HPA does not use the CPU limit. If you set only limits, Kubernetes copies them into requests, and it works by accident while also capping the pods’ CPU.') },
    ],
  },
  {
    id: 'k8s.q.scale.math',
    kind: 'mcq',
    concepts: ['k8s.hpa'],
    prompt: bi(
      'У Deployment две реплики, каждая просит 200m процессора, цель HPA — 50 процентов от запроса, а сейчас каждый под тратит 300m. Сколько реплик попросит HPA, если `maxReplicas: 10`?',
      'A Deployment has two replicas, each requests 200m CPU, the HPA target is 50 percent of the request, and each pod now uses 300m. How many replicas does the HPA ask for with `maxReplicas: 10`?',
    ),
    options: [
      { id: '6', text: bi('6', '6'), correct: true },
      { id: '3', text: bi('3', '3'), why: bi('Три реплики получились бы при цели 100 процентов. Загрузка каждого пода 300 из 200, то есть 150 процентов, втрое выше цели в 50 процентов, поэтому реплик нужно втрое больше: 2 × 3 = 6.', 'Three replicas would come out with a 100 percent target. Each pod is at 300 of 200, that is 150 percent, three times the 50 percent target, so three times as many replicas are needed: 2 × 3 = 6.') },
      { id: '10', text: bi('10, то есть сразу максимум', '10, the maximum at once'), why: bi('HPA не прыгает к максимуму, а считает нужное число: желаемое равно текущему, умноженному на отношение загрузки к цели, с округлением вверх.', 'The HPA does not jump to the maximum; it computes the number needed: desired equals current times the ratio of usage to target, rounded up.') },
    ],
    explain: bi('Формула из документации: желаемое = ⌈текущее × загрузка ÷ цель⌉ = ⌈2 × 150 ÷ 50⌉ = 6. Пока отношение отличается от единицы меньше чем на 10 процентов, HPA ничего не меняет.', 'The formula from the documentation: desired = ⌈current × usage ÷ target⌉ = ⌈2 × 150 ÷ 50⌉ = 6. While the ratio is within 10 percent of one, the HPA changes nothing.'),
  },
  {
    id: 'k8s.q.scale.nodes',
    kind: 'mcq',
    concepts: ['k8s.hpa', 'k8s.scheduler'],
    prompt: bi(
      'Под нагрузкой HPA увеличил число реплик с 4 до 12, и восемь новых подов висят в Pending с событием «0/3 nodes are available: 3 Insufficient cpu». Что сделает HPA дальше?',
      'Under load the HPA raised the replicas from 4 to 12, and eight new pods hang in Pending with "0/3 nodes are available: 3 Insufficient cpu". What will the HPA do next?',
    ),
    options: [
      { id: 'nothing', text: bi('Ничего: HPA меняет только число подов, а новые узлы добавляет отдельная программа, например Cluster Autoscaler в облаке', 'Nothing: the HPA changes only the pod count, and new nodes are added by a separate program, such as the Cluster Autoscaler in a cloud'), correct: true },
      { id: 'node', text: bi('Закажет у облака ещё один узел', 'Order one more node from the cloud'), why: bi('Об узлах HPA ничего не знает. Узлы заказывают Cluster Autoscaler или Karpenter, которые замечают поды в Pending из-за нехватки места, а в собственном дата-центре узлы добавляет человек.', 'The HPA knows nothing about nodes. Nodes are ordered by the Cluster Autoscaler or Karpenter, which notice pods Pending for lack of room; in your own data centre a person adds nodes.') },
      { id: 'back', text: bi('Вернёт число реплик к четырём, раз новые поды не запустились, и попробует увеличить его снова через пять минут после стабилизации', 'Return the replicas to four, since the new pods did not start, and try to raise the number again after the five-minute stabilisation window'), why: bi('HPA смотрит на загрузку работающих подов, а не на то, запустились ли новые. Пока загрузка выше цели, он держит 12 реплик.', 'The HPA looks at the load of the running pods, not at whether new ones started. While the load is above the target, it keeps 12 replicas.') },
    ],
  },
];

export const scalingLesson: Lesson = {
  id: 'k8s-1.scaling',
  block: 'k8s-1',
  title: bi('Как кластер сам добавляет поды под нагрузкой', 'How the cluster adds pods under load by itself'),
  summary: bi(
    'Откуда кластер узнаёт, сколько процессора тратят поды, как HorizontalPodAutoscaler по этим цифрам меняет число реплик, почему без requests он ничего не может посчитать и чего он не делает: не предсказывает нагрузку и не добавляет узлы.',
    'Where the cluster learns how much CPU the pods use, how the HorizontalPodAutoscaler changes the replica count from these numbers, why it can compute nothing without requests, and what it does not do: it does not predict load and does not add nodes.',
  ),
  introduces: ['k8s.metrics-server', 'k8s.hpa'],
  uses: ['k8s.resources', 'k8s.deployment', 'k8s.controller', 'k8s.addon', 'k8s.kubelet', 'k8s.scheduler', 'k8s.events'],
  tier: 'core',
  minutes: 30,
  sources: src([S.hpa, S.metricsPipeline, S.resources], [R.what, R.components]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В пятницу вечером магазин запускает распродажу, и за десять минут посетителей становится вчетверо больше. Трёх подов сайта не хватает, страницы открываются по десять секунд, а дежурный инженер спит. Выручает объект HorizontalPodAutoscaler: он сам добавит поды, когда нагрузка выросла, и уберёт их, когда она спала. На собеседовании о нём спрашивают в двух формах: что делать, если HPA показывает «<unknown>», и кто добавляет серверы, когда поды перестают помещаться. Этот урок отвечает на оба вопроса.',
        'On Friday evening a shop starts a sale, and within ten minutes there are four times as many visitors. Three site pods are not enough, pages take ten seconds to open, and the engineer on call is asleep. A HorizontalPodAutoscaler object comes to the rescue: it adds pods when the load grows and removes them when it falls. Interviews ask about it in two forms: what to do when the HPA shows “<unknown>”, and who adds servers when the pods no longer fit. This lesson answers both.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('От счётчика процессора до нового пода', 'From a CPU counter to a new pod'),
      body: bi(
        'Всё начинается с kubelet. Он и так следит за контейнерами своего узла и знает, сколько процессора и памяти каждый из них потребляет. Эти цифры собирает [[k8s.metrics-server|metrics-server]], ещё одно дополнение кластера: раз в 15 секунд он опрашивает kubelet каждого узла и отдаёт свежие значения через Metrics API, отдельную часть API кластера. Отсюда берёт цифры команда `kubectl top pods`. metrics-server хранит только последнее значение, а графики и историю ведёт система мониторинга, которой посвящён отдельный блок курса.\n\nДальше работает [[k8s.hpa|HorizontalPodAutoscaler]], объект, в котором записано, каким Deployment управлять, в каких пределах и к какой цели стремиться, например «держать загрузку процессора на 50 процентах от запроса». Обслуживает его контроллер HPA в kube-controller-manager, такая же петля согласования, как контроллер ReplicaSet. Раз в 15 секунд он читает Metrics API, делит потребление подов на их `resources.requests` и сравнивает с целью. Желаемое число реплик он считает по формуле: текущее число, умноженное на отношение загрузки к цели, с округлением вверх. Две реплики, загруженные на 150 процентов при цели 50, превращаются в шесть. Результат HPA ограничивает полями `minReplicas` и `maxReplicas` и записывает в `spec.replicas` Deployment. Дальше срабатывает знакомая цепочка петель: Deployment меняет ReplicaSet, тот создаёт поды, планировщик ищет им узлы, kubelet запускает контейнеры.\n\nУбирать поды HPA не торопится. Прежде чем уменьшить число реплик, он пять минут смотрит, не вернётся ли нагрузка, чтобы поды не прыгали туда и обратно при каждом колебании.',
        'It all starts with the kubelet. It already watches the containers of its node and knows how much CPU and memory each one uses. These numbers are collected by [[k8s.metrics-server|metrics-server]], one more cluster add-on: every 15 seconds it asks the kubelet of every node and serves fresh values through the Metrics API, a separate part of the cluster API. `kubectl top pods` takes its numbers from there. metrics-server keeps only the latest value, with no graphs and no history; that is the job of the monitoring system from a separate block of the course.\n\nThen the [[k8s.hpa|HorizontalPodAutoscaler]] works: an object that says which Deployment to manage, within which bounds and towards which target, for example “keep CPU usage at 50 percent of the request”. It is served by the HPA controller in kube-controller-manager, a reconcile loop like the ReplicaSet controller. Every 15 seconds it reads the Metrics API, divides the pods’ usage by their `resources.requests` and compares with the target. It computes the desired replica count by a formula: the current count times the ratio of usage to target, rounded up. Two replicas loaded at 150 percent with a target of 50 become six. The HPA bounds the result by `minReplicas` and `maxReplicas` and writes it into the Deployment’s `spec.replicas`. Then the familiar chain of loops fires: the Deployment changes the ReplicaSet, the ReplicaSet creates pods, the scheduler finds them nodes, the kubelet starts the containers.\n\nThe HPA is in no hurry to remove pods. Before it lowers the replica count, it watches for five minutes whether the load comes back, so that pods do not jump back and forth with every swing.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Конструктор кластера со слоем метрик', 'The cluster constructor with the metrics layer'),
      body: bi(
        'Конструктор кластера снова вырос: к входу снаружи и хранилищу добавился слой «Метрики и автомасштаб» с блоком metrics-server. Сценарий «Автомасштабирование под нагрузкой» создаёт Deployment на одну реплику с запросом 100m процессора и HPA с целью 50 процентов, а потом изображает пользователей, чьи запросы требуют от подов вместе 250m процессора, то есть четверть ядра. Над выводом тренажёр объясняет, кто какое число записал или из-за отсутствия какого компонента число реплик не изменилось.',
        'The cluster constructor has grown again: next to traffic in and storage there is the layer “Metrics and autoscaling” with the metrics-server block. The scenario “Autoscaling under load” creates a one-replica Deployment requesting 100m CPU and an HPA with a 50 percent target, then plays users whose requests cost the pods 250m together, a quarter of a core. Above the output the trainer explains who wrote which number, or which missing component left the replica count unchanged.',
      ),
    },
    {
      id: 'howto',
      kind: 'text',
      role: 'howto',
      step: 'try',
      body: bi(
        'Запустите сценарий «Автомасштабирование под нагрузкой», пока на холсте собрано всё, и посмотрите на столбцы TARGETS и REPLICAS в выводе `kubectl get hpa web`. Затем выключите слой «Метрики и автомасштаб», нажав на его название в легенде, и запустите сценарий ещё раз: `kubectl top` ответит, что Metrics API недоступен, а число реплик останется прежним. Включите слой обратно и уберите с холста kube-controller-manager: цифры будут, но сравнивать их с целью будет некому.',
        'Run the scenario “Autoscaling under load” while everything is on the canvas, and look at the TARGETS and REPLICAS columns in the output of `kubectl get hpa web`. Then switch off the layer “Metrics and autoscaling” by pressing its name in the legend and run the scenario again: `kubectl top` says the Metrics API is not available, and the replica count stays the same. Switch the layer back on and remove kube-controller-manager from the canvas: the numbers are there, but nobody compares them with the target.',
      ),
    },
    { id: 'constructor', kind: 'widget', step: 'try', widget: 'k8s.constructor', props: { preset: 'full', layers: ['cp', 'node', 'net', 'ingress', 'storage', 'metrics'] } },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: SCALING_LAB,
      intro: bi(
        'В кластере стоит metrics-server и работает Deployment `web` на одну реплику. В файле `hpa.yaml` описан HPA для него: от одной до шести реплик с целью 50 процентов процессора. Команда тренажёра `cluster load web 300m` изображает пользователей: их запросы будут стоить подам `web` вместе 300 миллиядер процессора, а `cluster ff 2m` проматывает время кластера на две минуты вперёд.',
        'The cluster has metrics-server, and Deployment `web` runs with one replica. `hpa.yaml` describes an HPA for it: one to six replicas with a 50 percent CPU target. The trainer command `cluster load web 300m` plays users: their requests will cost the `web` pods 300 millicores of CPU together, and `cluster ff 2m` fast-forwards cluster time by two minutes.',
      ),
      tasks: [
        {
          id: 'top',
          prompt: bi('Посмотрите, сколько процессора и памяти сейчас тратят поды.', 'Look at how much CPU and memory the pods use right now.'),
          check: { stdout: /CPU\(cores\)\s+MEMORY\(bytes\)/ },
          chips: 'kubectl top pods',
          concepts: ['k8s.metrics-server'],
          hints: { H1: bi('Текущее потребление показывает команда `kubectl top`, и ей нужно сказать, о чём спрашивать: о подах или об узлах.', '`kubectl top` shows the current usage; tell it what to ask about, pods or nodes.') },
        },
        {
          id: 'unknown',
          prompt: bi('Создайте HPA из файла `hpa.yaml` и добейтесь, чтобы в столбце TARGETS вместо «<unknown>» появились проценты.', 'Create the HPA from `hpa.yaml` and get percentages instead of “<unknown>” in the TARGETS column.'),
          check: {
            when: (f) => !!hpaOf(f) && hasCpuRequest(f) && measuring(f),
            fail: [{ if: (f) => !!hpaOf(f) && !hasCpuRequest(f), say: bi('HPA создан, но у контейнера `web` нет запроса процессора, а проценты считаются от него. В событиях HPA об этом написано «missing request for cpu».', 'The HPA exists, but container `web` has no CPU request, and the percentage is counted from it. The HPA events say “missing request for cpu”.') }],
          },
          chips: 'kubectl apply -f hpa.yaml && kubectl describe hpa web',
          concepts: ['k8s.hpa', 'k8s.resources'],
          hints: {
            H1: bi('Причину HPA пишет в свои события и условия: выполните `kubectl describe hpa web` и прочитайте строку с ScalingActive.', 'The HPA writes the cause into its events and conditions: run `kubectl describe hpa web` and read the ScalingActive line.'),
            H2: bi('Добавьте контейнеру запрос процессора: `kubectl patch deployment web -p \'{"spec":{"template":{"spec":{"containers":[{"name":"web","resources":{"requests":{"cpu":"100m"}}}]}}}}\'`, затем промотайте время командой `cluster ff 1m` и снова выполните `kubectl get hpa`.', 'Give the container a CPU request: `kubectl patch deployment web -p \'{"spec":{"template":{"spec":{"containers":[{"name":"web","resources":{"requests":{"cpu":"100m"}}}]}}}}\'`, then fast-forward with `cluster ff 1m` and run `kubectl get hpa` again.'),
          },
        },
        {
          id: 'load',
          prompt: bi('Дайте подам нагрузку командой `cluster load web 300m`, промотайте время и дождитесь, пока HPA увеличит число реплик хотя бы до четырёх.', 'Load the pods with `cluster load web 300m`, fast-forward and wait until the HPA raises the replicas to at least four.'),
          check: { when: (f) => measuring(f) && (k8s(f).deployments.find((d) => d.ns === 'default' && d.name === 'web')?.ready ?? 0) >= 4 },
          chips: 'cluster load web 300m && cluster ff 2m && kubectl get hpa,deploy',
          concepts: ['k8s.hpa'],
          hints: { H1: bi('При запросе 100m на под и нагрузке 300m цель в 50 процентов требует шести подов, но больше `maxReplicas` HPA реплик не создаст. Если реплик не прибавилось, проверьте, что предыдущее задание выполнено и в TARGETS стоят проценты.', 'With 100m requested per pod and a 300m load, the 50 percent target needs six pods, and the HPA will not go beyond `maxReplicas`. If no replicas were added, check that the previous task is done and TARGETS shows percentages.') },
        },
      ],
    },
    {
      id: 'myths',
      kind: 'text',
      step: 'explain',
      title: bi('Чего HPA не делает', 'What the HPA does not do'),
      body: bi(
        'Kubernetes не угадывает нагрузку. Пока в кластере нет объекта HPA и metrics-server, число подов остаётся таким, как записано в Deployment, сколько бы посетителей ни пришло. HPA и сам ничего не предсказывает: он отвечает на нагрузку, которая уже наступила, с задержкой в полминуты на сбор цифр и ещё на время запуска нового пода. Поэтому для резких пиков, таких как начало распродажи, `minReplicas` ставят с запасом заранее.\n\nHPA не добавляет серверы. Он меняет только число подов, и если новые поды не помещаются на узлы, они висят в Pending с «Insufficient cpu». Узлы в облаке заказывает отдельная программа, Cluster Autoscaler или Karpenter, а в собственном дата-центре узлы добавляет человек.\n\nHPA не работает без requests. Загрузка в процентах считается от запроса процессора, и если запроса нет, контроллер пишет в события «missing request for cpu», а в столбце TARGETS остаётся «<unknown>».',
        'Kubernetes does not guess the load. While the cluster has no HPA object and no metrics-server, the pod count stays as the Deployment says, however many visitors come. The HPA itself predicts nothing either: it answers load that has already arrived, with a delay of half a minute for collecting numbers plus the start time of a new pod. That is why for sharp peaks, like the start of a sale, `minReplicas` is set with a margin in advance.\n\nThe HPA does not add servers. It changes only the pod count, and if new pods do not fit on the nodes, they hang in Pending with “Insufficient cpu”. In a cloud nodes are ordered by a separate program, the Cluster Autoscaler or Karpenter, and in your own data centre a person adds them.\n\nThe HPA does not work without requests. Usage in percent is counted from the CPU request, and with no request the controller writes “missing request for cpu” into the events, and the TARGETS column stays “<unknown>”.',
      ),
    },
    {
      id: 'more',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Что ещё масштабирует кластер и как это сочетается с Git', 'What else scales a cluster, and how it fits with Git'),
      body: bi(
        'Кроме процессора и памяти HPA умеет брать свои метрики, например число запросов в секунду или длину очереди, если их отдаёт адаптер вроде Prometheus Adapter. Для очередей и событий удобнее KEDA: она умеет опускать число реплик до нуля, когда работы нет, и сама создаёт HPA для того, что масштабирует. VerticalPodAutoscaler меняет не число подов, а их requests, и вместе с HPA по одной и той же метрике процессора их не используют, потому что они будут мешать друг другу.\n\nЕсли кластер выкладывают из Git, не записывайте `replicas` в манифест Deployment, которым управляет HPA. Иначе каждая сверка будет возвращать число из Git, а HPA снова его менять, и поды будут то появляться, то исчезать. Поведение при уменьшении и увеличении настраивают в поле `spec.behavior`: окно стабилизации, по умолчанию 300 секунд для уменьшения, и наибольший шаг изменения за период.',
        'Besides CPU and memory the HPA can take custom metrics, such as requests per second or queue length, if an adapter such as Prometheus Adapter serves them. For queues and events KEDA is handier: it can bring replicas down to zero when there is no work and creates an HPA for what it scales itself. The VerticalPodAutoscaler changes not the pod count but their requests, and it is not combined with an HPA on the same CPU metric, because the two would fight each other.\n\nIf the cluster is deployed from Git, do not write `replicas` into the manifest of a Deployment the HPA manages. Otherwise every reconciliation brings back the number from Git, the HPA changes it again, and pods keep appearing and disappearing. Scale-down and scale-up behaviour is tuned in `spec.behavior`: the stabilization window, 300 seconds for scale-down by default, and the largest step per period.',
      ),
    },
    { id: 'real-cluster', kind: 'widget', step: 'practice', widget: 'k8s.real-cluster' },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: scalingQuiz.map((q) => q.id) },
  ],
};
