// Stage 2 (05 §11.4): a kubeadm upgrade one minor version at a time — the
// control plane first, then each worker drained, upgraded and returned. The
// version skew policy decides what may run next to what; the knobs let the
// learner try a skipped minor, the wrong order and a node without drain.
//
// Reading order: at first only you, the control-plane node and the two
// workers are on screen; the skew policy and the application appear when
// they matter, and every step upgrades one machine.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { target: number; order: string; drain: boolean };

/** The version skew rules of v1.37 for the pieces this explainer shows. */
export function skewProblems(api: number, kubelet: number, kubeadmFrom: number, kubeadmTo: number): string[] {
  const out: string[] = [];
  if (kubeadmTo - kubeadmFrom > 1) out.push('kubeadm can upgrade only 1 minor version at a time');
  if (kubelet > api) out.push('the kubelet must not be newer than kube-apiserver');
  if (api - kubelet > 3) out.push('the kubelet may be at most 3 minor versions older than kube-apiserver');
  return out;
}

const PKG = bi('Компоненты ставятся пакетами kubeadm и kubelet.', 'The kubeadm and kubelet packages.');

const diagram = {
  width: 960,
  height: 440,
  nodes: [
    box('you', 'kubeadm upgrade', 'user', 'pill', [24, 24, 210, 48], 'terminal', bi('Команда kubeadm upgrade plan показывает доступные версии, apply обновляет управляющий слой, а node обновляет настройки kubelet на рабочем узле.', 'plan shows versions, apply upgrades the control plane, node upgrades a worker’s kubelet config.'), bi('Команды запускаете вы.', 'You run them.'), { see: 'kubeadm upgrade plan', doc: D.upgrade }),
    box('cp', 'cp-1', 'cp', 'rack', [24, 120, 260, 90], 'server', bi('Управляющий узел. API-сервер, controller-manager, scheduler и etcd работают на нём статическими подами, и kubeadm upgrade apply меняет образы в их манифестах и продлевает сертификаты.', 'The control-plane node; apply changes the static pod images and renews certificates.'), bi('Управляющий слой поставил kubeadm.', 'Set up by kubeadm.'), { see: 'kubectl -n kube-system get pods -l tier=control-plane -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image' }),
    box('w1', 'worker-1', 'node', 'rack', [380, 120, 230, 90], 'server', bi('Рабочий узел с kubelet и kube-proxy. kubelet обновляют пакетом после того, как узел выведен из работы командой drain.', 'A worker; the kubelet is upgraded as a package after a drain.'), PKG, { see: 'kubectl get node worker-1 -o wide' }),
    box('w2', 'worker-2', 'node', 'rack', [700, 120, 230, 90], 'server', bi('Второй рабочий узел. Его очередь наступает только после того, как первый вернулся в работу.', 'The second worker, only after the first is back.'), PKG, { see: 'kubectl get node worker-2 -o wide' }),
    box('web', bi('Deployment web, 3 пода', 'Deployment web, 3 pods'), 'process', 'buffer', [380, 300, 260, 64], 'container', bi('Приложение, которое должно пережить обновление. drain выселяет его поды с узла через Eviction API и при этом соблюдает PodDisruptionBudget.', 'The application; drain evicts it via the Eviction API, honouring the PodDisruptionBudget.'), bi('Deployment создала команда приложения.', 'The application team.'), { see: 'kubectl get pods -o wide -l app=web', doc: D.drain, sub: 'ready 3/3' }),
    box('skew', bi('Правило версий', 'Version skew policy'), 'obj', 'doc', [24, 300, 260, 76], 'file', bi('Самым новым должен быть API-сервер. controller-manager и scheduler не новее его, kubelet тоже не новее и отстаёт не больше чем на три минорные версии, а kubeadm обновляет кластер на одну минорную версию за раз.', 'The API server is the newest; the kubelet not newer and at most three behind; kubeadm moves one minor at a time.'), bi('Правило задаёт проект Kubernetes.', 'The Kubernetes project.'), { doc: D.skew }),
  ],
  edges: [
    edge('e-apply', 'you', 'cp', bi('обновить управляющий слой', 'upgrade the control plane'), bi('Новые образы статических подов, новые сертификаты и новые дополнения.', 'New images, certificates and addons.'), bi('Обновляет kubeadm.', 'kubeadm.')),
    edge('e-w1', 'cp', 'w1', bi('вывести, обновить, вернуть', 'drain, upgrade, uncordon'), bi('Узел выводят из работы, обновляют и возвращают.', 'The node is taken out, upgraded, brought back.'), bi('Делаете вы командами kubectl и kubeadm.', 'You, with kubectl and kubeadm.')),
    edge('e-w2', 'w1', 'w2', bi('следующий узел', 'next node'), bi('Узлы обновляют строго по одному, чтобы приложению всегда было где работать.', 'Strictly one at a time.'), bi('Решаете вы.', 'You.')),
    edge('e-evict', 'w1', 'web', bi('выселение подов', 'eviction'), bi('drain выселяет поды с узла, и ReplicaSet создаёт им замену на других узлах.', 'drain evicts; the ReplicaSet replaces elsewhere.'), bi('Выселяет kubectl drain.', 'kubectl drain.')),
    edge('e-rule', 'skew', 'cp', bi('проверка версий', 'version check'), bi('kubeadm upgrade plan и apply сверяют версии с правилом ещё до начала работы.', 'plan and apply check the versions first.'), bi('Сверяет kubeadm.', 'kubeadm.')),
  ],
};

