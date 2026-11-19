// Stage 2 (05 §11.4): a kubeadm upgrade one minor version at a time — the
// control plane first, then each worker drained, upgraded and returned. The
// version skew policy decides what may run next to what; the knobs let the
// learner try a skipped minor, the wrong order and a node without drain.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

type P = { target: number; order: string; drain: boolean };

/** The version skew rules of v1.37 for the pieces this explainer shows. */
export function skewProblems(api: number, kubelet: number, kubeadmFrom: number, kubeadmTo: number): string[] {
  const out: string[] = [];
  if (kubeadmTo - kubeadmFrom > 1) out.push('kubeadm can upgrade only 1 minor version at a time');
  if (kubelet > api) out.push('the kubelet must not be newer than kube-apiserver');
  if (api - kubelet > 3) out.push('the kubelet may be at most 3 minor versions older than kube-apiserver');
  return out;
}

export const upgradeModel = defineModel<P>({
  id: 'k8s.upgrade',
  block: 'k8s-2',
  title: bi('Обновление кластера: по одной минорной версии, сверху вниз', 'Upgrading a cluster: one minor version at a time, top down'),
  summary: bi('Сначала control plane, затем узлы по одному: вывести из работы, обновить kubeadm и kubelet, вернуть. Правило расхождения версий запрещает kubelet быть новее API-сервера.', 'The control plane first, then the nodes one by one: take out of service, upgrade kubeadm and the kubelet, bring back. The version skew policy forbids a kubelet newer than the API server.'),
  concepts: ['k8s.version-skew', 'k8s.drain'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('you', 'kubeadm upgrade', 'user', 'pill', 24, 24, 200, 44, bi('kubeadm upgrade plan показывает доступные версии, apply обновляет control plane, node — конфигурацию kubelet на узле.', 'kubeadm upgrade plan shows the available versions, apply upgrades the control plane, node upgrades the kubelet configuration on a node.'), bi('вы', 'you'), 'kubeadm upgrade plan', D.upgrade),
      node('cp', 'cp-1', 'cp', 'rack', 24, 120, 260, 90, bi('Узел control plane: API-сервер, controller-manager, scheduler и etcd — статические поды; kubeadm apply меняет образы в их манифестах и продлевает сертификаты.', 'The control-plane node: the API server, the controller-manager, the scheduler and etcd as static pods; kubeadm apply changes the images in their manifests and renews the certificates.'), bi('kubeadm', 'kubeadm'), 'kubectl -n kube-system get pods -l tier=control-plane -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image'),
      node('w1', 'worker-1', 'node', 'rack', 380, 120, 220, 90, bi('Рабочий узел: kubelet и kube-proxy. kubelet обновляется пакетом, после drain.', 'A worker node: the kubelet and kube-proxy. The kubelet is upgraded as a package, after a drain.'), bi('пакеты kubeadm и kubelet', 'the kubeadm and kubelet packages'), 'kubectl get node worker-1 -o wide'),
      node('w2', 'worker-2', 'node', 'rack', 700, 120, 220, 90, bi('Второй рабочий узел: его очередь — только после того, как первый вернулся.', 'The second worker: its turn comes only after the first is back.'), bi('пакеты kubeadm и kubelet', 'the kubeadm and kubelet packages'), 'kubectl get node worker-2 -o wide'),
      node('web', bi('Deployment web, 3 пода', 'Deployment web, 3 pods'), 'process', 'buffer', 380, 300, 260, 64, bi('Приложение, которое должно пережить обновление. drain выселяет его поды с узла через Eviction API, соблюдая PodDisruptionBudget.', 'The application that must survive the upgrade. drain evicts its pods from the node through the Eviction API, honouring the PodDisruptionBudget.'), bi('команда приложения', 'the application team'), 'kubectl get pods -o wide -l app=web', D.drain, 'ready 3/3'),
      node('skew', bi('правило версий', 'skew policy'), 'obj', 'doc', 24, 300, 260, 76, bi('API-сервер — самый новый. controller-manager и scheduler не новее его; kubelet не новее и не старше на 3 минорные версии; kubeadm обновляет на одну минорную за раз.', 'The API server is the newest. The controller-manager and the scheduler are not newer than it; the kubelet is not newer and at most 3 minor versions older; kubeadm upgrades one minor version at a time.'), bi('проект Kubernetes', 'the Kubernetes project'), undefined, D.skew),
    ],
    edges: [
      edge('e-apply', 'you', 'cp', 'upgrade apply', bi('Обновляет control plane: новые образы статических подов, новые сертификаты, новые дополнения.', 'Upgrades the control plane: new static pod images, new certificates, new addons.'), bi('kubeadm', 'kubeadm')),
      edge('e-w1', 'cp', 'w1', bi('drain → node → uncordon', 'drain → node → uncordon'), bi('Узел выводят, обновляют, возвращают.', 'The node is taken out, upgraded, brought back.'), bi('вы, kubectl и kubeadm', 'you, kubectl and kubeadm')),
      edge('e-w2', 'w1', 'w2', bi('следующий', 'next'), bi('Узлы — строго по одному, чтобы приложению всегда было где жить.', 'Nodes strictly one by one, so the application always has somewhere to live.'), bi('вы', 'you')),
      edge('e-evict', 'w1', 'web', 'Eviction', bi('drain выселяет поды; ReplicaSet создаёт им замену на других узлах.', 'drain evicts the pods; the ReplicaSet creates replacements on other nodes.'), bi('kubectl drain', 'kubectl drain')),
      edge('e-rule', 'skew', 'cp', bi('проверка', 'check'), bi('kubeadm upgrade plan и apply сверяют версии с правилом до начала работы.', 'kubeadm upgrade plan and apply check the versions against the policy before they start.'), bi('kubeadm', 'kubeadm')),
    ],
  },
  params: [
    {
      id: 'target',
      label: bi('Целевая версия', 'Target version'),
      kind: 'choice',
      default: 37,
      options: [
        { id: '37', label: bi('v1.37', 'v1.37') },
        { id: '38', label: bi('v1.38', 'v1.38') },
      ],
      near: 'you',
      predict: { prompt: bi('Кластер на 1.36. Можно сразу на 1.38?', 'The cluster is on 1.36. Can it go straight to 1.38?'), options: [{ id: 'no', text: bi('Нет: только через 1.37', 'No: only through 1.37') }, { id: 'yes', text: bi('Да, если узлы сразу обновить', 'Yes, if the nodes are upgraded right away') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'no' : 'yes') },
    },
    {
      id: 'order',
      label: bi('Порядок', 'Order'),
      kind: 'choice',
      default: 'cp',
      near: 'cp',
      options: [
        { id: 'cp', label: bi('сначала control plane', 'the control plane first') },
        { id: 'workers', label: bi('сначала узлы', 'the nodes first') },
      ],
      predict: { prompt: bi('Если сначала обновить kubelet на узлах, что нарушится?', 'If the kubelets are upgraded first, what is violated?'), options: [{ id: 'skew', text: bi('kubelet окажется новее API-сервера', 'The kubelet ends up newer than the API server') }, { id: 'nothing', text: bi('Ничего: порядок не важен', 'Nothing: the order does not matter') }], resolve: (_p, n) => (n.some((s) => s.states?.w1 === 'err') ? 'skew' : 'nothing') },
    },
    {
      id: 'drain',
      label: bi('Выводить узел (drain) перед обновлением', 'Drain the node before upgrading'),
      kind: 'toggle',
      default: true,
      near: 'w1',
      predict: { prompt: bi('Узел обновляют без drain, а пакет ядра требует перезагрузки. Сколько подов web останется готовыми?', 'The node is upgraded without a drain, and a kernel package needs a reboot. How many web pods stay ready?'), options: [{ id: 'less', text: bi('Меньше: поды узла пропадут разом', 'Fewer: the node’s pods vanish at once') }, { id: 'same', text: bi('Столько же', 'The same') }], resolve: (_p, n) => (metric(n, 'minReady') < 2 ? 'less' : 'same') },
    },
  ],
  breaks: [
    {
      id: 'held',
      label: bi('Забыть apt-mark unhold', 'Forget apt-mark unhold'),
      remove: ['e-apply'],
      boundary: 'process',
      predict: { prompt: bi('Пакеты закреплены apt-mark hold. Что ответит apt-get install kubeadm=…?', 'The packages are pinned with apt-mark hold. What does apt-get install kubeadm=… answer?'), options: [{ id: 'held', text: bi('Откажется менять закреплённый пакет', 'It refuses to change a held package') }, { id: 'ok', text: bi('Обновит', 'It upgrades') }], resolve: () => 'held' },
    },
    {
      id: 'pdb',
      label: bi('PodDisruptionBudget minAvailable: 3', 'PodDisruptionBudget minAvailable: 3'),
      remove: ['e-evict'],
      boundary: 'process',
      predict: { prompt: bi('Бюджет требует 3 готовых пода из 3. Что сделает drain?', 'The budget demands 3 ready pods out of 3. What does drain do?'), options: [{ id: 'wait', text: bi('Будет ждать и повторять: выселять нельзя', 'It waits and retries: eviction is not allowed') }, { id: 'force', text: bi('Выселит всё равно', 'It evicts anyway') }], resolve: () => 'wait' },
    },
  ],
  metrics: [
    { id: 'minReady', label: bi('минимум готовых подов web', 'minimum ready web pods') },
    { id: 'apiMinor', label: bi('минорная версия API-сервера', 'API server minor version') },
  ],
  run(p, broken): Step[] {
    const target = Number(p.target);
    const s: Step[] = [];
    const v = (n: number) => `v1.${n}`;
    s.push({ id: 'plan', label: 'plan', caption: bi('Все компоненты на v1.36. Пакеты kubeadm, kubelet и kubectl закреплены (apt-mark hold), чтобы apt upgrade не обновил их случайно.', 'Every component is on v1.36. The kubeadm, kubelet and kubectl packages are held (apt-mark hold) so apt upgrade does not upgrade them by accident.'), focus: ['you', 'skew', 'e-rule'], values: { cp: 'v1.36', w1: 'kubelet v1.36', w2: 'kubelet v1.36' }, metrics: { minReady: 3, apiMinor: 36 } });
    if (broken.has('held')) {
      s.push({ id: 'held', label: 'apt', caption: bi('apt не меняет закреплённые пакеты. Сначала apt-mark unhold kubeadm, установка нужной версии, снова hold.', 'apt does not change held packages. First apt-mark unhold kubeadm, install the needed version, hold again.'), focus: ['you'], states: { you: 'err' }, metrics: { minReady: 3, apiMinor: 36 }, broken: { at: 'you', message: '$ sudo apt-get install -y kubeadm=1.37.1-1.1\nE: Held packages were changed and -y was used without --allow-change-held-packages.', caption: bi('закрепление защищает от случайного обновления — и мешает намеренному, пока его не сняли.', 'holding protects against an accidental upgrade — and blocks an intended one until it is lifted.') } });
      return s;
    }
    if (target - 36 > 1) {
      s.push({ id: 'skip', label: bi('скачок', 'skip'), caption: bi('kubeadm отказывается перепрыгивать минорную версию: миграции API и конфигурации рассчитаны на шаг в одну версию.', 'kubeadm refuses to skip a minor version: the API and configuration migrations are written for one-version steps.'), focus: ['you', 'skew'], states: { you: 'err' }, metrics: { minReady: 3, apiMinor: 36 }, broken: { at: 'you', message: `[upgrade/version] FATAL: the --version argument is invalid due to these fatal errors:\n\n\t- Specified version to upgrade to "${v(target)}.0" is too high; kubeadm can upgrade only 1 minor version at a time`, caption: bi('путь 1.36 → 1.38 идёт через 1.37, с проверкой кластера после каждого шага.', 'the way 1.36 → 1.38 goes through 1.37, with a cluster check after every step.') } });
      return s;
    }
    if (p.order === 'workers') {
      const problems = skewProblems(36, target, 36, target);
      s.push({ id: 'wfirst', label: bi('узлы раньше', 'nodes first'), caption: bi('kubelet на worker-1 уже v1.37, а API-сервер ещё v1.36: kubelet новее API-сервера. Такое сочетание не поддерживается — kubelet может пользоваться API, которого сервер ещё не знает.', 'The kubelet on worker-1 is already v1.37, but the API server is still v1.36: the kubelet is newer than the API server. That combination is unsupported — the kubelet may use API the server does not know yet.'), focus: ['w1', 'skew'], states: { w1: 'err' }, values: { w1: `kubelet ${v(target)}` }, metrics: { minReady: 3, apiMinor: 36 } });
      s.push({ id: 'fix', label: bi('назад', 'back'), caption: fmt(bi('Нарушено: {p}. Правильный порядок — control plane первым: тогда во время обновления kubelet всегда старше или равен API-серверу.', 'Violated: {p}. The right order is the control plane first: then during the upgrade the kubelet is always older than or equal to the API server.'), { p: problems.join('; ') }), focus: ['cp', 'skew'], metrics: { minReady: 3, apiMinor: 36 } });
      return s;
    }
    s.push({ id: 'apply', label: 'apply', caption: fmt(bi('На cp-1: новый kubeadm, kubeadm upgrade apply {v}. Он меняет образы в манифестах статических подов по одному — kubelet перезапускает компоненты — и продлевает сертификаты.', 'On cp-1: the new kubeadm, kubeadm upgrade apply {v}. It changes the images in the static pod manifests one by one — the kubelet restarts the components — and renews the certificates.'), { v: `${v(target)}.1` }), focus: ['e-apply', 'cp'], tokens: [{ edge: 'e-apply', label: v(target) }], states: { cp: 'ok' }, values: { cp: v(target) }, metrics: { minReady: 3, apiMinor: target } });
    if (broken.has('pdb')) {
      s.push({ id: 'blocked', label: 'drain', caption: bi('Бюджет требует, чтобы готовы были все три пода, — выселить нельзя ни одного. drain будет повторять попытку бесконечно.', 'The budget demands all three pods ready — not one may be evicted. drain will retry forever.'), focus: ['w1', 'web'], states: { w1: 'warn' }, metrics: { minReady: 3, apiMinor: target }, broken: { at: 'web', message: 'evicting pod default/web-5d78c-q4x2m\nerror when evicting pods/"web-5d78c-q4x2m" -n "default" (will retry after 5s): Cannot evict pod as it would violate the pod\'s disruption budget.', caption: bi('бюджет minAvailable, равный числу реплик, запрещает любое плановое обслуживание; разумно — на один меньше.', 'a minAvailable budget equal to the replica count forbids any planned maintenance; one less is sensible.') } });
      return s;
    }
    const minReady = p.drain ? 2 : 1;
    s.push({
      id: 'w1',
      label: 'worker-1',
      caption: p.drain
        ? bi('kubectl drain worker-1 --ignore-daemonsets: узел помечен unschedulable, его поды выселены и запущены на других узлах. Затем kubeadm upgrade node, новый kubelet, рестарт службы и uncordon.', 'kubectl drain worker-1 --ignore-daemonsets: the node is marked unschedulable, its pods are evicted and started on other nodes. Then kubeadm upgrade node, the new kubelet, a service restart and uncordon.')
        : bi('Без drain: перезапуск kubelet контейнеры не останавливает, но обновлённое ядро требует перезагрузки — и поды узла пропадают разом, без замены заранее.', 'Without a drain: a kubelet restart does not stop the containers, but the upgraded kernel needs a reboot — and the node’s pods vanish all at once, with no replacement ready.'),
      focus: ['e-w1', 'w1', 'e-evict', 'web'],
      tokens: p.drain ? [{ edge: 'e-evict', label: 'evict' }] : [],
      states: { w1: 'ok', web: p.drain ? 'ok' : 'warn' },
      values: { w1: `kubelet ${v(target)}`, web: `ready ${minReady}/3 → 3/3` },
      fill: { web: minReady / 3 },
      metrics: { minReady, apiMinor: target },
    });
    s.push({ id: 'w2', label: 'worker-2', caption: bi('Только когда worker-1 вернулся и поды снова готовы, очередь worker-2 — тем же порядком.', 'Only when worker-1 is back and the pods are ready again is it worker-2’s turn — in the same order.'), focus: ['e-w2', 'w2'], tokens: [{ edge: 'e-w2' }], states: { w2: 'ok' }, values: { w2: `kubelet ${v(target)}`, web: 'ready 3/3' }, fill: { web: 1 }, metrics: { minReady, apiMinor: target } });
    s.push({ id: 'done', label: bi('готово', 'done'), caption: fmt(bi('Все компоненты на {v}. kubectl get nodes показывает новую версию у каждого узла — это и есть проверка.', 'Every component is on {v}. kubectl get nodes shows the new version on every node — that is the check.'), { v: v(target) }), focus: ['cp', 'w1', 'w2'], metrics: { minReady, apiMinor: target } });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Посмотрите, где обновление встаёт и каким сообщением.', 'See where the upgrade stops and with what message.') : bi('Препятствие убрано.', 'The obstacle is gone.');
    if (change.id === 'drain') return fmt(bi('Минимум готовых подов за обновление: {n} из 3.', 'Minimum ready pods during the upgrade: {n} of 3.'), { n: metric(next, 'minReady') });
    if (change.id === 'order') return b.order === 'workers' ? bi('kubelet новее API-сервера — нарушение правила версий.', 'A kubelet newer than the API server breaks the skew policy.') : bi('Сверху вниз: правило версий соблюдено на каждом шаге.', 'Top down: the skew policy holds at every step.');
    return Number(b.target) > 37 ? bi('Через версию kubeadm не прыгает.', 'kubeadm does not jump over a version.') : bi('Одна минорная версия — обычный шаг.', 'One minor version is an ordinary step.');
  },
});