const ALL = idsOf(diagram);

export const upgradeModel = defineModel<P>({
  id: 'k8s.upgrade',
  block: 'k8s-2',
  title: bi('Как обновить кластер на новую версию', 'How to upgrade a cluster'),
  summary: bi(
    'Кластер обновляют на одну минорную версию за раз и сверху вниз: сначала управляющий слой, потом рабочие узлы по одному. Каждый узел выводят из работы, обновляют на нём kubeadm и kubelet и возвращают. Правило версий запрещает kubelet быть новее API-сервера, а бюджет доступности приложения может не дать вывести узел.',
    'One minor version at a time, top down: the control plane, then the workers one by one, each drained, upgraded and returned.',
  ),
  intro: bi(
    'Сейчас на схеме ваша команда kubeadm upgrade, управляющий узел cp-1 и два рабочих узла, и все они на версии v1.36. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Каждый шаг обновляет одну машину, а под узлами видна версия, которая на них работает. Счётчик под схемой показывает, сколько подов приложения оставалось готовыми в худший момент. Потом попробуйте в «Параметрах» сразу v1.38, обратный порядок и обновление без drain.',
    'For now: your kubeadm upgrade, cp-1 and two workers, all on v1.36. Press “Start from the first step” and go on with “Step forward”: each step upgrades one machine. Then try v1.38 directly, the reverse order and no drain.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:server', 'узел кластера; под ним версия', 'a node and its version'),
    mark('icon:file', 'правило расхождения версий', 'the version skew policy'),
    mark('ok', 'узел обновлён', 'the node is upgraded'),
    mark('warn', 'у приложения меньше готовых подов', 'the application loses pods'),
    mark('err', 'нарушено правило или обновление остановилось', 'a rule is broken or the upgrade stopped'),
  ],
  stopLabel: bi('Обновление остановилось', 'The upgrade stopped'),
  concepts: ['k8s.version-skew', 'k8s.drain'],
  diagram,
  params: [
    {
      id: 'target',
      label: bi('До какой версии обновляете', 'Target version'),
      kind: 'choice',
      default: 37,
      near: 'you',
      group: bi('План обновления', 'The plan'),
      options: [
        { id: '37', label: bi('v1.37, следующая', 'v1.37, the next') },
        { id: '38', label: bi('v1.38, через одну', 'v1.38, skipping one') },
      ],
      predict: { prompt: bi('Кластер на v1.36, и вы выбрали другую целевую версию. Пройдёт ли kubeadm upgrade apply до неё за один раз?', 'The cluster is on 1.36 and you pick another target. Will one apply get there?'), options: [{ id: 'yes', text: bi('Да, обновление пройдёт', 'Yes') }, { id: 'no', text: bi('Нет, потому что kubeadm обновляет кластер только на одну минорную версию за раз', 'No, because kubeadm upgrades by one minor version at a time') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'no' : 'yes') },
    },
    {
      id: 'order',
      label: bi('Что обновляете первым', 'What goes first'),
      kind: 'choice',
      default: 'cp',
      near: 'cp',
      group: bi('План обновления', 'The plan'),
      options: [
        { id: 'cp', label: bi('управляющий слой', 'the control plane') },
        { id: 'workers', label: bi('рабочие узлы', 'the workers') },
      ],
      predict: { prompt: bi('Вы меняете порядок обновления. Нарушится ли при новом порядке правило версий?', 'You change the order. Will the skew policy be broken?'), options: [{ id: 'skew', text: bi('Да, потому что kubelet окажется новее API-сервера', 'Yes, because the kubelet becomes newer than the API server') }, { id: 'nothing', text: bi('Нет, правило по-прежнему соблюдается', 'No, the rule still holds') }], resolve: (_p, n) => (n.some((s) => s.states?.w1 === 'err') ? 'skew' : 'nothing') },
    },
    {
      id: 'drain',
      label: bi('Узел выводят из работы (drain) перед обновлением', 'The node is drained first'),
      kind: 'toggle',
      default: true,
      near: 'w1',
      group: bi('Рабочие узлы', 'Workers'),
      predict: { prompt: bi('Вы меняете, выводят ли узел из работы перед обновлением, а после обновления ядра узел перезагружают. Сколько подов web из трёх будет готово в худший момент?', 'You change the drain; the node reboots after a kernel update. How many of three web pods are ready at worst?'), options: [{ id: 'two', text: bi('Два', 'Two') }, { id: 'one', text: bi('Один', 'One') }], resolve: (_p, n) => (metric(n, 'minReady') >= 2 ? 'two' : 'one') },
    },
  ],
  breaks: [
    {
      id: 'held',
      label: bi('Пакеты остались закреплены, потому что команду apt-mark unhold забыли выполнить', 'The packages are still held because nobody ran apt-mark unhold'),
      remove: ['e-apply'],
      boundary: 'process',
      predict: { prompt: bi('Пакеты kubeadm и kubelet закреплены командой apt-mark hold. Что ответит apt-get install kubeadm=…?', 'The packages are held. What does apt-get install kubeadm=… answer?'), options: [{ id: 'held', text: bi('Откажется менять закреплённый пакет', 'It refuses to change a held package') }, { id: 'ok', text: bi('Обновит пакет', 'It upgrades') }], resolve: () => 'held' },
    },
    {
      id: 'pdb',
      label: bi('Бюджет доступности требует все 3 пода (PodDisruptionBudget minAvailable: 3)', 'A budget demands all 3 pods (minAvailable: 3)'),
      remove: ['e-evict'],
      boundary: 'process',
      predict: { prompt: bi('Бюджет доступности требует, чтобы были готовы все три пода из трёх. Что сделает drain?', 'The budget demands 3 of 3 ready. What does drain do?'), options: [{ id: 'wait', text: bi('drain будет ждать и повторять попытки, потому что выселять поды нельзя', 'It waits and retries, because evicting is not allowed') }, { id: 'force', text: bi('Всё равно выселит поды', 'Evict anyway') }], resolve: () => 'wait' },
    },
  ],
  metrics: [
    { id: 'minReady', label: bi('подов web готово в худший момент', 'web pods ready at worst') },
    { id: 'apiMinor', label: bi('минорная версия API-сервера', 'API server minor') },
  ],
  run(p, broken): Step[] {
    const target = Number(p.target);
    const s: Step[] = [];
    const v = (n: number) => `v1.${n}`;
    s.push({
      id: 'plan',
      label: bi('план', 'plan'),
      caption: bi('Все компоненты кластера на версии v1.36. Пакеты kubeadm, kubelet и kubectl закреплены командой apt-mark hold, чтобы обычный apt upgrade не обновил их случайно.', 'Everything is on v1.36; the packages are held so apt upgrade does not touch them.'),
      focus: ['you'],
      say: { you: bi('kubeadm upgrade plan показывает, что кластер на v1.36 и до какой версии его можно обновить.', 'kubeadm upgrade plan shows v1.36 and the next version.') },
      states: only(ALL, 'you', 'cp', 'w1', 'w2', 'e-apply', 'e-w1', 'e-w2'),
      values: { cp: 'v1.36', w1: 'kubelet v1.36', w2: 'kubelet v1.36' },
      metrics: { minReady: 3, apiMinor: 36 },
    });
    if (broken.has('held')) {
      s.push({
        id: 'held',
        label: 'apt',
        caption: bi('apt не меняет закреплённые пакеты. Сначала нужно снять закрепление командой apt-mark unhold kubeadm, поставить нужную версию и закрепить пакет снова.', 'apt will not change held packages: unhold, install, hold again.'),
        focus: ['you'],
        say: { you: bi('apt отказывается менять закреплённый пакет kubeadm.', 'apt refuses to change the held kubeadm.') },
        states: { you: 'err' },
        metrics: { minReady: 3, apiMinor: 36 },
        broken: { at: 'you', message: '$ sudo apt-get install -y kubeadm=1.37.1-1.1\nE: Held packages were changed and -y was used without --allow-change-held-packages.', caption: bi('ещё до обновления. Закрепление защищает пакет от случайного обновления и точно так же мешает намеренному, пока его не сняли.', 'before the upgrade: holding blocks the intended upgrade too.') },
      });
      return s;
    }
    if (target - 36 > 1) {
      s.push({
        id: 'skip',
        label: bi('скачок', 'skip'),
        caption: bi('kubeadm отказывается перепрыгивать минорную версию, потому что переходы API и настроек рассчитаны на шаг в одну версию.', 'kubeadm refuses to skip a minor: migrations are one step each.'),
        focus: ['you'],
        reveal: ['skew', 'e-rule'],
        say: { you: bi('kubeadm сверяет версии с правилом и отказывается прыгать через v1.37.', 'kubeadm refuses to jump over 1.37.') },
        states: { you: 'err' },
        metrics: { minReady: 3, apiMinor: 36 },
        broken: { at: 'you', message: `[upgrade/version] FATAL: the --version argument is invalid due to these fatal errors:\n\n\t- Specified version to upgrade to "${v(target)}.0" is too high; kubeadm can upgrade only 1 minor version at a time`, caption: bi('на проверке версий. Путь с v1.36 на v1.38 идёт через v1.37, и после каждого шага кластер проверяют.', 'at the version check: 1.36 → 1.38 goes through 1.37.') },
      });
      return s;
    }
    if (p.order === 'workers') {
      const problems = skewProblems(36, target, 36, target);
      s.push({
        id: 'wfirst',
        label: bi('узлы раньше', 'nodes first'),
        caption: bi('kubelet на worker-1 уже v1.37, а API-сервер ещё v1.36, то есть kubelet новее API-сервера. Такое сочетание не поддерживается: kubelet может обращаться к возможностям API, которых сервер ещё не знает.', 'The kubelet is v1.37, the API server v1.36: unsupported.'),
        focus: ['w1'],
        reveal: ['skew', 'e-rule'],
        say: { w1: bi('kubelet на worker-1 стал новее API-сервера.', 'The kubelet is newer than the API server.') },
        states: { w1: 'err' },
        values: { w1: `kubelet ${v(target)}` },
        metrics: { minReady: 3, apiMinor: 36 },
      });
      s.push({
        id: 'fix',
        label: bi('правило', 'rule'),
        caption: fmt(bi('Нарушено правило: {p}. Управляющий слой нужно обновлять первым, потому что тогда на каждом шаге обновления kubelet не новее API-сервера.', 'Violated: {p}. The control plane goes first.'), { p: problems.join('; ') }),
        focus: ['skew'],
        say: { skew: bi('Правило версий: kubelet не может быть новее API-сервера.', 'The kubelet may not be newer than the API server.') },
        metrics: { minReady: 3, apiMinor: 36 },
      });
      return s;
    }
    s.push({
      id: 'apply',
      label: 'apply',
      caption: fmt(bi('На cp-1 вы ставите новый kubeadm и выполняете kubeadm upgrade apply {v}. Он по одному меняет образы в манифестах статических подов, kubelet перезапускает компоненты, а сертификаты продлеваются.', 'On cp-1: kubeadm upgrade apply {v} changes the images one by one and renews certificates.'), { v: `${v(target)}.1` }),
      focus: ['you', 'e-apply'],
      tokens: [{ edge: 'e-apply', label: v(target) }],
      say: { you: fmt(bi('kubeadm upgrade apply обновляет управляющий слой до {v}.', 'apply upgrades the control plane to {v}.'), { v: v(target) }) },
      states: { cp: 'ok' },
      values: { cp: v(target) },
      metrics: { minReady: 3, apiMinor: target },
    });
    if (broken.has('pdb')) {
      s.push({
        id: 'blocked',
        label: 'drain',
        caption: bi('Бюджет доступности требует, чтобы были готовы все три пода, поэтому выселить нельзя ни одного. drain будет повторять попытку бесконечно.', 'The budget demands all three: nothing may be evicted; drain retries forever.'),
        focus: ['web'],
        reveal: ['web', 'e-evict'],
        say: { web: bi('Бюджет требует трёх готовых подов, и выселять их нельзя.', 'The budget forbids any eviction.') },
        states: { w1: 'warn' },
        metrics: { minReady: 3, apiMinor: target },
        broken: { at: 'web', message: 'evicting pod default/web-5d78c-q4x2m\nerror when evicting pods/"web-5d78c-q4x2m" -n "default" (will retry after 5s): Cannot evict pod as it would violate the pod\'s disruption budget.', caption: bi('на выводе узла. Бюджет minAvailable, равный числу реплик, запрещает любое плановое обслуживание, поэтому разумно ставить его на единицу меньше.', 'at the drain: minAvailable equal to the replicas forbids maintenance; one less is sensible.') },
      });
      return s;
    }
    const minReady = p.drain ? 2 : 1;
    s.push({
      id: 'w1',
      label: 'worker-1',
      caption: p.drain
        ? bi('Команда kubectl drain worker-1 --ignore-daemonsets помечает узел как закрытый для новых подов, выселяет его поды, и они запускаются на других узлах. Потом kubeadm upgrade node, новый kubelet, перезапуск службы и kubectl uncordon.', 'drain marks the node unschedulable and evicts its pods; then upgrade node, the new kubelet, a restart and uncordon.')
        : bi('Без drain перезапуск kubelet контейнеры не останавливает, но новое ядро требует перезагрузки, и поды узла пропадают разом, без заранее готовой замены.', 'Without a drain the reboot takes the node’s pods at once, with no replacement ready.'),
      focus: ['w1', 'e-w1', 'e-evict'],
      reveal: ['web', 'e-evict'],
      tokens: p.drain ? [{ edge: 'e-evict', label: bi('выселение', 'evict') }] : [],
      say: { w1: p.drain ? bi('worker-1 выведен из работы, обновлён и возвращён.', 'worker-1 is drained, upgraded and back.') : bi('worker-1 перезагружается, и его поды пропадают разом.', 'worker-1 reboots; its pods vanish at once.') },
      states: { w1: 'ok', web: p.drain ? 'ok' : 'warn' },
      values: { w1: `kubelet ${v(target)}`, web: `ready ${minReady}/3 → 3/3` },
      fill: { web: minReady / 3 },
      metrics: { minReady, apiMinor: target },
    });
    s.push({
      id: 'w2',
      label: 'worker-2',
      caption: bi('Только когда worker-1 вернулся и поды снова готовы, наступает очередь worker-2, и его обновляют в том же порядке.', 'Only then worker-2, in the same order.'),
      focus: ['w2', 'e-w2'],
      tokens: [{ edge: 'e-w2', label: v(target) }],
      say: { w2: bi('worker-2 выводят из работы, обновляют и возвращают так же, как worker-1.', 'worker-2 goes through the same.') },
      states: { w2: 'ok' },
      values: { w2: `kubelet ${v(target)}`, web: 'ready 3/3' },
      fill: { web: 1 },
      metrics: { minReady, apiMinor: target },
    });
    s.push({
      id: 'done',
      label: bi('готово', 'done'),
      caption: fmt(bi('Все компоненты на {v}. Команда kubectl get nodes показывает новую версию у каждого узла, и это и есть проверка того, что обновление закончено.', 'Everything on {v}; kubectl get nodes is the check.'), { v: v(target) }),
      focus: ['you'],
      say: { you: fmt(bi('kubectl get nodes показывает {v} у всех узлов.', 'kubectl get nodes shows {v} everywhere.'), { v: v(target) }) },
      metrics: { minReady, apiMinor: target },
    });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Посмотрите, где обновление останавливается и каким сообщением.', 'See where the upgrade stops and how.') : bi('Препятствие убрано.', 'The obstacle is gone.');
    if (change.id === 'drain') return fmt(bi('В худший момент обновления готово подов web: {n} из 3.', 'At worst {n} of 3 web pods are ready.'), { n: metric(next, 'minReady') });
    if (change.id === 'order') return b.order === 'workers' ? bi('kubelet новее API-сервера нарушает правило версий.', 'A newer kubelet breaks the policy.') : bi('Сверху вниз правило версий соблюдено на каждом шаге.', 'Top down, the policy holds.');
    return Number(b.target) > 37 ? bi('Через минорную версию kubeadm не прыгает.', 'kubeadm does not skip a minor.') : bi('Обновление на одну минорную версию считается обычным шагом.', 'One minor is an ordinary step.');
  },
});
